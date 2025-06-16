import { Nostr } from "../nip01/nostr";
import { generateKeypair } from "../utils/crypto";
import { getUnixTime } from "../utils/time";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { NostrEvent, NostrFilter } from "../types/nostr";
import { createSignedEvent } from "../nip01/event";
import { parseConnectionString } from "./utils/connection";
import {
  NIP46Method,
  NIP46Request,
  NIP46Response,
  NIP46ClientOptions,
  NIP46EncryptionResult,
  NIP46Error,
  NIP46ConnectionError,
  NIP46TimeoutError,
  NIP46EncryptionError,
  NIP46DecryptionError,
  NIP46SigningError,
  NIP46KeyPair,
  NIP46UnsignedEventData,
} from "./types";

const DEFAULT_TIMEOUT = 30000; // 30 seconds

export class NostrRemoteSignerClient {
  private nostr: Nostr;
  private clientKeypair: NIP46KeyPair | null = null;
  private signerPubkey: string | null = null;
  private userPubkey: string | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (response: NIP46Response) => void;
      reject: (reason: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private options: NIP46ClientOptions;
  private authWindow: Window | null;
  private connected = false;
  private subId: string | null = null;
  private debug: boolean;

  constructor(options: NIP46ClientOptions = {}) {
    this.options = {
      timeout: DEFAULT_TIMEOUT,
      relays: [],
      secret: "",
      permissions: [],
      name: "",
      url: "",
      image: "",
      ...options,
    };
    this.nostr = new Nostr(this.options.relays);
    this.authWindow = null;
    this.debug = options.debug || false;
  }

  /**
   * Set up subscription to receive responses from the signer
   */
  private async setupSubscription(): Promise<void> {
    if (this.debug) console.log("[NIP46 CLIENT] Setting up subscription...");

    if (this.subId) {
      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Cleaning up previous subscription:",
          this.subId,
        );
      this.nostr.unsubscribe([this.subId]);
    }

    if (!this.clientKeypair) {
      throw new NIP46ConnectionError("Client keypair not initialized");
    }

    const filter: NostrFilter = {
      kinds: [24133],
      "#p": [this.clientKeypair.publicKey],
    };

    // Add authors filter if we know the signer's pubkey
    if (this.signerPubkey) {
      filter.authors = [this.signerPubkey];
    }

    if (this.debug) {
      console.log(
        "[NIP46 CLIENT] Subscribing with filter:",
        JSON.stringify(filter),
      );
      console.log(
        "[NIP46 CLIENT] Client pubkey:",
        this.clientKeypair.publicKey,
      );
    }

    this.subId = this.nostr.subscribe([filter], (event) =>
      this.handleResponse(event),
    )[0];

    if (this.debug)
      console.log("[NIP46 CLIENT] Subscription created with ID:", this.subId);
  }

  /**
   * Clean up resources and reset state
   */
  private async cleanup(): Promise<void> {
    if (this.subId) {
      this.nostr.unsubscribe([this.subId]);
      this.subId = null;
    }

    await this.nostr.disconnectFromRelays();

    this.connected = false;
    this.signerPubkey = null;
    this.userPubkey = null;

    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout);
      request.reject(new NIP46ConnectionError("Client disconnected"));
    });
    this.pendingRequests.clear();
  }

  /**
   * Connect to a remote signer
   * @throws {Error} If connection fails or validation fails
   */
  public async connect(connectionString: string): Promise<string> {
    if (this.debug)
      console.log(
        "[NIP46 CLIENT] Connecting to signer with string:",
        connectionString,
      );
    try {
      // Generate client keypair if needed
      if (!this.clientKeypair) {
        this.clientKeypair = await generateKeypair();
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Generated client pubkey:",
            this.clientKeypair.publicKey,
          );
      }

      // Connect to relays
      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Connecting to relays:",
          this.options.relays,
        );
      await this.nostr.connectToRelays();
      if (this.debug) console.log("[NIP46 CLIENT] Connected to relays");

      // Parse connection info
      const connectionInfo = parseConnectionString(connectionString);
      this.signerPubkey = connectionInfo.pubkey;
      if (this.debug) {
        console.log("[NIP46 CLIENT] Signer pubkey:", this.signerPubkey);
        console.log(
          "[NIP46 CLIENT] Connection info:",
          JSON.stringify({
            type: connectionInfo.type,
            relays: connectionInfo.relays,
            hasSecret: !!connectionInfo.secret,
            permissions: connectionInfo.permissions,
          }),
        );
      }

      // Update relays if needed
      if (connectionInfo.relays?.length) {
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Updating relays to:",
            connectionInfo.relays,
          );
        this.options.relays = connectionInfo.relays;
        this.nostr = new Nostr(connectionInfo.relays);
        await this.nostr.connectToRelays();
        if (this.debug)
          console.log("[NIP46 CLIENT] Reconnected to updated relays");
      }

      // Set up subscription
      await this.setupSubscription();

      // Send connect request
      if (this.debug)
        console.log("[NIP46 CLIENT] Sending connect request to signer");
      const perms = [
        ...new Set([
          ...(this.options.permissions || []),
          ...(connectionInfo.permissions || []),
        ]),
      ].join(",");
      if (this.debug)
        console.log("[NIP46 CLIENT] Requesting permissions:", perms);

      const response = await this.sendRequest(NIP46Method.CONNECT, [
        this.signerPubkey,
        connectionInfo.secret || this.options.secret || "",
        perms,
      ]);

      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Received connect response:",
          JSON.stringify(response),
        );

      // Handle auth challenge
      if (response.auth_url) {
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Auth challenge received, URL:",
            response.auth_url,
          );
        // Wait for authentication to complete (will be handled by handleResponse)
        const authTimeout = this.options.timeout || DEFAULT_TIMEOUT;
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new NIP46TimeoutError("Authentication challenge timed out"));
          }, authTimeout);

          // Check periodically if we can connect
          const checkInterval = setInterval(async () => {
            try {
              if (this.connected) {
                clearInterval(checkInterval);
                resolve();
              }

              // Try to get the public key as a test of successful connection
              await this.getPublicKey();
              clearInterval(checkInterval);
              resolve();
            } catch (err) {
              // Keep trying until timeout
            }
          }, 1000);
        });
      } else {
        // Validate response
        if (response.error) {
          console.error("[NIP46 CLIENT] Connection failed:", response.error);
          throw new NIP46ConnectionError(
            `Connection failed: ${response.error}`,
          );
        }

        // Connection successful - set connected state BEFORE calling getPublicKey
        this.connected = true;
        if (this.debug) console.log("[NIP46 CLIENT] Connection successful");
      }

      // NIP-46 spec requires calling get_public_key after connect
      // This is to differentiate between signer-pubkey and user-pubkey
      try {
        if (this.debug) console.log("[NIP46 CLIENT] Getting user public key");
        this.userPubkey = await this.getPublicKey();
        if (this.debug)
          console.log("[NIP46 CLIENT] User pubkey:", this.userPubkey);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "[NIP46 CLIENT] Failed to get user public key:",
          errorMessage,
        );
        throw new NIP46ConnectionError(
          "Failed to get user public key after connect",
        );
      }

      return this.userPubkey as string;
    } catch (error) {
      console.error("[NIP46 CLIENT] Connection error:", error);
      // Clean up on error
      await this.cleanup();
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
   * Disconnect from the remote signer
   */
  public async disconnect(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Sign an event using the remote signer
   */
  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Client not connected");
    }

    const response = await this.sendRequest(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData),
    ]);

    if (response.error) {
      throw new NIP46SigningError(`Signing failed: ${response.error}`);
    }

    if (response.auth_url) {
      throw new NIP46SigningError(
        "Auth challenge not supported in this implementation",
      );
    }

    return JSON.parse(response.result!);
  }

  /**
   * Get the user's public key from the remote signer
   */
  async getPublicKey(): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Client not connected");
    }

    const response = await this.sendRequest(NIP46Method.GET_PUBLIC_KEY, []);
    if (response.error) {
      throw new NIP46ConnectionError(
        `Failed to get public key: ${response.error}`,
      );
    }
    return response.result!;
  }

  /**
   * Send a ping to the remote signer
   */
  async ping(): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Client not connected");
    }

    const response = await this.sendRequest(NIP46Method.PING, []);
    if (response.error) {
      throw new NIP46ConnectionError(`Ping failed: ${response.error}`);
    }
    return response.result!;
  }

  /**
   * Encrypt a message using NIP-44
   */
  async nip44Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Not connected to remote signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP44_ENCRYPT, [
      thirdPartyPubkey,
      plaintext,
    ]);

    if (response.error) {
      throw new NIP46EncryptionError(
        `NIP-44 encryption failed: ${response.error}`,
      );
    }

    return response.result!;
  }

  /**
   * Decrypt a message using NIP-44
   */
  async nip44Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Not connected to remote signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP44_DECRYPT, [
      thirdPartyPubkey,
      ciphertext,
    ]);

    if (response.error) {
      throw new NIP46DecryptionError(
        `NIP-44 decryption failed: ${response.error}`,
      );
    }

    return response.result!;
  }

  /**
   * Send a request to the remote signer
   */
  private async sendRequest(
    method: NIP46Method,
    params: string[],
  ): Promise<NIP46Response> {
    if (this.debug) {
      console.log("[NIP46 CLIENT] Sending request:", method);
      console.log("[NIP46 CLIENT] Request params:", JSON.stringify(params));
    }

    if (!this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Client not initialized");
    }

    // Generate a random ID for the request
    const id = Math.random().toString(36).substring(2, 15);
    if (this.debug) console.log("[NIP46 CLIENT] Request ID:", id);

    const request: NIP46Request = {
      id,
      method,
      params,
    };

    return new Promise<NIP46Response>((resolve, reject) => {
      // Set a timeout to reject the promise if we don't get a response
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.error("[NIP46 CLIENT] Request timed out:", method, id);
          this.pendingRequests.delete(id);
          reject(new NIP46TimeoutError(`Request timed out: ${method}`));
        }
      }, this.options.timeout || DEFAULT_TIMEOUT);

      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Request timeout set for",
          this.options.timeout || DEFAULT_TIMEOUT,
          "ms",
        );

      // Store the request with its callbacks
      this.pendingRequests.set(id, {
        resolve: (response) => {
          // Make sure we only resolve once
          if (this.pendingRequests.has(id)) {
            if (this.debug)
              console.log("[NIP46 CLIENT] Resolving request:", id);
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            resolve(response);
          }
        },
        reject: (error) => {
          // Make sure we only reject once
          if (this.pendingRequests.has(id)) {
            console.error("[NIP46 CLIENT] Rejecting request:", id, error);
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(error);
          }
        },
        timeout,
      });

      // Send the request
      if (this.debug)
        console.log("[NIP46 CLIENT] Sending encrypted request:", id);
      this.sendEncryptedRequest(request).catch((error) => {
        if (this.pendingRequests.has(id)) {
          console.error("[NIP46 CLIENT] Error sending request:", id, error);
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(
            error instanceof Error
              ? error
              : new NIP46ConnectionError(String(error)),
          );
        }
      });
    });
  }

  /**
   * Encrypt and send a request to the signer
   */
  private async sendEncryptedRequest(request: NIP46Request): Promise<void> {
    if (!this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const payload = JSON.stringify(request);
    let encryptedContent: string;

    if (this.debug) {
      console.log(
        "[NIP46 CLIENT] Encrypting request with method: nip44",
      );
    }

    // Use NIP-44 encryption only for security
    try {
      encryptedContent = encryptNIP44(
        payload,
        this.clientKeypair.privateKey,
        this.signerPubkey,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new NIP46EncryptionError(`NIP-44 encryption failed: ${errorMessage}`);
    }

    // Create the encrypted event
    const event: NostrEvent = {
      kind: 24133,
      pubkey: this.clientKeypair.publicKey,
      created_at: getUnixTime(),
      tags: [["p", this.signerPubkey]],
      content: encryptedContent,
      id: "",
      sig: "",
    };

    // Sign and publish the event
    if (this.debug) {
      console.log(
        "[NIP46 CLIENT] Publishing encrypted request:",
        JSON.stringify({
          kind: event.kind,
          pubkey: event.pubkey,
          created_at: event.created_at,
          tags: event.tags,
          hasContent: !!event.content,
        }),
      );
    }

    const signedEvent = await createSignedEvent(
      event,
      this.clientKeypair.privateKey,
    );
    await this.nostr.publishEvent(signedEvent);

    if (this.debug) {
      console.log("[NIP46 CLIENT] Request published successfully");
    }
  }

  /**
   * Handle a response from the signer
   */
  private async handleResponse(event: NostrEvent): Promise<void> {
    if (this.debug) {
      console.log("[NIP46 CLIENT] Received response event:", {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
        content_length: event.content.length,
      });
    }

    try {
      // If we're not connected or don't have a client keypair, ignore this event
      if (!this.clientKeypair) {
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Client not initialized, ignoring response",
          );
        return;
      }

      // Ensure the event is from our signer
      if (this.signerPubkey && event.pubkey !== this.signerPubkey) {
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Response not from our signer, ignoring. Expected:",
            this.signerPubkey,
            "Got:",
            event.pubkey,
          );
        return;
      }

      // Decrypt event content
      if (this.debug)
        console.log("[NIP46 CLIENT] Attempting to decrypt response");
      const decryptResult = await this.decryptContent(
        event.content,
        event.pubkey,
      );
      if (!decryptResult.success) {
        // Silently ignore decrypt failures - they might be for other clients
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] Failed to decrypt response:",
            decryptResult.error,
          );
        return;
      }

      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Decrypted with method:",
          decryptResult.method,
        );
      const data = decryptResult.data;
      if (this.debug) console.log("[NIP46 CLIENT] Decrypted data:", data);

      const response: NIP46Response = JSON.parse(data);
      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Parsed response:",
          JSON.stringify(response),
        );

      // Handle auth URL: open the auth URL in a popup or redirect
      if (response.auth_url) {
        if (this.debug)
          console.log("[NIP46 CLIENT] Auth URL detected:", response.auth_url);

        // Resolve the original request so callers can react to the challenge
        const pendingRequest = this.pendingRequests.get(response.id);
        if (pendingRequest) {
          pendingRequest.resolve(response);
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(response.id);
        }

        this.handleAuthChallenge(response);
        return;
      }

      // Find the corresponding request handler and call it
      const pendingRequest = this.pendingRequests.get(response.id);
      if (!pendingRequest) {
        // Response for a request that no longer exists or timed out
        if (this.debug)
          console.log(
            "[NIP46 CLIENT] No pending request found for ID:",
            response.id,
          );
        return;
      }

      if (this.debug)
        console.log(
          "[NIP46 CLIENT] Found pending request for ID:",
          response.id,
        );

      // Clear timeout and remove from pending requests
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(response.id);

      // Handle the response
      pendingRequest.resolve(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[NIP46 CLIENT] Error handling response:", errorMessage);
    }
  }

  /**
   * Decrypt content from the signer using NIP-44 only
   * @private
   */
  private async decryptContent(
    content: string,
    authorPubkey: string,
  ): Promise<NIP46EncryptionResult> {
    if (!this.clientKeypair) {
      return {
        success: false,
        error: "Client keypair not initialized",
        method: "nip44",
      };
    }

    // Use NIP-44 encryption only for security
    try {
      const decrypted = decryptNIP44(
        content,
        this.clientKeypair.privateKey,
        authorPubkey,
      );
      return {
        success: true,
        data: decrypted,
        method: "nip44",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `NIP-44 decryption failed: ${errorMessage}`,
        method: "nip44",
      };
    }
  }

  /**
   * Handle authentication challenge
   * @private
   */
  private handleAuthChallenge(response: NIP46Response): void {
    if (response.auth_url && typeof window !== "undefined") {
      // Open auth window if not already open
      if (!this.authWindow || this.authWindow.closed) {
        this.authWindow = window.open(response.auth_url, "_blank");
      }
    }
  }

  /**
   * Generate a nostrconnect:// URL to allow the signer to connect to the client
   */
  static generateConnectionString(
    clientPubkey: string,
    options: NIP46ClientOptions = {},
  ): string {
    if (!clientPubkey) {
      throw new NIP46ConnectionError("Client public key is required");
    }

    const params = new URLSearchParams();

    // Add required relays
    if (options.relays && options.relays.length > 0) {
      options.relays.forEach((relay) => params.append("relay", relay));
    }

    // Generate a random secret
    const secret =
      options.secret || Math.random().toString(36).substring(2, 10);
    params.append("secret", secret);

    // Add optional metadata
    if (options.name) params.append("name", options.name);
    if (options.url) params.append("url", options.url);
    if (options.image) params.append("image", options.image);

    // Add permissions
    if (options.permissions && options.permissions.length > 0) {
      params.append("perms", options.permissions.join(","));
    }

    return `nostrconnect://${clientPubkey}?${params.toString()}`;
  }
}
