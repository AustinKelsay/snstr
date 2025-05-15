import { NostrEvent, NostrFilter } from "../types/nostr";
import { Nostr } from "../nip01/nostr";
import { generateKeypair } from "../utils/crypto";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { createSignedEvent } from "../nip01/event";
import {
  NIP46Request,
  NIP46Response,
  generateRequestId,
} from "./utils/request-response";
import { Logger, LogLevel } from "./utils/logger";

// Client options interface
export interface SimpleNIP46ClientOptions {
  timeout?: number;
  logLevel?: LogLevel;
  debug?: boolean;
}

/**
 * Simple implementation of a NIP-46 client
 *
 * This class implements the client-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export class SimpleNIP46Client {
  private nostr: Nostr;
  private clientKeys: { publicKey: string; privateKey: string };
  private signerPubkey: string | null;
  private userPubkey: string | null;
  private pendingRequests: Map<string, (response: NIP46Response) => void>;
  private subId: string | null = null;
  private timeout: number;
  private logger: Logger;
  private debug: boolean;

  /**
   * Create a new SimpleNIP46Client
   *
   * @param relays - Array of relay URLs to connect to
   * @param options - Client options
   */
  constructor(relays: string[], options: SimpleNIP46ClientOptions = {}) {
    this.nostr = new Nostr(relays);
    this.clientKeys = { publicKey: "", privateKey: "" };
    this.signerPubkey = null;
    this.userPubkey = null;
    this.pendingRequests = new Map();
    this.timeout = options.timeout || 30000;
    this.debug = options.debug || false;

    // For backward compatibility, set the logger level based on debug flag if not explicitly set
    const logLevel =
      options.logLevel || (this.debug ? LogLevel.DEBUG : LogLevel.INFO);

    this.logger = new Logger({
      prefix: "Client",
      level: logLevel,
    });
  }

  /**
   * Connect to a remote signer
   *
   * @param connectionString - The bunker:// connection string
   * @returns The user's public key
   */
  async connect(connectionString: string): Promise<string> {
    try {
      // Parse connection string (bunker://PUBKEY?relay=...)
      const url = new URL(connectionString);
      this.signerPubkey = url.hostname;
      this.logger.info(`Connecting to signer: ${this.signerPubkey}`);

      // Validate signer pubkey format
      if (
        !this.signerPubkey ||
        this.signerPubkey.length !== 64 ||
        !/^[0-9a-fA-F]{64}$/.test(this.signerPubkey)
      ) {
        throw new Error(`Invalid signer pubkey: ${this.signerPubkey}`);
      }

      // Generate client keypair
      this.clientKeys = await generateKeypair();
      this.logger.debug(
        `Generated client keypair: ${this.clientKeys.publicKey}`,
      );

      // Connect to relays
      await this.nostr.connectToRelays();

      // Give a moment for the connection to fully establish
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.logger.debug(`Connected to relays`);

      // Subscribe to responses
      const filter: NostrFilter = {
        kinds: [24133],
        "#p": [this.clientKeys.publicKey],
      };

      const subIds = this.nostr.subscribe([filter], (event) =>
        this.handleResponse(event),
      );
      this.subId = subIds[0];
      this.logger.debug(
        `Subscribed to responses with filter: p=${this.clientKeys.publicKey}`,
      );

      // Send connect request
      await this.sendRequest("connect", [this.signerPubkey]);
      this.logger.info(`Connect request sent successfully`);

      // Get and store user public key (required after connect per NIP-46 spec)
      try {
        this.userPubkey = await this.getPublicKey();
        this.logger.debug(`Got user pubkey: ${this.userPubkey}`);
        return this.userPubkey;
      } catch (error: any) {
        this.logger.error(`Failed to get user public key:`, error.message);
        throw new Error("Failed to get user public key after connect");
      }
    } catch (error: any) {
      // Clean up on error
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Get the user's public key
   */
  async getPublicKey(): Promise<string> {
    const response = await this.sendRequest("get_public_key", []);
    return response.result!;
  }

  /**
   * Ping the bunker to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error("Ping timed out")), this.timeout);
      });

      const pingPromise = this.sendRequest("ping", []).then(
        (response) => response.result === "pong",
      );

      // Race the ping request against the timeout
      return await Promise.race([pingPromise, timeoutPromise]);
    } catch (error) {
      // Return false for any error (timeout, connection issues, etc.)
      return false;
    }
  }

  /**
   * Sign an event remotely
   * @param eventData - Event data to sign
   * @returns Signed event
   */
  async signEvent(eventData: any): Promise<NostrEvent> {
    const response = await this.sendRequest("sign_event", [
      JSON.stringify(eventData),
    ]);

    // Handle error response
    if (response.error) {
      throw new Error(response.error);
    }

    // Parse the result
    return JSON.parse(response.result!);
  }

  /**
   * Encrypt a message using NIP-04
   */
  async nip04Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    const response = await this.sendRequest("nip04_encrypt", [
      thirdPartyPubkey,
      plaintext,
    ]);
    if (!response.result) {
      throw new Error("NIP-04 encryption failed");
    }
    return response.result;
  }

  /**
   * Decrypt a message using NIP-04
   */
  async nip04Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    const response = await this.sendRequest("nip04_decrypt", [
      thirdPartyPubkey,
      ciphertext,
    ]);
    if (!response.result) {
      throw new Error("NIP-04 decryption failed");
    }
    return response.result;
  }

  /**
   * Disconnect from the remote signer
   */
  async disconnect(): Promise<void> {
    // First cancel subscription
    if (this.subId) {
      try {
        this.nostr.unsubscribe([this.subId]);
      } catch (e) {
        // Ignore unsubscribe errors
      }
      this.subId = null;
    }

    // Cancel any pending requests with errors
    for (const [id, handler] of this.pendingRequests.entries()) {
      try {
        handler({
          id,
          error: "Client disconnected",
        });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    this.pendingRequests.clear();

    try {
      // Disconnect from relays
      await this.nostr.disconnectFromRelays();
    } catch (e) {
      this.logger.warn("Error disconnecting from relays:", e);
      // Continue despite disconnection errors
    }

    // Reset connection state
    this.userPubkey = null;
    this.signerPubkey = null;

    // Add a small delay to ensure all connections are closed
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Send a request to the remote signer
   *
   * @param method - The request method
   * @param params - The request parameters
   * @returns A promise that resolves with the response
   */
  private async sendRequest(
    method: string,
    params: string[],
  ): Promise<NIP46Response> {
    return new Promise((resolve, reject) => {
      // Check if we have valid keys
      if (!this.clientKeys.privateKey) {
        reject(new Error("Client private key not set"));
        return;
      }

      if (!this.signerPubkey) {
        reject(new Error("Signer public key not set"));
        return;
      }

      // Create the request
      const request: NIP46Request = {
        id: generateRequestId(),
        method,
        params,
      };

      this.logger.debug(`Sending ${method} request: ${request.id}`);
      this.logger.trace(`JSON payload: ${JSON.stringify(request)}`);

      // Store the promise handlers
      this.pendingRequests.set(request.id, resolve);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timed out: ${method}`));
      }, this.timeout);

      // Encrypt and send the request
      try {
        const encrypted = encryptNIP04(
          JSON.stringify(request),
          this.clientKeys.privateKey,
          this.signerPubkey,
        );

        // Create the event without id and sig
        const eventData: Omit<NostrEvent, "id" | "sig"> = {
          kind: 24133,
          pubkey: this.clientKeys.publicKey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", this.signerPubkey]],
          content: encrypted,
        };

        // Create a properly signed event using promises
        createSignedEvent(eventData, this.clientKeys.privateKey)
          .then((signedEvent: NostrEvent) => {
            // Then publish the signed event
            return this.nostr.publishEvent(signedEvent);
          })
          .catch((err: any) => {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(request.id);
            reject(
              new Error(`Failed to sign or publish event: ${err.message}`),
            );
          });
      } catch (error: any) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(request.id);
        reject(new Error(`Failed to encrypt request: ${error.message}`));
      }
    });
  }

  /**
   * Handle a response from the remote signer
   *
   * @param event - The response event
   */
  private handleResponse(event: NostrEvent): void {
    this.logger.debug(`Received response from signer:`);

    // Check if the event is from our signer
    if (this.signerPubkey && event.pubkey !== this.signerPubkey) {
      this.logger.warn(
        `Received response from unexpected pubkey: ${event.pubkey}`,
      );
      return;
    }

    // Ensure we have our client keys
    if (!this.clientKeys.privateKey) {
      this.logger.error(`Cannot decrypt response: client private key not set`);
      return;
    }

    try {
      // Decrypt the content
      const decrypted = decryptNIP04(
        event.content,
        this.clientKeys.privateKey,
        event.pubkey,
      );
      this.logger.debug(`Decrypted content: ${decrypted}`);

      // Parse the response
      const response: NIP46Response = JSON.parse(decrypted);

      // Check if we have a handler for this response
      const handler = this.pendingRequests.get(response.id);
      if (handler) {
        this.logger.debug(`Processing response for request: ${response.id}`);

        // Remove the handler
        this.pendingRequests.delete(response.id);

        // Call the handler
        handler(response);
      } else {
        this.logger.warn(
          `Received response for unknown request: ${response.id}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to process response:`, error.message);
    }
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }
}
