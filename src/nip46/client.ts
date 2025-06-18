import { Nostr } from "../nip01/nostr";
import { generateKeypair } from "../utils/crypto";
import { getUnixTime } from "../utils/time";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { NostrEvent, NostrFilter } from "../types/nostr";
import { createSignedEvent } from "../nip01/event";
import { parseConnectionString } from "./utils/connection";
import { Logger, LogLevel } from "./utils/logger";
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
  private logger: Logger;
  private debug: boolean;
  private pendingAuthChallenges = new Map<string, {
    originalRequestId: string;
    authUrl: string;
    timeout: NodeJS.Timeout;
    timestamp: number;
  }>();

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
    
    // Initialize logger
    this.logger = new Logger({
      level: options.debug ? LogLevel.DEBUG : LogLevel.INFO,
      prefix: "NIP46-CLIENT",
      includeTimestamp: true,
      silent: process.env.NODE_ENV === 'test' // Silent in test environment
    });
  }

  /**
   * Set up subscription to receive responses from the signer
   */
  private async setupSubscription(): Promise<void> {
    this.logger.debug("Setting up subscription");

    if (this.subId) {
      this.logger.debug("Cleaning up previous subscription", { subId: this.subId });
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

    this.logger.debug("Subscribing with filter", {
      filter: JSON.stringify(filter),
      clientPubkey: this.clientKeypair.publicKey
    });

    this.subId = this.nostr.subscribe([filter], (event) =>
      this.handleResponse(event),
    )[0];

    this.logger.debug("Subscription created", { subId: this.subId });
  }

  /**
   * Clean up resources and reset state
   */
  private async cleanup(): Promise<void> {
    if (this.subId) {
      try {
        await this.nostr.unsubscribe([this.subId]); // FIX: Add await to prevent race condition
        this.subId = null;
      } catch (error) {
        this.logger.error('Unsubscription failed', { error });
      }
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

    // Clean up pending auth challenges
    this.pendingAuthChallenges.forEach((challenge) => {
      clearTimeout(challenge.timeout);
    });
    this.pendingAuthChallenges.clear();

    // Close auth window if open
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }

  /**
   * Connect to a remote signer
   * @throws {Error} If connection fails or validation fails
   * @returns {string} "ack" or required secret value (NOT the user pubkey)
   */
  public async connect(connectionString: string): Promise<string> {
    this.logger.info("Connecting to signer", { connectionString });
    try {
      // Generate client keypair if needed
      if (!this.clientKeypair) {
        this.clientKeypair = await generateKeypair();
        this.logger.debug("Generated client keypair", { 
          publicKey: this.clientKeypair.publicKey 
        });
      }

      // Connect to relays
      this.logger.debug("Connecting to relays", { relays: this.options.relays });
      await this.nostr.connectToRelays();
      this.logger.info("Connected to relays");

      // Parse connection info
      const connectionInfo = parseConnectionString(connectionString);
      this.signerPubkey = connectionInfo.pubkey;
      this.logger.info("Parsed connection info", {
        signerPubkey: this.signerPubkey,
        type: connectionInfo.type,
        relays: connectionInfo.relays,
        hasSecret: !!connectionInfo.secret
      });

             // Connect to signer's relays if provided
       if (connectionInfo.relays?.length) {
         this.logger.debug("Connecting to signer relays", { 
           relays: connectionInfo.relays 
         });
         // Create a new Nostr instance with combined relays
         const allRelays = [
           ...(this.options.relays || []),
           ...connectionInfo.relays,
         ];
         this.nostr = new Nostr(Array.from(new Set(allRelays)));
         await this.nostr.connectToRelays();
         this.logger.info("Connected to combined relays");
       }

      // Set up subscription to receive responses
      await this.setupSubscription();

      // Send connect request
      const params = [this.signerPubkey];
      if (connectionInfo.secret) {
        params.push(connectionInfo.secret);
      }
      if (connectionInfo.permissions?.length) {
        params.push(connectionInfo.permissions.join(","));
      }

      const response = await this.sendRequest(NIP46Method.CONNECT, params);

      if (response.error) {
        throw new NIP46ConnectionError(`Connection failed: ${response.error}`);
      }

      // SPEC COMPLIANCE: connect() returns "ack" or secret, NOT user pubkey
      this.connected = true;
      this.logger.info("Connected to signer successfully", {
        signerPubkey: this.signerPubkey,
        connectResult: response.result
      });

      // Return the connect result (should be "ack" or secret)
      return response.result || "ack";
    } catch (error) {
      await this.cleanup();
      if (error instanceof NIP46Error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new NIP46ConnectionError(`Failed to connect: ${message}`);
    }
  }

  /**
   * Disconnect from the remote signer
   */
  public async disconnect(): Promise<void> {
    this.logger.info("Disconnecting from signer");
    try {
      if (this.connected && this.signerPubkey) {
        this.logger.debug("Sending disconnect request");
        await this.sendRequest(NIP46Method.DISCONNECT, []);
        this.logger.info("Disconnect request sent");
      }
    } catch (error) {
      this.logger.error("Error during disconnect", { 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      await this.cleanup();
      this.logger.info("Client cleanup completed");
    }
  }

  /**
   * Sign an event
   * @throws {Error} If signing fails
   */
  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent> {
    this.logger.debug("Signing event", { eventData });

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData),
    ]);

    if (response.error) {
      this.logger.error("Event signing failed", { error: response.error });
      throw new NIP46SigningError(`Event signing failed: ${response.error}`);
    }

    const signedEvent = JSON.parse(response.result!);
    this.logger.info("Event signed successfully", { eventId: signedEvent.id });
    return signedEvent;
  }

  /**
   * Get the user's public key (must be called after connect())
   * This is required by NIP-46 spec - clients must differentiate between
   * remote-signer-pubkey and user-pubkey
   */
  public async getUserPublicKey(): Promise<string> {
    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    if (this.userPubkey) {
      return this.userPubkey;
    }

    this.logger.debug("Getting user public key from signer");
    const response = await this.sendRequest(NIP46Method.GET_PUBLIC_KEY, []);

    if (response.error) {
      throw new NIP46ConnectionError(`Failed to get public key: ${response.error}`);
    }

    this.userPubkey = response.result!;
    this.logger.info("User public key retrieved", { userPubkey: this.userPubkey });

    return this.userPubkey;
  }

  /**
   * @deprecated Use getUserPublicKey() instead. This method name doesn't clearly
   * indicate it's getting the USER's public key, not the signer's public key.
   */
  async getPublicKey(): Promise<string> {
    return this.getUserPublicKey();
  }

  /**
   * Ping the signer
   * @throws {Error} If ping fails
   */
  async ping(): Promise<string> {
    this.logger.debug("Sending ping");

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.PING, []);

    if (response.error) {
      this.logger.error("Ping failed", { error: response.error });
      throw new NIP46Error(`Ping failed: ${response.error}`);
    }

    this.logger.debug("Ping successful", { result: response.result });
    return response.result!;
  }

  /**
   * Encrypt data with NIP-44
   * @throws {Error} If encryption fails
   */
  async nip44Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    this.logger.debug("NIP-44 encryption request", { thirdPartyPubkey });

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP44_ENCRYPT, [
      thirdPartyPubkey,
      plaintext,
    ]);

    if (response.error) {
      this.logger.error("NIP-44 encryption failed", { error: response.error });
      throw new NIP46EncryptionError(
        `NIP-44 encryption failed: ${response.error}`,
      );
    }

    this.logger.debug("NIP-44 encryption successful");
    return response.result!;
  }

  /**
   * Decrypt data with NIP-44
   * @throws {Error} If decryption fails
   */
  async nip44Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    this.logger.debug("NIP-44 decryption request", { thirdPartyPubkey });

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP44_DECRYPT, [
      thirdPartyPubkey,
      ciphertext,
    ]);

    if (response.error) {
      this.logger.error("NIP-44 decryption failed", { error: response.error });
      throw new NIP46DecryptionError(
        `NIP-44 decryption failed: ${response.error}`,
      );
    }

    this.logger.debug("NIP-44 decryption successful");
    return response.result!;
  }

  /**
   * Get relay list
   * @throws {Error} If request fails
   */
  async getRelays(): Promise<string[]> {
    this.logger.debug("Getting relay list");

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.GET_RELAYS, []);

    if (response.error) {
      this.logger.error("Get relays failed", { error: response.error });
      throw new NIP46Error(`Get relays failed: ${response.error}`);
    }

    const relays = JSON.parse(response.result!);
    this.logger.debug("Relay list retrieved", { relays });
    return relays;
  }

  /**
   * Encrypt data with NIP-04
   * @throws {Error} If encryption fails
   */
  async nip04Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    this.logger.debug("NIP-04 encryption request", { thirdPartyPubkey });

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP04_ENCRYPT, [
      thirdPartyPubkey,
      plaintext,
    ]);

    if (response.error) {
      this.logger.error("NIP-04 encryption failed", { error: response.error });
      throw new NIP46EncryptionError(
        `NIP-04 encryption failed: ${response.error}`,
      );
    }

    this.logger.debug("NIP-04 encryption successful");
    return response.result!;
  }

  /**
   * Decrypt data with NIP-04
   * @throws {Error} If decryption fails
   */
  async nip04Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    this.logger.debug("NIP-04 decryption request", { thirdPartyPubkey });

    if (!this.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }

    const response = await this.sendRequest(NIP46Method.NIP04_DECRYPT, [
      thirdPartyPubkey,
      ciphertext,
    ]);

    if (response.error) {
      this.logger.error("NIP-04 decryption failed", { error: response.error });
      throw new NIP46DecryptionError(
        `NIP-04 decryption failed: ${response.error}`,
      );
    }

    this.logger.debug("NIP-04 decryption successful");
    return response.result!;
  }

  /**
   * Send a request to the signer and wait for response
   * @private
   */
  private async sendRequest(
    method: NIP46Method,
    params: string[],
  ): Promise<NIP46Response> {
    const id = this.generateRequestId();
    const request: NIP46Request = { id, method, params };

    this.logger.debug("Sending request", { requestId: id, method, params });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.logger.error("Request timeout", { requestId: id, method });
        reject(new NIP46TimeoutError(`Request ${id} timed out`));
      }, this.options.timeout);

      // Use unref to prevent this timeout from keeping the process alive
      timeout.unref();

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sendEncryptedRequest(request).catch((error) => {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        this.logger.error("Failed to send encrypted request", { 
          requestId: id, 
          error: error instanceof Error ? error.message : String(error) 
        });
        reject(error);
      });
    });
  }

  /**
   * Send encrypted request to signer
   * @private
   */
  private async sendEncryptedRequest(request: NIP46Request): Promise<void> {
    if (!this.clientKeypair || !this.signerPubkey) {
      throw new NIP46ConnectionError("Client keypair or signer pubkey not set");
    }

    try {
      const requestJson = JSON.stringify(request);
      const encryptedContent = await encryptNIP44(
        requestJson,
        this.clientKeypair.privateKey,
        this.signerPubkey,
      );

      const requestEvent: NostrEvent = await createSignedEvent(
        {
          kind: 24133,
          content: encryptedContent,
          created_at: getUnixTime(),
          tags: [["p", this.signerPubkey]],
          pubkey: this.clientKeypair.publicKey, // Add missing pubkey field
        },
        this.clientKeypair.privateKey,
      );

      await this.nostr.publishEvent(requestEvent);
      this.logger.debug("Encrypted request sent", { requestId: request.id });

    } catch (error) {
      this.logger.error("Failed to send encrypted request", { 
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new NIP46ConnectionError(
        `Failed to send request: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle incoming response from signer
   * @private
   */
  private async handleResponse(event: NostrEvent): Promise<void> {
    this.logger.debug("Received response event", { eventId: event.id });

    try {
      // Decrypt the response
      const decryptResult = await this.decryptContent(event.content, event.pubkey);

      if (!decryptResult.success) {
        this.logger.error("Failed to decrypt response", { 
          error: decryptResult.error,
          eventId: event.id 
        });
        return;
      }

      this.logger.debug("Decrypted response data", { data: decryptResult.data });

      let response: NIP46Response;
      try {
        response = JSON.parse(decryptResult.data!);
        this.logger.debug("Parsed response", { response });
      } catch (error) {
        this.logger.error("Failed to parse response JSON", { 
          error: error instanceof Error ? error.message : String(error),
          data: decryptResult.data 
        });
        return;
      }

      // Handle pending request
      const pendingRequest = this.pendingRequests.get(response.id);
      if (pendingRequest) {
        this.logger.debug("Resolving pending request", { requestId: response.id });
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(response.id);
        pendingRequest.resolve(response);
      } else {
        this.logger.warn("Received response for unknown request", { 
          requestId: response.id 
        });
      }

    } catch (error) {
      this.logger.error("Error handling response", { 
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Decrypt response content
   * @private
   */
  private async decryptContent(
    content: string,
    authorPubkey: string,
  ): Promise<NIP46EncryptionResult> {
    if (!this.clientKeypair) {
      return {
        success: false,
        method: "nip44",
        error: "Client keypair not available",
      };
    }

    try {
      this.logger.debug("Attempting NIP-44 decryption", { authorPubkey });
      const decrypted = await decryptNIP44(
        content,
        this.clientKeypair.privateKey,
        authorPubkey,
      );

      return {
        success: true,
        method: "nip44",
        data: decrypted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error("NIP-44 decryption failed", { 
        error: errorMessage,
        authorPubkey 
      });
      return {
        success: false,
        method: "nip44",
        error: errorMessage,
      };
    }
  }

  /**
   * Handle auth challenge from signer
   * @private
   */
  private handleAuthChallenge(response: NIP46Response): void {
    if (!response.auth_url) {
      this.logger.error("Auth challenge missing auth_url");
      return;
    }

    // Validate auth URL
    if (!this.isValidAuthUrl(response.auth_url)) {
      this.logger.error("Invalid auth URL received", { authUrl: response.auth_url });
      return;
    }

    const requestId = response.id;
    this.logger.info("Handling auth challenge", { 
      requestId, 
      authUrl: response.auth_url 
    });

    // Store the auth challenge
    const timeout = setTimeout(() => {
      this.handleAuthTimeout(requestId);
    }, this.options.timeout || DEFAULT_TIMEOUT);
    
    timeout.unref();

    this.pendingAuthChallenges.set(requestId, {
      originalRequestId: requestId,
      authUrl: response.auth_url,
      timeout,
      timestamp: Date.now()
    });

    // For browser environment, open the auth URL
    if (typeof window !== 'undefined') {
      this.authWindow = window.open(response.auth_url, '_blank', 'width=600,height=700');
      if (this.authWindow) {
        this.monitorAuthWindow(requestId);
      } else {
        this.logger.error("Failed to open auth window");
      }
    } else {
      this.logger.info("Auth URL for manual opening", { authUrl: response.auth_url });
    }
  }

  /**
   * Validate if an auth URL is safe to open
   * @private
   */
  private isValidAuthUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTPS URLs for security
      if (parsed.protocol !== 'https:') {
        this.logger.warn("Auth URL must use HTTPS", { url });
        return false;
      }

      // Basic hostname validation
      if (!parsed.hostname || parsed.hostname.length < 3) {
        this.logger.warn("Invalid hostname in auth URL", { url });
        return false;
      }

      // Prevent potential XSS in URL
      if (url.includes('<') || url.includes('>') || url.includes('"') || url.includes("'")) {
        this.logger.warn("Auth URL contains dangerous characters", { url });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Failed to parse auth URL", { 
        url, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Monitor auth window for completion
   * @private
   */
  private monitorAuthWindow(requestId: string): void {
    if (!this.authWindow) return;

    const checkClosed = () => {
      if (this.authWindow?.closed) {
        this.logger.info("Auth window closed", { requestId });
        this.authWindow = null;
        
        // Clean up the auth challenge
        const challenge = this.pendingAuthChallenges.get(requestId);
        if (challenge) {
          clearTimeout(challenge.timeout);
          this.pendingAuthChallenges.delete(requestId);
        }
      } else {
        // Check again in 1 second
        setTimeout(checkClosed, 1000);
      }
    };

    checkClosed();
  }

  /**
   * Handle auth timeout
   * @private
   */
  private handleAuthTimeout(requestId: string): void {
    this.logger.error("Auth challenge timed out", { requestId });
    
    const challenge = this.pendingAuthChallenges.get(requestId);
    if (challenge) {
      this.pendingAuthChallenges.delete(requestId);
      
      // Close auth window if open
      if (this.authWindow && !this.authWindow.closed) {
        this.authWindow.close();
        this.authWindow = null;
      }
    }

    // Reject the original request
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(requestId);
      pendingRequest.reject(new NIP46TimeoutError("Auth challenge timed out"));
    }
  }

  /**
   * Generate a unique request ID
   * @private
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate a connection string for this client
   * @static
   */
  static generateConnectionString(
    clientPubkey: string,
    options: NIP46ClientOptions = {},
  ): string {
    // Validate pubkey
    if (!clientPubkey || clientPubkey.trim() === "") {
      throw new NIP46ConnectionError("Client pubkey cannot be empty");
    }
    
    const params = new URLSearchParams();
    
    if (options.relays?.length) {
      options.relays.forEach(relay => params.append("relay", relay));
    }
    
    // Always include a secret if not provided
    const secret = options.secret || Math.random().toString(36).substring(2, 15);
    params.append("secret", secret);
    
    if (options.permissions?.length) {
      params.append("perms", options.permissions.join(","));
    }
    
    if (options.name) {
      params.append("name", options.name);
    }
    
    if (options.url) {
      params.append("url", options.url);
    }
    
    if (options.image) {
      params.append("image", options.image);
    }

    const queryString = params.toString();
    return `nostrconnect://${clientPubkey}?${queryString}`;
  }
}

