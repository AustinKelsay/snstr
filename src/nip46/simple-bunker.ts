import { NostrEvent, NostrFilter } from "../types/nostr";
import { Nostr } from "../nip01/nostr";
import { encrypt, decrypt } from "../nip04";
import {
  NIP46Request,
  NIP46Response,
  SimpleNIP46BunkerOptions,
  NIP46KeyPair,
  NIP46UnsignedEventData,
  NIP46Error,
  NIP46ConnectionError,
  NIP46Method,
} from "./types";
import { Logger, LogLevel } from "./utils/logger";
import { createSignedEvent, UnsignedEvent } from "../nip01/event";

// Additional constants for NIP-46
export const NIP46_METHODS = {
  CONNECT: "connect",
  GET_PUBLIC_KEY: "get_public_key",
  SIGN_EVENT: "sign_event",
  PING: "ping",
  NIP04_ENCRYPT: "nip04_encrypt",
  NIP04_DECRYPT: "nip04_decrypt",
  NIP44_ENCRYPT: "nip44_encrypt",
  NIP44_DECRYPT: "nip44_decrypt",
};

// Helper functions for response creation
export function createSuccessResponse(
  id: string,
  result: string,
): NIP46Response {
  return { id, result };
}

export function createErrorResponse(id: string, error: string): NIP46Response {
  return { id, error };
}

// Session data for connected clients
interface ClientSession {
  permissions: Set<string>;
  lastSeen: number;
}

/**
 * Simple implementation of a NIP-46 bunker (remote signer)
 *
 * This class implements the signer-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export class SimpleNIP46Bunker {
  private nostr: Nostr;
  private relays: string[];
  private userKeys: NIP46KeyPair;
  private signerKeys: NIP46KeyPair;
  private clients: Map<string, ClientSession>;
  private defaultPermissions: Set<string>;
  private subId: string | null;
  private secret?: string;
  private logger: Logger;
  private debug: boolean;

  /**
   * Create a new SimpleNIP46Bunker
   *
   * @param relays - Array of relay URLs to connect to
   * @param userPubkey - The user's public key
   * @param signerPubkey - Optional separate signer public key (defaults to user pubkey)
   * @param options - Bunker options
   */
  constructor(
    relays: string[],
    userPubkey: string,
    signerPubkey?: string,
    options: SimpleNIP46BunkerOptions = {},
  ) {
    this.relays = relays;
    this.nostr = new Nostr(relays);
    this.userKeys = { publicKey: userPubkey, privateKey: "" };
    this.signerKeys = { publicKey: signerPubkey || userPubkey, privateKey: "" };
    this.clients = new Map();
    this.defaultPermissions = new Set(options.defaultPermissions || []);
    this.subId = null;
    this.secret = options.secret;
    this.debug = options.debug || false;

    // For backward compatibility, set the logger level based on debug flag if not explicitly set
    const logLevel =
      options.logLevel || (this.debug ? LogLevel.DEBUG : LogLevel.INFO);

    this.logger = new Logger({
      prefix: "Bunker",
      level: logLevel,
    });
  }

  /**
   * Start the bunker and listen for requests
   */
  async start(): Promise<void> {
    // Validate keys
    if (!this.userKeys.publicKey) {
      throw new NIP46ConnectionError("User public key not set");
    }

    if (!this.signerKeys.publicKey) {
      throw new NIP46ConnectionError("Signer public key not set");
    }

    try {
      // Connect to relays
      await this.nostr.connectToRelays();

      // Subscribe to requests
      const filter: NostrFilter = {
        kinds: [24133],
        "#p": [this.signerKeys.publicKey],
      };

      const subIds = this.nostr.subscribe([filter], (event) =>
        this.handleRequest(event),
      );
      this.subId = subIds[0];

      this.logger.info(
        `Bunker started for ${this.signerKeys.publicKey} on ${this.relays.length} relay(s)`,
      );
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start bunker:`, errorMessage);
      throw error instanceof NIP46Error
        ? error
        : new NIP46ConnectionError(`Failed to start bunker: ${errorMessage}`);
    }
  }

  /**
   * Stop the bunker
   */
  async stop(): Promise<void> {
    if (this.subId) {
      try {
        this.nostr.unsubscribe([this.subId]);
      } catch (e) {
        // Ignore unsubscribe errors
      }
      this.subId = null;
    }

    try {
      await this.nostr.disconnectFromRelays();
      this.logger.info(`Bunker stopped`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error disconnecting from relays:`, errorMessage);
      // Continue despite errors
    }

    // Clear client sessions
    this.clients.clear();
  }

  /**
   * Get a connection string for clients
   */
  getConnectionString(): string {
    const relayParams = this.relays
      .map((relay) => `relay=${encodeURIComponent(relay)}`)
      .join("&");
    const secretParam = this.secret
      ? `&secret=${encodeURIComponent(this.secret)}`
      : "";

    return `bunker://${this.signerKeys.publicKey}?${relayParams}${secretParam}`;
  }

  /**
   * Set the user's private key
   */
  setUserPrivateKey(privateKey: string): void {
    this.userKeys.privateKey = privateKey;
  }

  /**
   * Set the signer's private key
   */
  setSignerPrivateKey(privateKey: string): void {
    this.signerKeys.privateKey = privateKey;
  }

  /**
   * Set default permissions for all clients
   */
  setDefaultPermissions(permissions: string[]): void {
    this.defaultPermissions = new Set(permissions);
  }

  /**
   * Add a permission for a specific client
   */
  addClientPermission(clientPubkey: string, permission: string): boolean {
    const client = this.clients.get(clientPubkey);
    if (client) {
      client.permissions.add(permission);
      return true;
    }
    return false;
  }

  /**
   * Remove a permission from a specific client
   */
  removeClientPermission(clientPubkey: string, permission: string): boolean {
    const client = this.clients.get(clientPubkey);
    if (client) {
      return client.permissions.delete(permission);
    }
    return false;
  }

  /**
   * Handle an incoming request event
   */
  private async handleRequest(event: NostrEvent): Promise<void> {
    try {
      this.logger.info(`Received request from ${event.pubkey}`);

      // Check if we have the signer private key
      if (!this.signerKeys.privateKey) {
        this.logger.error(`Signer private key not set`);
        return;
      }

      // Decrypt with the signer's private key and client's public key
      try {
        const decrypted = decrypt(
          event.content,
          this.signerKeys.privateKey,
          event.pubkey,
        );

        this.logger.debug(`Decrypted content: ${decrypted}`);

        // Parse the request
        const request: NIP46Request = JSON.parse(decrypted);
        const clientPubkey = event.pubkey;

        this.logger.debug(
          `Processing request: ${request.method} (${request.id})`,
        );

        // Handle the request based on method
        let response: NIP46Response;

        switch (request.method) {
          case NIP46Method.CONNECT:
            response = await this.handleConnect(request, clientPubkey);
            break;

          case NIP46Method.GET_PUBLIC_KEY:
            if (!this.isClientAuthorized(clientPubkey)) {
              response = createErrorResponse(request.id, "Unauthorized");
            } else {
              this.logger.debug(`Sending pubkey: ${this.userKeys.publicKey}`);
              response = createSuccessResponse(
                request.id,
                this.userKeys.publicKey,
              );
            }
            break;

          case NIP46Method.PING:
            if (!this.isClientAuthorized(clientPubkey)) {
              response = createErrorResponse(request.id, "Unauthorized");
            } else {
              this.logger.debug(`Ping-pong`);
              response = createSuccessResponse(request.id, "pong");
            }
            break;

          case NIP46Method.SIGN_EVENT:
            response = await this.handleSignEvent(request, clientPubkey);
            break;

          case NIP46Method.NIP04_ENCRYPT:
            response = await this.handleNIP04Encrypt(request, clientPubkey);
            break;

          case NIP46Method.NIP04_DECRYPT:
            response = await this.handleNIP04Decrypt(request, clientPubkey);
            break;

          default:
            response = createErrorResponse(
              request.id,
              `Unknown method: ${request.method}`,
            );
        }

        // Send the response
        await this.sendResponse(response, clientPubkey);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process request:`, errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling request:`, errorMessage);
    }
  }

  /**
   * Handle a connect request
   */
  private async handleConnect(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check if we have parameters
    if (!request.params || request.params.length < 1) {
      return createErrorResponse(
        request.id,
        "Missing parameters for connect request",
      );
    }

    // Extract parameters
    const [requestedSignerPubkey, requestedSecret, permissionsParam] =
      request.params;

    // Validate signer pubkey
    if (requestedSignerPubkey !== this.signerKeys.publicKey) {
      this.logger.warn(
        `Client requested connection to ${requestedSignerPubkey} but this bunker serves ${this.signerKeys.publicKey}`,
      );
      return createErrorResponse(
        request.id,
        "Requested signer pubkey does not match this bunker",
      );
    }

    // Validate secret if set
    if (this.secret && requestedSecret !== this.secret) {
      this.logger.warn(`Client provided invalid secret`);
      return createErrorResponse(request.id, "Invalid secret");
    }

    // Create client session with default permissions
    const session: ClientSession = {
      permissions: new Set(this.defaultPermissions),
      lastSeen: Date.now(),
    };

    // Add requested permissions if provided
    if (permissionsParam && typeof permissionsParam === "string") {
      permissionsParam.split(",").forEach((permission: string) => {
        session.permissions.add(permission.trim());
      });
    }

    // Store client session
    this.clients.set(clientPubkey, session);

    this.logger.info(`Client ${clientPubkey.slice(0, 8)}... connected`);
    this.logger.debug(
      `Client permissions: ${Array.from(session.permissions).join(", ")}`,
    );

    // Respond with "ack" or the secret if provided
    return createSuccessResponse(request.id, requestedSecret || "ack");
  }

  /**
   * Handle a sign_event request
   */
  private async handleSignEvent(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }

    // Check if we have the user's private key
    if (!this.userKeys.privateKey) {
      return createErrorResponse(request.id, "User private key not set");
    }

    // Get the event data
    if (!request.params[0]) {
      return createErrorResponse(request.id, "Missing event data");
    }

    try {
      // Parse the event data
      const eventData: NIP46UnsignedEventData = JSON.parse(request.params[0]);

      // Check if the client has permission to sign this kind of event
      const kindPermission = `sign_event:${eventData.kind}`;
      const client = this.clients.get(clientPubkey);

      if (
        !client ||
        (!client.permissions.has("sign_event") &&
          !client.permissions.has(kindPermission))
      ) {
        return createErrorResponse(
          request.id,
          `Not authorized to sign kind ${eventData.kind} events`,
        );
      }

      this.logger.debug(`Signing event kind: ${eventData.kind}`);

      // Create the unsigned event
      const unsignedEvent: UnsignedEvent = {
        kind: eventData.kind,
        content: eventData.content,
        created_at: eventData.created_at,
        tags: eventData.tags || [],
        pubkey: this.userKeys.publicKey,
      };

      // Set the private key on the Nostr instance for signing
      this.nostr.setPrivateKey(this.userKeys.privateKey);

      // Create a signed event using createSignedEvent
      const signedEvent = await createSignedEvent(
        unsignedEvent,
        this.userKeys.privateKey,
      );

      this.logger.debug(`Event signed successfully`);

      // Return the signed event
      return createSuccessResponse(request.id, JSON.stringify(signedEvent));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return createErrorResponse(
        request.id,
        `Failed to sign event: ${errorMessage}`,
      );
    }
  }

  /**
   * Handle a nip04_encrypt request
   */
  private async handleNIP04Encrypt(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }

    // Check if client has encryption permission
    const client = this.clients.get(clientPubkey);
    if (!client || !client.permissions.has("nip04_encrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized for NIP-04 encryption",
      );
    }

    // Check if we have the user's private key
    if (!this.userKeys.privateKey) {
      return createErrorResponse(request.id, "User private key not set");
    }

    // Check parameters
    if (request.params.length < 2) {
      return createErrorResponse(request.id, "Missing parameters");
    }

    const [recipient, plaintext] = request.params;

    try {
      // Encrypt the message
      const encrypted = encrypt(plaintext, this.userKeys.privateKey, recipient);

      this.logger.debug(`NIP-04 encryption successful`);

      return createSuccessResponse(request.id, encrypted);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return createErrorResponse(
        request.id,
        `NIP-04 encryption failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Handle a nip04_decrypt request
   */
  private async handleNIP04Decrypt(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }

    // Check if client has decryption permission
    const client = this.clients.get(clientPubkey);
    if (!client || !client.permissions.has("nip04_decrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized for NIP-04 decryption",
      );
    }

    // Check parameters
    if (request.params.length < 2) {
      return createErrorResponse(request.id, "Missing parameters");
    }

    const [sender, ciphertext] = request.params;

    try {
      // Decrypt the message
      const decrypted = decrypt(ciphertext, this.userKeys.privateKey, sender);

      this.logger.debug(`NIP-04 decryption successful`);

      return createSuccessResponse(request.id, decrypted);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return createErrorResponse(
        request.id,
        `NIP-04 decryption failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Send a response to a client
   */
  private async sendResponse(
    response: NIP46Response,
    clientPubkey: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Sending response for request ${response.id}:`,
        JSON.stringify(response),
      );

      // Encrypt the response with the signer's private key and client's public key
      const encrypted = encrypt(
        JSON.stringify(response),
        this.signerKeys.privateKey,
        clientPubkey,
      );

      // Create the unsigned event
      const eventData: UnsignedEvent = {
        kind: 24133,
        pubkey: this.signerKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", clientPubkey]],
        content: encrypted,
      };

      // Create a properly signed event
      const signedEvent = await createSignedEvent(
        eventData,
        this.signerKeys.privateKey,
      );

      // Use the Nostr class to publish the event
      await this.nostr.publishEvent(signedEvent);

      this.logger.debug(`Response sent for request: ${response.id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send response: ${errorMessage}`);
    }
  }

  /**
   * Check if a client is authorized
   */
  private isClientAuthorized(clientPubkey: string): boolean {
    return this.clients.has(clientPubkey);
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }
}
