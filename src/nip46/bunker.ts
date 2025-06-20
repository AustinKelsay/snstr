import { Nostr } from "../nip01/nostr";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { NostrEvent, NostrFilter } from "../types/nostr";
import { createSignedEvent } from "../nip01/event";
import { getUnixTime } from "../utils/time";
import { generateRequestId } from "./utils/request-response";
import {
  NIP46Method,
  NIP46Request,
  NIP46Response,
  NIP46BunkerOptions,
  NIP46AuthChallenge,
  NIP46Metadata,
  NIP46EncryptionResult,
  NIP46ClientSession,
  NIP46KeyPair,
  NIP46UnsignedEventData,
  NIP46ErrorCode,
  NIP46ErrorUtils,
} from "./types";
import { buildConnectionString } from "./utils/connection";
import { NIP46RateLimiter } from "./utils/rate-limiter";
import { NIP46SecurityValidator, securePermissionCheck } from "./utils/security";
import { Logger, LogLevel } from "./utils/logger";

export class NostrRemoteSignerBunker {
  private nostr: Nostr;
  private userKeypair: NIP46KeyPair;
  private signerKeypair: NIP46KeyPair;
  private options: NIP46BunkerOptions;
  private connectedClients: Map<string, NIP46ClientSession>;
  private pendingAuthChallenges: Map<string, NIP46AuthChallenge>;
  private subId: string | null;
  private logger: Logger;
  private rateLimiter: NIP46RateLimiter;
  private permissionHandler: ((clientPubkey: string, method: string, params: string[]) => boolean | null) | null = null;
  private usedRequestIds: Map<string, number> = new Map(); // Request ID -> timestamp
  private cleanupInterval: NodeJS.Timeout | null = null; // For cleanup interval management

  constructor(options: NIP46BunkerOptions) {
    this.options = options;
    this.nostr = new Nostr(options.relays || []);
    this.connectedClients = new Map();
    this.pendingAuthChallenges = new Map();
    this.subId = null;
    
    // Initialize logger
    this.logger = new Logger({
      level: options.debug ? LogLevel.DEBUG : LogLevel.INFO,
      prefix: "NIP46-BUNKER",
      includeTimestamp: true,
      silent: process.env.NODE_ENV === 'test' // Silent in test environment
    });

    // Initialize rate limiter
    this.rateLimiter = new NIP46RateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      burstSize: 10
    });

    // Validate bunker initialization
    NIP46SecurityValidator.validateBunkerInitialization({
      userPubkey: options.userPubkey,
      signerPubkey: options.signerPubkey
    });

    // Initialize keypairs with empty private keys (will be validated before use)
    this.userKeypair = {
      publicKey: options.userPubkey,
      privateKey: "",
    };

    // Initialize signer keypair - can be the same as user keypair
    // or a dedicated keypair for the signer
    this.signerKeypair = {
      publicKey: options.signerPubkey || options.userPubkey,
      privateKey: "",
    };

    this.logger.info("Bunker initialized", {
      userPubkey: options.userPubkey,
      signerPubkey: options.signerPubkey || options.userPubkey,
      relays: options.relays,
      defaultPermissions: options.defaultPermissions || "none"
    });
  }

  /**
   * Get the public key of the signer
   */
  getSignerPubkey(): string {
    return this.signerKeypair.publicKey;
  }

  public async start(): Promise<void> {
    this.logger.info("Starting bunker");

    // Validate that private keys are properly set before starting
    NIP46SecurityValidator.validateSecureInitialization({
      userKeypair: this.userKeypair,
      signerKeypair: this.signerKeypair
    });

    // Connect to relays
    await this.nostr.connectToRelays();
    this.logger.info("Connected to relays successfully");

    // Subscribe to requests
    const filter: NostrFilter = {
      kinds: [24133],
      "#p": [this.signerKeypair.publicKey],
    };

    // Clean up any existing subscription
    if (this.subId) {
      this.nostr.unsubscribe([this.subId]);
    }

    // Subscribe to incoming requests
    this.subId = this.nostr.subscribe([filter], (event: NostrEvent) =>
      this.handleRequest(event),
    )[0];

    // Publish metadata if needed
    if (this.options.metadata) {
      await this.publishMetadata(this.options.metadata);
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000).unref(); // Run cleanup every 1 minute for better security, don't keep process alive
  }

  public async stop(): Promise<void> {
    this.logger.info("Stopping bunker");

    // Clear the cleanup interval FIRST to prevent race conditions
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clean up subscription
    if (this.subId) {
      try {
        await this.nostr.unsubscribe([this.subId]);
        this.subId = null;
      } catch (error) {
        this.logger.error('Failed to unsubscribe', { error });
      }
    }

    // Disconnect from relays
    if (this.nostr) {
      try {
        await this.nostr.disconnectFromRelays();
      } catch (error) {
        this.logger.error('Failed to disconnect from relays', { error });
      }
    }

    // Clean up rate limiter
    try {
      this.rateLimiter.destroy();
    } catch (error) {
      this.logger.error('Failed to destroy rate limiter', { error });
    }

    // Clear all data structures
    this.connectedClients.clear();
    this.pendingAuthChallenges.clear();
    this.usedRequestIds.clear();
    
    this.logger.info("Bunker stopped successfully");
  }

  /**
   * Set the user's private key
   */
  setUserPrivateKey(privateKey: string): void {
    NIP46SecurityValidator.validatePrivateKeySecure(privateKey, "user private key");
    this.userKeypair.privateKey = privateKey;
    this.logger.debug("User private key set successfully");
  }

  /**
   * Set the signer's private key
   */
  setSignerPrivateKey(privateKey: string): void {
    NIP46SecurityValidator.validatePrivateKeySecure(privateKey, "signer private key");
    this.signerKeypair.privateKey = privateKey;
    this.logger.debug("Signer private key set successfully");
  }

  /**
   * Initialize both user and signer private keys
   */
  setPrivateKeys(userPrivateKey: string, signerPrivateKey?: string): void {
    this.setUserPrivateKey(userPrivateKey);
    this.setSignerPrivateKey(signerPrivateKey || userPrivateKey);
  }

  /**
   * Set a custom permission handler for advanced permission logic
   * @param handler - Function that takes (clientPubkey, method, params) and returns:
   *                  - true: Allow the operation
   *                  - false: Deny the operation
   *                  - null: Use default permission checking
   */
  setPermissionHandler(
    handler: (clientPubkey: string, method: string, params: string[]) => boolean | null
  ): void {
    this.permissionHandler = handler;
    this.logger.debug("Custom permission handler set");
  }

  /**
   * Remove the custom permission handler
   */
  clearPermissionHandler(): void {
    this.permissionHandler = null;
    this.logger.debug("Custom permission handler cleared");
  }

  /**
   * Check if a request ID has been used before (replay attack prevention)
   * @private
   */
  private isReplayAttack(requestId: string): boolean {
    const now = Date.now();
    const requestTime = this.usedRequestIds.get(requestId);
    
    if (requestTime !== undefined) {
      // This request ID has been seen before
      this.logger.warn("Replay attack detected", { 
        requestId,
        originalTime: new Date(requestTime).toISOString(),
        attemptTime: new Date(now).toISOString()
      });
      return true;
    }

    // Store the request ID with current timestamp
    this.usedRequestIds.set(requestId, now);
    
    return false;
  }

  /**
   * Clean up old request IDs to prevent memory leaks
   * @private
   */
  private cleanupOldRequestIds(): void {
    const now = Date.now();
    const maxAge = 120000; // 2 minutes - reduced from 1 hour for better security
    let cleaned = 0;

    for (const [requestId, timestamp] of this.usedRequestIds.entries()) {
      if (now - timestamp > maxAge) {
        this.usedRequestIds.delete(requestId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug("Cleaned up old request IDs", { count: cleaned });
    }
  }

  /**
   * Resolve an auth challenge by marking it as resolved
   * @param pubkey The client pubkey that completed authentication
   * @returns true if the challenge was found and resolved, false otherwise
   */
  resolveAuthChallenge(pubkey: string): boolean {
    for (const [challengeId, challenge] of this.pendingAuthChallenges.entries()) {
      if (challenge.clientPubkey === pubkey) {
        this.pendingAuthChallenges.delete(challengeId);
        
        // Create client session with permissions from the challenge
        const permissions = new Set([
          ...(this.options.defaultPermissions || []),
          ...(challenge.permissions || [])
        ]);

        this.connectedClients.set(pubkey, {
          permissions,
          lastSeen: Date.now()
        });
        
        this.logger.info("Auth challenge resolved and client session created", { 
          challengeId,
          clientPubkey: pubkey,
          permissions: Array.from(permissions)
        });
        return true;
      }
    }
    
    this.logger.warn("Auth challenge resolution failed - no pending challenge found", {
      clientPubkey: pubkey
    });
    return false;
  }

  /**
   * Create an auth challenge for a client
   * @param clientPubkey The client's public key
   * @param permissions The permissions being requested
   * @returns The auth challenge object
   */
  private createAuthChallenge(clientPubkey: string, permissions?: string[]): NIP46AuthChallenge {
    const challenge: NIP46AuthChallenge = {
      id: generateRequestId(),
      clientPubkey,
      timestamp: Date.now(),
      permissions,
    };

    this.pendingAuthChallenges.set(challenge.id, challenge);

    // Set timeout to clean up challenge
    setTimeout(() => {
      if (this.pendingAuthChallenges.has(challenge.id)) {
        this.pendingAuthChallenges.delete(challenge.id);
        this.logger.warn("Auth challenge expired", { 
          challengeId: challenge.id,
          clientPubkey
        });
      }
    }, this.options.authTimeout || 300000).unref(); // 5 minutes default

    this.logger.debug("Auth challenge created", {
      challengeId: challenge.id,
      clientPubkey,
      permissions
    });

    return challenge;
  }

  /**
   * Periodic cleanup of expired data
   */
  private cleanup(): void {
    this.cleanupOldRequestIds();
    
    // Clean up expired auth challenges
    const now = Date.now();
    const authTimeout = this.options.authTimeout || 300000; // 5 minutes
    
    for (const [challengeId, challenge] of this.pendingAuthChallenges.entries()) {
      if (now - challenge.timestamp > authTimeout) {
        this.pendingAuthChallenges.delete(challengeId);
        this.logger.debug("Expired auth challenge cleaned up", {
          challengeId,
          clientPubkey: challenge.clientPubkey
        });
      }
    }
  }

  /**
   * Handle incoming request events
   * @private
   */
  private async handleRequest(event: NostrEvent): Promise<void> {
    try {
      const clientPubkey = event.pubkey;
      
      this.logger.debug("Received request event", {
        eventId: event.id,
        clientPubkey,
        eventKind: event.kind
      });

      // Check rate limiting FIRST - Critical DoS protection
      const rateLimitResult = this.rateLimiter.isAllowed(clientPubkey);
      if (!rateLimitResult.allowed) {
        this.logger.warn("Request rate limited", {
          clientPubkey,
          retryAfter: rateLimitResult.retryAfter,
          remainingRequests: rateLimitResult.remainingRequests
        });
        
        // Send rate limit error response
        await this.sendResponse(
          clientPubkey, 
          "unknown", // We don't have the request ID yet
          null, 
          NIP46ErrorUtils.getErrorDescription(NIP46ErrorCode.RATE_LIMITED) + 
          (rateLimitResult.retryAfter ? ` Retry after ${rateLimitResult.retryAfter} seconds.` : "")
        );
        return;
      }

      // Decrypt and parse the request
      const decryptResult = await this.decryptContent(event.content, clientPubkey);
      if (!decryptResult.success) {
        this.logger.error("Failed to decrypt request", {
          clientPubkey,
          error: decryptResult.error
        });
        return;
      }

      let request: NIP46Request;
      try {
        request = JSON.parse(decryptResult.data!) as NIP46Request;
      } catch (error) {
        this.logger.error("Failed to parse request JSON", {
          clientPubkey,
          error: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      // Validate request structure
      if (!request.id || !request.method) {
        this.logger.error("Invalid request structure", {
          clientPubkey,
          hasId: !!request.id,
          hasMethod: !!request.method
        });
        return;
      }

      // Check for replay attacks
      if (this.isReplayAttack(request.id)) {
        this.logger.warn("Ignoring replay attack", { 
          requestId: request.id,
          clientPubkey
        });
        return;
      }

      // Route the request to the appropriate handler
      let response: NIP46Response;
      
      const method = request.method;
      this.logger.debug("Processing request", {
        requestId: request.id,
        method,
        clientPubkey,
        paramsCount: request.params?.length || 0
      });

      switch (method) {
        case NIP46Method.CONNECT:
          response = await this.handleConnect(request, clientPubkey);
          break;
        case NIP46Method.SIGN_EVENT:
          response = await this.handleSignEvent(request, clientPubkey);
          break;
        case NIP46Method.GET_PUBLIC_KEY:
          response = await this.handleGetPublicKey(request);
          break;
        case NIP46Method.PING:
          response = { id: request.id, result: "pong" };
          break;
        case NIP46Method.DISCONNECT:
          response = await this.handleDisconnect(request, clientPubkey);
          break;
        case NIP46Method.NIP04_ENCRYPT:
        case NIP46Method.NIP04_DECRYPT:
        case NIP46Method.NIP44_ENCRYPT:
        case NIP46Method.NIP44_DECRYPT:
          response = await this.handleEncryption(request, clientPubkey);
          break;
        default:
          this.logger.warn("Unknown method requested", { method, clientPubkey });
          response = NIP46ErrorUtils.createErrorResponse(
            request.id,
            NIP46ErrorCode.METHOD_NOT_SUPPORTED,
            `Method ${method} is not supported`
          );
      }

      // Send the response back to the client
      await this.sendResponse(
        clientPubkey,
        response.id,
        response.result || null,
        response.error,
        response.auth_url
      );

    } catch (error) {
      this.logger.error("Error handling request", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id,
        clientPubkey: event.pubkey
      });
    }
  }

  /**
   * Handle connect requests
   * @private
   */
  private async handleConnect(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    try {
      const [remotePubkey, secret, permissionsString] = request.params;
      
      this.logger.debug("Processing connect request", {
        requestId: request.id,
        clientPubkey,
        remotePubkey,
        hasSecret: !!secret,
        permissions: permissionsString
      });

      // Validate that the remote pubkey matches our signer pubkey
      if (remotePubkey !== this.signerKeypair.publicKey) {
        this.logger.warn("Connect request with wrong pubkey", {
          requestId: request.id,
          clientPubkey,
          expectedPubkey: this.signerKeypair.publicKey,
          providedPubkey: remotePubkey
        });
        return NIP46ErrorUtils.createErrorResponse(
          request.id,
          NIP46ErrorCode.CONNECTION_REJECTED,
          "Remote pubkey does not match signer pubkey"
        );
      }

      // Check secret if required
      if (this.options.secret && secret !== this.options.secret) {
        this.logger.warn("Connect request with invalid secret", {
          requestId: request.id,
          clientPubkey
        });
        return NIP46ErrorUtils.createErrorResponse(
          request.id,
          NIP46ErrorCode.INVALID_SECRET,
          "Invalid secret provided"
        );
      }

      // Parse requested permissions
      const requestedPermissions = permissionsString
        ? permissionsString.split(",").map(p => p.trim()).filter(p => p)
        : [];

      // Handle authentication challenges if required
      if (this.options.requireAuthChallenge && !this.isClientAuthorized(clientPubkey)) {
        const authChallenge = this.createAuthChallenge(clientPubkey, requestedPermissions);
        const authUrl = this.options.authUrl || "https://example.com/auth";
        
        this.logger.info("Auth challenge required for connection", {
          requestId: request.id,
          clientPubkey,
          challengeId: authChallenge.id
        });
        
        return {
          id: request.id,
          result: "auth_required",
          auth_url: `${authUrl}?challenge=${authChallenge.id}&pubkey=${clientPubkey}`
        };
      }

      // Create client session with permissions
      const permissions = new Set([
        ...(this.options.defaultPermissions || []),
        ...requestedPermissions
      ]);

      this.connectedClients.set(clientPubkey, {
        permissions,
        lastSeen: Date.now()
      });

      this.logger.info("Client connected successfully", { 
        clientPubkey,
        permissions: Array.from(permissions)
      });

      return {
        id: request.id,
        result: "ack"
      };

    } catch (error) {
      this.logger.error("Error in connect handler", {
        requestId: request.id,
        clientPubkey,
        error: error instanceof Error ? error.message : String(error)
      });
      return NIP46ErrorUtils.createErrorResponse(
        request.id,
        NIP46ErrorCode.INTERNAL_ERROR,
        "Internal error during connection"
      );
    }
  }

  /**
   * Handle event signing requests
   * @private
   */
  private async handleSignEvent(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    try {
      // Check if client is connected and has permission
      if (!this.hasPermission(clientPubkey, "sign_event", request.method, request.params)) {
        this.logger.warn("Sign event permission denied", {
          requestId: request.id,
          clientPubkey
        });
        return NIP46ErrorUtils.createErrorResponse(
          request.id,
          NIP46ErrorCode.PERMISSION_DENIED,
          "Permission denied for signing events"
        );
      }

      const [eventDataJson] = request.params;
      let eventData: NIP46UnsignedEventData;

      try {
        eventData = JSON.parse(eventDataJson);
      } catch (error) {
        this.logger.error("Invalid event data JSON", {
          requestId: request.id,
          clientPubkey,
          error: error instanceof Error ? error.message : String(error)
        });
        return NIP46ErrorUtils.createErrorResponse(
          request.id,
          NIP46ErrorCode.INVALID_PARAMETERS,
          "Invalid event data format"
        );
      }

      // Security validation before signing
      NIP46SecurityValidator.validateBeforeSigning(this.userKeypair, eventData);

      // Create and sign the event
      const signedEvent = await createSignedEvent(
        {
          ...eventData,
          pubkey: this.userKeypair.publicKey, // Add missing pubkey field
          tags: eventData.tags || [], // Ensure tags is always an array
        },
        this.userKeypair.privateKey
      );

      this.logger.info("Event signed successfully", {
        requestId: request.id,
        clientPubkey,
        eventKind: eventData.kind,
        eventId: signedEvent.id
      });

      return {
        id: request.id,
        result: JSON.stringify(signedEvent)
      };

    } catch (error) {
      this.logger.error("Error signing event", {
        requestId: request.id,
        clientPubkey,
        error: error instanceof Error ? error.message : String(error)
      });
      return NIP46ErrorUtils.createErrorResponse(
        request.id,
        NIP46ErrorCode.SIGNING_FAILED,
        error instanceof Error ? error.message : "Event signing failed"
      );
    }
  }

  /**
   * Handle get public key requests
   * @private
   */
  private async handleGetPublicKey(
    request: NIP46Request,
  ): Promise<NIP46Response> {
    return {
      id: request.id,
      result: this.userKeypair.publicKey
    };
  }

  /**
   * Handle disconnect requests
   * @private
   */
  private async handleDisconnect(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    this.connectedClients.delete(clientPubkey);
    this.logger.info("Client disconnected", { clientPubkey });

    return {
      id: request.id,
      result: "ack"
    };
  }

  /**
   * Handle encryption/decryption requests
   * @private
   */
  private async handleEncryption(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    try {
      const method = request.method;
      const [thirdPartyPubkey, data] = request.params;

      // Check permissions
      if (!this.hasPermission(clientPubkey, method)) {
        this.logger.warn("Encryption permission denied", {
          requestId: request.id,
          clientPubkey,
          method
        });
        return NIP46ErrorUtils.createErrorResponse(
          request.id,
          NIP46ErrorCode.PERMISSION_DENIED,
          `Permission denied for ${method}`
        );
      }

      let result: string;

      switch (method) {
        case NIP46Method.NIP44_ENCRYPT:
          NIP46SecurityValidator.validateBeforeEncryption(
            this.userKeypair, 
            thirdPartyPubkey, 
            data, 
            "NIP-44"
          );
          result = await encryptNIP44(data, this.userKeypair.privateKey, thirdPartyPubkey);
          break;

        case NIP46Method.NIP44_DECRYPT:
          NIP46SecurityValidator.validateBeforeDecryption(
            this.userKeypair, 
            thirdPartyPubkey, 
            data, 
            "NIP-44"
          );
          result = await decryptNIP44(data, this.userKeypair.privateKey, thirdPartyPubkey);
          break;

        case NIP46Method.NIP04_ENCRYPT:
          NIP46SecurityValidator.validateBeforeEncryption(
            this.userKeypair, 
            thirdPartyPubkey, 
            data, 
            "NIP-04"
          );
          result = await encryptNIP04(data, this.userKeypair.privateKey, thirdPartyPubkey);
          break;

        case NIP46Method.NIP04_DECRYPT:
          NIP46SecurityValidator.validateBeforeDecryption(
            this.userKeypair, 
            thirdPartyPubkey, 
            data, 
            "NIP-04"
          );
          result = await decryptNIP04(data, this.userKeypair.privateKey, thirdPartyPubkey);
          break;

        default:
          return NIP46ErrorUtils.createErrorResponse(
            request.id,
            NIP46ErrorCode.METHOD_NOT_SUPPORTED,
            `Encryption method ${method} not supported`
          );
      }

      this.logger.debug("Encryption operation completed", {
        requestId: request.id,
        clientPubkey,
        method,
        thirdPartyPubkey
      });

      return {
        id: request.id,
        result
      };

    } catch (error) {
      this.logger.error("Encryption operation failed", {
        requestId: request.id,
        clientPubkey,
        method: request.method,
        error: error instanceof Error ? error.message : String(error)
      });
      return NIP46ErrorUtils.createErrorResponse(
        request.id,
        NIP46ErrorCode.ENCRYPTION_FAILED,
        error instanceof Error ? error.message : "Encryption operation failed"
      );
    }
  }

  /**
   * Send a response back to the client
   * @private
   */
  private async sendResponse(
    clientPubkey: string,
    id: string,
    result: string | null = null,
    error?: string,
    auth_url?: string,
  ): Promise<void> {
    try {
      const response: NIP46Response = {
        id,
        result: result || undefined,
        error,
        auth_url,
      };

      const responseJson = JSON.stringify(response);
      const encryptedContent = await encryptNIP44(
        responseJson,
        this.signerKeypair.privateKey,
        clientPubkey
      );

      const responseEvent: NostrEvent = await createSignedEvent(
        {
          kind: 24133,
          pubkey: this.signerKeypair.publicKey,
          content: encryptedContent,
          created_at: getUnixTime(),
          tags: [["p", clientPubkey]],
        },
        this.signerKeypair.privateKey
      );

      await this.nostr.publishEvent(responseEvent);
      
      this.logger.debug("Response sent to client", {
        responseId: id,
        clientPubkey,
        hasResult: !!result,
        hasError: !!error,
        hasAuthUrl: !!auth_url
      });

    } catch (error) {
      this.logger.error("Failed to send response", {
        responseId: id,
        clientPubkey,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if a client is authorized (has completed auth challenge)
   * @private
   */
  private isClientAuthorized(clientPubkey: string): boolean {
    return this.connectedClients.has(clientPubkey);
  }

  getConnectionString(): string {
    return buildConnectionString({
      pubkey: this.signerKeypair.publicKey,
      relays: this.options.relays || [],
      secret: this.options.secret,
    });
  }

  /**
   * Publish bunker metadata to relays
   */
  async publishMetadata(
    metadata: NIP46Metadata,
  ): Promise<NostrEvent | undefined> {
    try {
      // Validate that we have a private key for publishing
      NIP46SecurityValidator.validateKeypairForCrypto(this.signerKeypair, "signer keypair");

      const metadataEvent: NostrEvent = await createSignedEvent(
        {
          kind: 0,
          pubkey: this.signerKeypair.publicKey,
          content: JSON.stringify({
            name: metadata.name,
            about: "NIP-46 Remote Signer",
            picture: metadata.image,
            nip05: metadata.url,
          }),
          created_at: getUnixTime(),
          tags: [],
        },
        this.signerKeypair.privateKey
      );

      await this.nostr.publishEvent(metadataEvent);
      this.logger.info("Metadata published successfully");
      return metadataEvent;
    } catch (error) {
      this.logger.error("Failed to publish metadata", {
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  /**
   * Decrypt content from a client
   * @private
   */
  private async decryptContent(
    content: string,
    authorPubkey: string,
  ): Promise<NIP46EncryptionResult> {
    try {
      // Validate before decryption
      NIP46SecurityValidator.validateBeforeDecryption(
        this.signerKeypair,
        authorPubkey,
        content,
        "NIP-44"
      );

      const decrypted = await decryptNIP44(
        content,
        this.signerKeypair.privateKey,
        authorPubkey
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

  private hasPermission(clientPubkey: string, permission: string, method?: string, params?: string[]): boolean {
    // Check if client is connected
    const session = this.connectedClients.get(clientPubkey);
    if (!session) {
      this.logger.warn("Permission check failed - client not connected", {
        clientPubkey,
        permission
      });
      return false;
    }

    // Update last seen
    session.lastSeen = Date.now();

    // Check custom permission handler first
    if (this.permissionHandler && method && params) {
      const customResult = this.permissionHandler(clientPubkey, method, params);
      if (customResult !== null) {
        this.logger.debug("Custom permission handler result", {
          clientPubkey,
          method,
          permission,
          result: customResult
        });
        return customResult;
      }
    }

    // Check basic permission using secure comparison to prevent timing attacks
    if (securePermissionCheck(session.permissions, permission)) {
      return true;
    }

    // Check method-specific permissions for signing
    if (permission === "sign_event" && params && params.length > 0) {
      try {
        const eventData = JSON.parse(params[0]);
        const kindPermission = `sign_event:${eventData.kind}`;
        if (securePermissionCheck(session.permissions, kindPermission)) {
          return true;
        }
      } catch (error) {
        this.logger.error("Failed to parse event data for permission check", {
          clientPubkey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.debug("Permission denied", {
      clientPubkey,
      permission,
      availablePermissions: Array.from(session.permissions)
    });
    return false;
  }
}
