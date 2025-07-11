import { NostrEvent, NostrFilter } from "../types/nostr";
import { Nostr } from "../nip01/nostr";
import { generateKeypair } from "../utils/crypto";
import { getUnixTime } from "../utils/time";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { createSignedEvent } from "../nip01/event";
import { generateRequestId } from "./utils/request-response";
import { Logger, LogLevel } from "./utils/logger";
import { parseConnectionString } from "./utils/connection";
import {
  NIP46KeyPair,
  NIP46UnsignedEventData,
  SimpleNIP46ClientOptions,
  NIP46Error,
  NIP46ConnectionError,
  NIP46TimeoutError,
  NIP46EncryptionError,
  NIP46DecryptionError,
  NIP46SigningError,
  NIP46Request,
  NIP46Response,
  NIP46Method,
} from "./types";

/**
 * Simple implementation of a NIP-46 client
 *
 * This class implements the client-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export class SimpleNIP46Client {
  private nostr: Nostr;
  private clientKeys: NIP46KeyPair;
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
      silent: process.env.NODE_ENV === 'test' // Silent in test environment
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
      // Parse connection string and validate
      const info = parseConnectionString(connectionString);
      this.signerPubkey = info.pubkey;
      this.logger.info(`Connecting to signer: ${this.signerPubkey}`);

      // Add relays from connection string to the client
      if (info.relays && info.relays.length > 0) {
        this.logger.debug(`Adding relays from connection string: ${info.relays.join(', ')}`);
        info.relays.forEach(relay => {
          try {
            this.nostr.addRelay(relay);
          } catch (error) {
            this.logger.warn(`Failed to add relay ${relay}:`, error instanceof Error ? error.message : String(error));
          }
        });
      }

      // Generate client keypair
      this.clientKeys = await generateKeypair();
      this.logger.debug(
        `Generated client keypair: ${this.clientKeys.publicKey}`,
      );

      // Connect to relays
      await this.nostr.connectToRelays();

      // Give a moment for the connection to fully establish
      await new Promise((resolve) => setTimeout(resolve, 1000).unref());
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

      // Send connect request with proper parameters per NIP-46 spec
      // Ensure signerPubkey is not null before constructing params array
      if (!this.signerPubkey) {
        throw new NIP46ConnectionError("Signer public key is not set. Connection string parsing may have failed.");
      }
      
      const connectParams = [
        this.signerPubkey,
        info.secret || "", // optional_secret
        (info.permissions || []).join(",") // optional_requested_permissions
      ];
      
      const connectResponse = await this.sendRequest(NIP46Method.CONNECT, connectParams);
      this.logger.info(`Connect request sent successfully`);
      
      // Handle connect response per NIP-46 spec
      // First check for error response
      if (connectResponse.error) {
        throw new NIP46ConnectionError(`Connection failed: ${connectResponse.error}`);
      }
      
      if (connectResponse.result !== "ack") {
        // If not "ack", it should be a required secret value
        this.logger.debug(`Connect response requires secret: ${connectResponse.result}`);
        if (!info.secret || info.secret !== connectResponse.result) {
          throw new NIP46ConnectionError("Invalid or missing required secret");
        }
      }

      // Get and store user public key (required after connect per NIP-46 spec)
      try {
        this.userPubkey = await this.getPublicKey();
        this.logger.debug(`Got user pubkey: ${this.userPubkey}`);
        return this.userPubkey;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to get user public key:`, errorMessage);
        throw new NIP46ConnectionError(
          "Failed to get user public key after connect",
        );
      }
    } catch (error) {
      // Clean up on error
      await this.disconnect();
      if (error instanceof NIP46Error) {
        throw error;
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new NIP46ConnectionError(`Connection failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Get the user's public key
   */
  async getPublicKey(): Promise<string> {
    const response = await this.sendRequest(NIP46Method.GET_PUBLIC_KEY, []);
    return response.result!;
  }

  /**
   * Ping the bunker to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      // Check if client is connected first
      if (!this.signerPubkey || !this.clientKeys.privateKey) {
        return false;
      }

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(
          () => reject(new NIP46TimeoutError("Ping timed out")),
          this.timeout,
        ).unref(); // Don't keep process alive
      });

      const pingPromise = this.sendRequest(NIP46Method.PING, []).then(
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
  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent> {
    const response = await this.sendRequest(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData),
    ]);

    // Handle error response
    if (response.error) {
      throw new NIP46SigningError(response.error);
    }

    // Parse the result
    return JSON.parse(response.result!);
  }

  /**
   * Encrypt a message using NIP-44 (preferred)
   */
  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    const response = await this.sendRequest(NIP46Method.NIP44_ENCRYPT, [
      thirdPartyPubkey,
      plaintext,
    ]);

    if (response.error) {
      throw new NIP46EncryptionError(`NIP-44 encryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Decrypt a message using NIP-44 (preferred)
   */
  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    const response = await this.sendRequest(NIP46Method.NIP44_DECRYPT, [
      thirdPartyPubkey,
      ciphertext,
    ]);

    if (response.error) {
      throw new NIP46DecryptionError(`NIP-44 decryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Encrypt a message using NIP-04 (legacy support)
   */
  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    const response = await this.sendRequest(NIP46Method.NIP04_ENCRYPT, [
      thirdPartyPubkey,
      plaintext,
    ]);

    if (response.error) {
      throw new NIP46EncryptionError(`NIP-04 encryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Decrypt a message using NIP-04 (legacy support)
   */
  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    const response = await this.sendRequest(NIP46Method.NIP04_DECRYPT, [
      thirdPartyPubkey,
      ciphertext,
    ]);

    if (response.error) {
      throw new NIP46DecryptionError(`NIP-04 decryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Get the relay list from the remote signer
   */
  async getRelays(): Promise<string[]> {
    const response = await this.sendRequest(NIP46Method.GET_RELAYS, []);
    return JSON.parse(response.result!);
  }

  /**
   * Disconnect from the remote signer
   */
  async disconnect(): Promise<void> {
    // Send disconnect request to bunker if connected
    if (this.signerPubkey && this.clientKeys.privateKey) {
      try {
        await this.sendRequest(NIP46Method.DISCONNECT, []);
        this.logger.debug("Disconnect request sent to bunker");
      } catch (e) {
        // Ignore disconnect request errors - continue with cleanup
        this.logger.warn("Failed to send disconnect request:", e instanceof Error ? e.message : String(e));
      }
    }

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
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.warn("Error disconnecting from relays:", errorMessage);
      // Continue despite disconnection errors
    }

    // Reset connection state
    this.userPubkey = null;
    this.signerPubkey = null;

    // Add a small delay to ensure all connections are closed
    await new Promise((resolve) => setTimeout(resolve, 500).unref());
  }

  /**
   * Send a request to the remote signer
   *
   * @param method - The request method
   * @param params - The request parameters
   * @returns A promise that resolves with the response
   */
  private async sendRequest(
    method: NIP46Method,
    params: string[],
  ): Promise<NIP46Response> {
    return new Promise((resolve, reject) => {
      // Check if we have valid keys
      if (!this.clientKeys.privateKey) {
        reject(new NIP46ConnectionError("Client private key not set"));
        return;
      }

      if (!this.signerPubkey) {
        reject(new NIP46ConnectionError("Signer public key not set"));
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

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new NIP46TimeoutError(`Request timed out: ${method}`));
      }, this.timeout).unref(); // Don't keep process alive

      // Store the promise handlers with timeout cleanup
      this.pendingRequests.set(request.id, (response: NIP46Response) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(new NIP46Error(response.error));
        } else {
          resolve(response);
        }
      });

      // Encrypt and send the request
      try {
        const encrypted = encryptNIP44(
          JSON.stringify(request),
          this.clientKeys.privateKey,
          this.signerPubkey,
        );

        // Create the event without id and sig
        const eventData: Omit<NostrEvent, "id" | "sig"> = {
          kind: 24133,
          pubkey: this.clientKeys.publicKey,
          created_at: getUnixTime(),
          tags: [["p", this.signerPubkey]],
          content: encrypted,
        };

        // Create a properly signed event using promises
        createSignedEvent(eventData, this.clientKeys.privateKey)
          .then((signedEvent: NostrEvent) => {
            // Then publish the signed event
            return this.nostr.publishEvent(signedEvent);
          })
          .then((publishResult) => {
            if (!publishResult.success) {
              let reasonMessage = "unknown reason";
              if (publishResult.relayResults) {
                for (const relayResult of publishResult.relayResults.values()) {
                  if (!relayResult.success && relayResult.reason) {
                    reasonMessage = relayResult.reason;
                    break;
                  }
                }
              }
              throw new NIP46ConnectionError(
                `Relay rejected event: ${reasonMessage}`,
              );
            }
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(request.id);
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            reject(
              new NIP46ConnectionError(
                `Failed to sign or publish event: ${errorMessage}`,
              ),
            );
          });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(request.id);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        reject(
          new NIP46EncryptionError(
            `Failed to encrypt request: ${errorMessage}`,
          ),
        );
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
      // Decrypt the content using NIP-44
      const decrypted = decryptNIP44(
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process response:`, errorMessage);
    }
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }
}
