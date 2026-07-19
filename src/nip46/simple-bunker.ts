import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { createSignedEvent, UnsignedEvent } from "../nip01/event";
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
import { LogLevel } from "../utils/logger";
import { NIP46DiagnosticLogger } from "./utils/diagnostics";
import {
  createSuccessResponse,
  createErrorResponse,
} from "./utils/request-response";
import { buildConnectionString } from "./utils/connection";
import { validatePrivateKeySecure } from "./utils/security";
import { NIP46BunkerEngine } from "./internal/bunker-engine";

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
  private readonly engine: NIP46BunkerEngine;
  private readonly relays: string[];
  private userKeys: NIP46KeyPair;
  private signerKeys: NIP46KeyPair;
  private clients: Map<string, ClientSession>;
  private defaultPermissions: Set<string>;
  private secret?: string;
  private logger: NIP46DiagnosticLogger;

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
    this.userKeys = { publicKey: userPubkey, privateKey: "" };
    this.signerKeys = { publicKey: signerPubkey || userPubkey, privateKey: "" };
    this.clients = new Map();
    this.defaultPermissions = new Set(options.defaultPermissions || []);
    this.secret = options.secret;
    const debug = options.debug || false;

    // For backward compatibility, set the logger level based on debug flag if not explicitly set
    const logLevel =
      options.logLevel || (debug ? LogLevel.DEBUG : LogLevel.INFO);

    this.logger = NIP46DiagnosticLogger.create(options.logger, {
      prefix: "Bunker",
      level: logLevel,
      silent: process.env.NODE_ENV === "test", // Silent in test environment
    });
    this.engine = new NIP46BunkerEngine({
      relays,
      logger: this.logger,
      signerKeys: () => this.signerKeys,
      validateStart: () => {
        if (!this.userKeys.publicKey) {
          throw new NIP46ConnectionError("User public key not set");
        }
        if (!this.signerKeys.publicKey) {
          throw new NIP46ConnectionError("Signer public key not set");
        }
        if (!this.signerKeys.privateKey) {
          throw new NIP46ConnectionError("Signer private key not set");
        }
      },
      handlers: {
        [NIP46Method.CONNECT]: (request, clientPubkey) =>
          this.handleConnect(request, clientPubkey),
        [NIP46Method.GET_PUBLIC_KEY]: (request, clientPubkey) =>
          this.handleGetPublicKey(request, clientPubkey),
        [NIP46Method.PING]: (request, clientPubkey) =>
          this.handlePing(request, clientPubkey),
        [NIP46Method.SIGN_EVENT]: (request, clientPubkey) =>
          this.handleSignEvent(request, clientPubkey),
        [NIP46Method.NIP44_ENCRYPT]: (request, clientPubkey) =>
          this.handleNIP44Encrypt(request, clientPubkey),
        [NIP46Method.NIP44_DECRYPT]: (request, clientPubkey) =>
          this.handleNIP44Decrypt(request, clientPubkey),
        [NIP46Method.NIP04_ENCRYPT]: (request, clientPubkey) =>
          this.handleNIP04Encrypt(request, clientPubkey),
        [NIP46Method.NIP04_DECRYPT]: (request, clientPubkey) =>
          this.handleNIP04Decrypt(request, clientPubkey),
        [NIP46Method.GET_RELAYS]: (request, clientPubkey) =>
          this.handleGetRelays(request, clientPubkey),
        [NIP46Method.DISCONNECT]: (request, clientPubkey) =>
          this.handleDisconnect(request, clientPubkey),
      },
      unknownMethod: (request) =>
        createErrorResponse(request.id, `Unknown method: ${request.method}`),
      failureResponse: (error) =>
        createErrorResponse(
          "unknown",
          `Failed to process request: ${this.errorMessage(error)}`,
        ),
      afterStop: () => this.clients.clear(),
    });
  }

  /**
   * Start the bunker and listen for requests
   */
  async start(): Promise<void> {
    try {
      await this.engine.start();
      this.logger.info(
        `Bunker started for ${this.signerKeys.publicKey} on ${this.relays.length} relay(s)`,
      );
    } catch (error) {
      const errorMessage = this.errorMessage(error);
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
    try {
      await this.engine.stop();
      this.logger.info(`Bunker stopped`);
    } catch (error) {
      const errorMessage = this.errorMessage(error);
      this.logger.warn(`Error disconnecting from relays:`, errorMessage);
    }
  }

  /**
   * Get a connection string for clients
   */
  getConnectionString(): string {
    return buildConnectionString({
      pubkey: this.signerKeys.publicKey,
      relays: this.relays,
      secret: this.secret,
    });
  }

  /**
   * Set the user's private key
   */
  setUserPrivateKey(privateKey: string): void {
    validatePrivateKeySecure(privateKey, "user private key");
    this.userKeys.privateKey = privateKey;
  }

  /**
   * Set the signer's private key
   */
  setSignerPrivateKey(privateKey: string): void {
    validatePrivateKeySecure(privateKey, "signer private key");
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
    this.logger.debug("Client permissions configured", {
      permissionCount: session.permissions.size,
    });

    // Respond with "ack" or the secret if provided
    return createSuccessResponse(request.id, requestedSecret || "ack");
  }

  private async handleGetPublicKey(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }
    return createSuccessResponse(request.id, this.userKeys.publicKey);
  }

  private async handlePing(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }
    return createSuccessResponse(request.id, "pong");
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
        tags: eventData.tags ?? [],
        pubkey: this.userKeys.publicKey,
      };

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
   * Handle NIP-44 encryption request (preferred)
   */
  private async handleNIP44Encrypt(
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

    // Check if the client has permission to encrypt
    const client = this.clients.get(clientPubkey);

    if (!client) {
      return createErrorResponse(
        request.id,
        "Client not found - authorization required",
      );
    }

    if (!client.permissions.has("nip44_encrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized to encrypt NIP-44 messages",
      );
    }

    try {
      const [thirdPartyPubkey, plaintext] = request.params;

      if (!thirdPartyPubkey || !plaintext) {
        return {
          id: request.id,
          error: "Missing required parameters for NIP-44 encryption",
        };
      }

      const encrypted = encryptNIP44(
        plaintext,
        this.userKeys.privateKey,
        thirdPartyPubkey,
      );

      return {
        id: request.id,
        result: encrypted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("NIP-44 encryption failed:", errorMessage);
      return {
        id: request.id,
        error: `NIP-44 encryption failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle NIP-44 decryption request (preferred)
   */
  private async handleNIP44Decrypt(
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

    // Check if the client has permission to decrypt
    const client = this.clients.get(clientPubkey);

    if (!client) {
      return createErrorResponse(
        request.id,
        "Client not found - authorization required",
      );
    }

    if (!client.permissions.has("nip44_decrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized to decrypt NIP-44 messages",
      );
    }

    try {
      const [thirdPartyPubkey, ciphertext] = request.params;

      if (!thirdPartyPubkey || !ciphertext) {
        return {
          id: request.id,
          error: "Missing required parameters for NIP-44 decryption",
        };
      }

      const decrypted = decryptNIP44(
        ciphertext,
        this.userKeys.privateKey,
        thirdPartyPubkey,
      );

      return {
        id: request.id,
        result: decrypted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("NIP-44 decryption failed:", errorMessage);
      return {
        id: request.id,
        error: `NIP-44 decryption failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle NIP-04 encryption request (legacy support)
   */
  private async handleNIP04Encrypt(
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

    // Check if the client has permission to encrypt
    const client = this.clients.get(clientPubkey);

    if (!client) {
      return createErrorResponse(
        request.id,
        "Client not found - authorization required",
      );
    }

    if (!client.permissions.has("nip04_encrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized to encrypt NIP-04 messages",
      );
    }

    try {
      const [thirdPartyPubkey, plaintext] = request.params;

      if (!thirdPartyPubkey || !plaintext || plaintext === "") {
        return {
          id: request.id,
          error: "Missing required parameters for NIP-04 encryption",
        };
      }

      const encrypted = encryptNIP04(
        this.userKeys.privateKey,
        thirdPartyPubkey,
        plaintext,
      );

      return {
        id: request.id,
        result: encrypted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("NIP-04 encryption failed:", errorMessage);
      return {
        id: request.id,
        error: `NIP-04 encryption failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle NIP-04 decryption request (legacy support)
   */
  private async handleNIP04Decrypt(
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

    // Check if the client has permission to decrypt
    const client = this.clients.get(clientPubkey);

    if (!client) {
      return createErrorResponse(
        request.id,
        "Client not found - authorization required",
      );
    }

    if (!client.permissions.has("nip04_decrypt")) {
      return createErrorResponse(
        request.id,
        "Not authorized to decrypt NIP-04 messages",
      );
    }

    try {
      const [thirdPartyPubkey, ciphertext] = request.params;

      if (!thirdPartyPubkey || !ciphertext || ciphertext === "") {
        return {
          id: request.id,
          error: "Missing required parameters for NIP-04 decryption",
        };
      }

      const decrypted = decryptNIP04(
        this.userKeys.privateKey,
        thirdPartyPubkey,
        ciphertext,
      );

      return {
        id: request.id,
        result: decrypted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("NIP-04 decryption failed:", errorMessage);
      return {
        id: request.id,
        error: `NIP-04 decryption failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle get_relays request
   */
  private async handleGetRelays(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }

    // Check if the client has permission to get relays
    const client = this.clients.get(clientPubkey);

    if (!client) {
      return createErrorResponse(
        request.id,
        "Client not found - authorization required",
      );
    }

    if (!client.permissions.has("get_relays")) {
      return createErrorResponse(
        request.id,
        "Not authorized to get relay list",
      );
    }

    try {
      // Return the relay list as JSON string
      return {
        id: request.id,
        result: JSON.stringify(this.relays),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("Get relays failed:", errorMessage);
      return {
        id: request.id,
        error: `Get relays failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle disconnect request
   */
  private async handleDisconnect(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, "Unauthorized");
    }

    try {
      // Remove client from authorized clients
      this.clients.delete(clientPubkey);

      this.logger.info(`Client ${clientPubkey.slice(0, 8)}... disconnected`);

      return {
        id: request.id,
        result: "ack",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("Disconnect failed:", errorMessage);
      return {
        id: request.id,
        error: `Disconnect failed: ${errorMessage}`,
      };
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
