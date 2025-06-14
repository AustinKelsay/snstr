import { Nostr } from "../nip01/nostr";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { NostrEvent, NostrFilter } from "../types/nostr";
import { createSignedEvent } from "../nip01/event";
import { getUnixTime } from "../utils/time";
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
  NIP46ConnectionError,
  NIP46EncryptionError,
} from "./types";
import { buildConnectionString } from "./utils/connection";

export class NostrRemoteSignerBunker {
  private nostr: Nostr;
  private userKeypair: NIP46KeyPair;
  private signerKeypair: NIP46KeyPair;
  private options: NIP46BunkerOptions;
  private connectedClients: Map<string, NIP46ClientSession>;
  private pendingAuthChallenges: Map<string, NIP46AuthChallenge>;
  private preferredEncryption: "nip04" | "nip44";
  private subId: string | null;
  private debug: boolean;

  constructor(options: NIP46BunkerOptions) {
    this.options = {
      authTimeout: 300000, // Default 5 minute timeout for auth challenges
      ...options,
    };
    this.connectedClients = new Map();
    this.pendingAuthChallenges = new Map();
    this.nostr = new Nostr(options.relays || []);
    this.preferredEncryption = options.preferredEncryption || "nip44";
    this.subId = null;
    this.debug = options.debug || false;

    // Initialize keypairs with empty private keys
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

    if (this.debug) {
      console.log(
        "[NIP46 BUNKER] Initialized with user pubkey:",
        options.userPubkey,
      );
      console.log(
        "[NIP46 BUNKER] Initialized with signer pubkey:",
        options.signerPubkey || options.userPubkey,
      );
      console.log("[NIP46 BUNKER] Using relays:", options.relays);
      console.log(
        "[NIP46 BUNKER] Default permissions:",
        options.defaultPermissions || "none",
      );
    }
  }

  /**
   * Get the public key of the signer
   */
  getSignerPubkey(): string {
    return this.signerKeypair.publicKey;
  }

  public async start(): Promise<void> {
    if (this.debug) console.log("[NIP46 BUNKER] Starting bunker");

    if (!this.signerKeypair.privateKey) {
      console.error("[NIP46 BUNKER] Error: Signer private key not set");
      throw new NIP46ConnectionError("Signer private key not set");
    }

    // Connect to relays
    await this.nostr.connectToRelays();
    if (this.debug)
      console.log("[NIP46 BUNKER] Connected to relays successfully");

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
    setInterval(() => this.cleanup(), 300000); // Run cleanup every 5 minutes
  }

  public async stop(): Promise<void> {
    if (this.debug) console.log("[NIP46 BUNKER] Stopping bunker");

    if (this.subId) {
      this.nostr.unsubscribe([this.subId]);
      this.subId = null;
    }

    if (this.nostr) {
      this.nostr.disconnectFromRelays();
    }

    this.connectedClients.clear();
    this.pendingAuthChallenges.clear();
  }

  /**
   * Set the user's private key
   */
  setUserPrivateKey(privateKey: string): void {
    this.userKeypair.privateKey = privateKey;
  }

  /**
   * Set the signer's private key
   */
  setSignerPrivateKey(privateKey: string): void {
    this.signerKeypair.privateKey = privateKey;
  }

  /**
   * Initialize both user and signer private keys
   */
  setPrivateKeys(userPrivateKey: string, signerPrivateKey?: string): void {
    this.setUserPrivateKey(userPrivateKey);
    this.setSignerPrivateKey(signerPrivateKey || userPrivateKey);
  }

  /**
   * Resolves an authentication challenge for a user
   * @param pubkey The public key of the user to resolve the auth challenge for
   * @returns boolean indicating if any challenge was resolved
   */
  resolveAuthChallenge(pubkey: string): boolean {
    if (this.debug)
      console.log(
        "[NIP46 BUNKER] Resolving auth challenge for pubkey:",
        pubkey,
      );
    let resolved = false;

    // Find all pending challenges for this pubkey
    this.pendingAuthChallenges.forEach((challenge, id) => {
      if (challenge.clientPubkey === pubkey) {
        // Get or create a client session
        let clientSession = this.connectedClients.get(pubkey);

        if (!clientSession) {
          // Create a new session if one doesn't exist
          clientSession = {
            permissions: new Set<string>(),
            lastSeen: Date.now(),
            preferredEncryption: this.preferredEncryption,
          };
        }

        // Add the requested permissions to the client
        if (challenge.permissions) {
          if (this.debug)
            console.log(
              "[NIP46 BUNKER] Adding permissions:",
              challenge.permissions,
            );
          challenge.permissions.forEach((permission) => {
            clientSession!.permissions.add(permission);
          });
        }

        // Add default permissions if configured
        if (this.options.defaultPermissions) {
          this.options.defaultPermissions.forEach((permission) => {
            clientSession!.permissions.add(permission);
          });
        }

        // Update the client session
        this.connectedClients.set(pubkey, clientSession);

        // Send a success response to the client
        this.sendResponse(challenge.clientPubkey, challenge.id, "ack").catch(
          (err) => {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            console.error(
              "[NIP46 BUNKER] Error sending auth response:",
              errorMessage,
            );
          },
        );

        // Remove the challenge
        this.pendingAuthChallenges.delete(id);
        resolved = true;
      }
    });

    return resolved;
  }

  private cleanup(): void {
    const now = Date.now();
    let clientsRemoved = 0;
    let challengesRemoved = 0;

    // Clean up stale clients
    this.connectedClients.forEach((client, clientPubkey) => {
      if (now - client.lastSeen > 3600000) {
        // 1 hour timeout
        this.connectedClients.delete(clientPubkey);
        clientsRemoved++;
      }
    });

    // Clean up stale auth challenges
    this.pendingAuthChallenges.forEach((challenge, id) => {
      if (now - challenge.timestamp > (this.options.authTimeout || 300000)) {
        this.pendingAuthChallenges.delete(id);
        challengesRemoved++;
      }
    });

    if (this.debug && (clientsRemoved > 0 || challengesRemoved > 0)) {
      console.log(
        `[NIP46 BUNKER] Cleanup: removed ${clientsRemoved} clients and ${challengesRemoved} challenges`,
      );
    }
  }

  /**
   * Handle an incoming request event
   */
  private async handleRequest(event: NostrEvent): Promise<void> {
    if (this.debug) {
      console.log("[NIP46 BUNKER] Received request event:", {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
      });
    }

    const clientPubkey = event.pubkey;

    try {
      // Decrypt the content using the signer's private key
      const result = await this.decryptContent(event.content, clientPubkey);

      if (!result.success) {
        if (this.debug)
          console.log(
            "[NIP46 BUNKER] Failed to decrypt content:",
            result.error,
          );
        return;
      }

      // Parse the request
      let request: NIP46Request;
      try {
        request = JSON.parse(result.data);
        if (this.debug)
          console.log(
            "[NIP46 BUNKER] Parsed request:",
            request.method,
            request.id,
          );
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(
          "[NIP46 BUNKER] Failed to parse request JSON:",
          errorMessage,
        );
        return;
      }

      // Update client's preferred encryption method
      if (result.method) {
        const client = this.connectedClients.get(clientPubkey);
        if (client) {
          client.preferredEncryption = result.method;
          client.lastSeen = Date.now();
          this.connectedClients.set(clientPubkey, client);
        }
      }

      // Process the request
      let response: NIP46Response;

      // Handle the request based on the method
      const method = request.method.toString();

      if (method === "connect") {
        response = await this.handleConnect(request, clientPubkey);
      } else if (method === "sign_event") {
        response = await this.handleSignEvent(request, clientPubkey);
      } else if (method === "get_public_key") {
        response = await this.handleGetPublicKey(request);
      } else if (method === "get_relays") {
        response = {
          id: request.id,
          result: JSON.stringify(this.options.relays || []),
        };
      } else if (
        method === "nip04_encrypt" ||
        method === "nip04_decrypt" ||
        method === "nip44_encrypt" ||
        method === "nip44_decrypt"
      ) {
        response = await this.handleEncryption(request, clientPubkey);
      } else if (method === "ping") {
        response = {
          id: request.id,
          result: "pong",
        };
      } else {
        console.log("[NIP46 BUNKER] Unknown method:", method);
        response = {
          id: request.id,
          error: `Method not supported: ${method}`,
        };
      }

      // Send the response
      await this.sendResponse(
        clientPubkey,
        response.id,
        response.result,
        response.error,
        response.auth_url,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[NIP46 BUNKER] Error handling request:", errorMessage);
    }
  }

  /**
   * Handle a connect request
   */
  private async handleConnect(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    // Check if the client is trying to connect with the wrong signer
    const targetPubkey = request.params[0];
    if (targetPubkey && targetPubkey !== this.signerKeypair.publicKey) {
      return {
        id: request.id,
        error: "Connection rejected: wrong target public key",
      };
    }

    // Extract the secret from the request
    const secret = request.params[1] || "";

    // Check the secret if configured
    if (this.options.secret && this.options.secret !== secret) {
      return {
        id: request.id,
        error: "Connection rejected: invalid secret",
      };
    }

    // Parse and validate the requested permissions
    let permissions: string[] = [];
    if (request.params[2]) {
      permissions = request.params[2].split(",").filter(Boolean);
    }

    // Check if we require authentication challenge
    if (this.options.requireAuthChallenge) {
      // Create a new auth challenge
      const challengeId = Math.random().toString(36).substring(2, 10);
      const challenge: NIP46AuthChallenge = {
        id: request.id,
        clientPubkey,
        permissions,
        timestamp: Date.now(),
      };

      this.pendingAuthChallenges.set(challengeId, challenge);

      // Create a URL for authentication if a handler was provided
      let authUrl = "";
      if (this.options.authUrl) {
        authUrl = this.options.authUrl;
      }

      // Return auth challenge response
      return {
        id: request.id,
        auth_url: authUrl || `auth:${challengeId}`,
      };
    }

    // No auth challenge required, proceed with connection
    // Create or update the client session
    const clientSession = this.connectedClients.get(clientPubkey) || {
      permissions: new Set<string>(),
      lastSeen: Date.now(),
      preferredEncryption: this.preferredEncryption,
    };

    // Add all requested permissions
    permissions.forEach((perm) => clientSession.permissions.add(perm));

    // Add default permissions
    if (this.options.defaultPermissions) {
      this.options.defaultPermissions.forEach((perm) =>
        clientSession.permissions.add(perm),
      );
    }

    // Update the client session
    clientSession.lastSeen = Date.now();
    this.connectedClients.set(clientPubkey, clientSession);

    if (this.debug) {
      console.log("[NIP46 BUNKER] Client connected:", clientPubkey);
      console.log(
        "[NIP46 BUNKER] Client permissions:",
        Array.from(clientSession.permissions),
      );
    }

    // Return a success response
    return {
      id: request.id,
      result: secret || "ack",
    };
  }

  /**
   * Handle a sign event request
   */
  private async handleSignEvent(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    if (!this.isClientAuthorized(clientPubkey)) {
      return {
        id: request.id,
        error: "Not authorized",
      };
    }

    if (!this.userKeypair.privateKey) {
      console.error("[NIP46 BUNKER] Cannot sign: user private key not set");
      return {
        id: request.id,
        error: "User private key not set",
      };
    }

    try {
      // Parse the event template
      const eventTemplate: NIP46UnsignedEventData = JSON.parse(
        request.params[0],
      );

      // Check event kind permission
      if (
        !this.hasPermission(clientPubkey, `sign_event:${eventTemplate.kind}`)
      ) {
        return {
          id: request.id,
          error: `Not authorized to sign event kind: ${eventTemplate.kind}`,
        };
      }

      // Sign the event
      const signedEvent = await createSignedEvent(
        {
          ...eventTemplate,
          pubkey: this.userKeypair.publicKey,
          tags: eventTemplate.tags || [],
        },
        this.userKeypair.privateKey,
      );

      return {
        id: request.id,
        result: JSON.stringify(signedEvent),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[NIP46 BUNKER] Error signing event:", errorMessage);
      return {
        id: request.id,
        error: `Failed to sign event: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle a get public key request
   */
  private async handleGetPublicKey(
    request: NIP46Request,
  ): Promise<NIP46Response> {
    return {
      id: request.id,
      result: this.userKeypair.publicKey,
    };
  }

  /**
   * Handle encryption/decryption requests
   */
  private async handleEncryption(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    if (!this.isClientAuthorized(clientPubkey)) {
      return {
        id: request.id,
        error: "Not authorized",
      };
    }

    // Check permissions for the specific encryption method
    if (!this.hasPermission(clientPubkey, request.method)) {
      return {
        id: request.id,
        error: `Not authorized for ${request.method}`,
      };
    }

    // Ensure we have the user's private key
    if (!this.userKeypair.privateKey) {
      console.error("[NIP46 BUNKER] User private key not set");
      return {
        id: request.id,
        error: "User private key not set",
      };
    }

    try {
      const thirdPartyPubkey = request.params[0];
      const content = request.params[1];

      if (!thirdPartyPubkey || !content) {
        return {
          id: request.id,
          error: "Missing parameters",
        };
      }

      // Process based on method
      let result: string;

      switch (request.method) {
        case NIP46Method.NIP04_ENCRYPT:
          result = encryptNIP04(
            content,
            this.userKeypair.privateKey,
            thirdPartyPubkey,
          );
          break;

        case NIP46Method.NIP04_DECRYPT:
          result = decryptNIP04(
            content,
            this.userKeypair.privateKey,
            thirdPartyPubkey,
          );
          break;

        case NIP46Method.NIP44_ENCRYPT:
          result = encryptNIP44(
            content,
            this.userKeypair.privateKey,
            thirdPartyPubkey,
          );
          break;

        case NIP46Method.NIP44_DECRYPT:
          result = decryptNIP44(
            content,
            this.userKeypair.privateKey,
            thirdPartyPubkey,
          );
          break;

        default:
          return {
            id: request.id,
            error: "Unsupported method",
          };
      }

      return {
        id: request.id,
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[NIP46 BUNKER] Error during encryption:", errorMessage);
      return {
        id: request.id,
        error: `Operation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Send a response to a client
   */
  private async sendResponse(
    clientPubkey: string,
    id: string,
    result: string | null = null,
    error?: string,
    auth_url?: string,
  ): Promise<void> {
    if (!this.signerKeypair.privateKey) {
      throw new NIP46ConnectionError("Signer private key not set");
    }

    // Create the response object
    const response: NIP46Response = { id };

    if (result !== undefined && result !== null) {
      response.result = result;
    }

    if (error) {
      response.error = error;
    }

    if (auth_url) {
      response.auth_url = auth_url;
    }

    try {
      // Determine which encryption method to use for the client
      let clientEncryption: "nip04" | "nip44" = this.preferredEncryption;
      const client = this.connectedClients.get(clientPubkey);

      if (client && client.preferredEncryption) {
        clientEncryption = client.preferredEncryption;
      }

      // Encrypt the response
      let encryptedContent: string;
      const jsonResponse = JSON.stringify(response);

      try {
        if (clientEncryption === "nip44") {
          encryptedContent = encryptNIP44(
            jsonResponse,
            this.signerKeypair.privateKey,
            clientPubkey,
          );
        } else {
          encryptedContent = encryptNIP04(
            jsonResponse,
            this.signerKeypair.privateKey,
            clientPubkey,
          );
        }
      } catch (error) {
        // Fallback to the other encryption method
        if (clientEncryption === "nip44") {
          encryptedContent = encryptNIP04(
            jsonResponse,
            this.signerKeypair.privateKey,
            clientPubkey,
          );

          // Update client preference
          if (client) {
            client.preferredEncryption = "nip04";
            this.connectedClients.set(clientPubkey, client);
          }
        } else {
          encryptedContent = encryptNIP44(
            jsonResponse,
            this.signerKeypair.privateKey,
            clientPubkey,
          );

          // Update client preference
          if (client) {
            client.preferredEncryption = "nip44";
            this.connectedClients.set(clientPubkey, client);
          }
        }
      }

      // Create and publish the response event
      await this.nostr.publishEvent({
        kind: 24133,
        pubkey: this.signerKeypair.publicKey,
        created_at: getUnixTime(),
        tags: [["p", clientPubkey]],
        content: encryptedContent,
        id: "",
        sig: "",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[NIP46 BUNKER] Failed to send response:", errorMessage);
      throw new NIP46EncryptionError(
        `Failed to send response: ${errorMessage}`,
      );
    }
  }

  private isClientAuthorized(clientPubkey: string): boolean {
    return this.connectedClients.has(clientPubkey);
  }

  getConnectionString(): string {
    // Filter out undefined values to ensure clean connection string
    const connectionOptions: {
      pubkey: string;
      relays?: string[];
      secret?: string;
    } = {
      pubkey: this.signerKeypair.publicKey,
    };
    
    // Only include relays if they exist and are not empty
    if (this.options.relays && this.options.relays.length > 0) {
      connectionOptions.relays = this.options.relays;
    }
    
    // Only include secret if it exists
    if (this.options.secret) {
      connectionOptions.secret = this.options.secret;
    }
    
    return buildConnectionString(connectionOptions);
  }

  async publishMetadata(
    metadata: NIP46Metadata,
  ): Promise<NostrEvent | undefined> {
    try {
      // Include relay information if not already specified
      if (!metadata.relays && this.options.relays) {
        metadata.relays = this.options.relays;
      }

      // Create metadata event (kind 31990 - NIP-89 application handler)
      const event = await createSignedEvent(
        {
          kind: 31990,
          content: JSON.stringify(metadata),
          tags: [
            ["k", "24133"], // Handles kind 24133 (NIP-46)
            ...(metadata.relays
              ? metadata.relays.map((url) => ["relay", url])
              : []),
            ...(metadata.nostrconnect_url
              ? [["nostrconnect_url", metadata.nostrconnect_url]]
              : []),
          ],
          created_at: getUnixTime(),
          pubkey: this.signerKeypair.publicKey,
        },
        this.signerKeypair.privateKey,
      );

      // Publish metadata event
      await this.nostr.publishEvent(event);
      return event;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to publish metadata:", errorMessage);
      return undefined;
    }
  }

  /**
   * Decrypt content using both NIP-04 and NIP-44
   * @private
   */
  private async decryptContent(
    content: string,
    authorPubkey: string,
  ): Promise<NIP46EncryptionResult> {
    if (!this.signerKeypair.privateKey) {
      return {
        success: false,
        error: "Signer private key not set",
        method: this.preferredEncryption,
      };
    }

    // Try preferred method first
    try {
      if (this.preferredEncryption === "nip44") {
        const decrypted = decryptNIP44(
          content,
          this.signerKeypair.privateKey,
          authorPubkey,
        );
        return {
          success: true,
          data: decrypted,
          method: "nip44",
        };
      } else {
        const decrypted = decryptNIP04(
          content,
          this.signerKeypair.privateKey,
          authorPubkey,
        );
        return {
          success: true,
          data: decrypted,
          method: "nip04",
        };
      }
    } catch (error) {
      // Try fallback method
      try {
        if (this.preferredEncryption === "nip44") {
          const decrypted = decryptNIP04(
            content,
            this.signerKeypair.privateKey,
            authorPubkey,
          );
          return {
            success: true,
            data: decrypted,
            method: "nip04",
          };
        } else {
          const decrypted = decryptNIP44(
            content,
            this.signerKeypair.privateKey,
            authorPubkey,
          );
          return {
            success: true,
            data: decrypted,
            method: "nip44",
          };
        }
      } catch (fallbackError) {
        if (this.debug)
          console.log("[NIP46 BUNKER] Both decryption methods failed");
        return {
          success: false,
          error: "Failed to decrypt content with both NIP-04 and NIP-44",
          method: this.preferredEncryption,
        };
      }
    }
  }

  /**
   * Check if a client has a specific permission
   * @private
   */
  private hasPermission(clientPubkey: string, permission: string): boolean {
    const client = this.connectedClients.get(clientPubkey);
    if (!client) {
      return false;
    }

    // Check for the specific permission
    if (client.permissions.has(permission)) {
      return true;
    }

    // For sign_event:X, check if client has the generic sign_event permission
    if (
      permission.startsWith("sign_event:") &&
      client.permissions.has("sign_event")
    ) {
      return true;
    }

    // Check comma-separated permissions (e.g., "sign_event:1,sign_event:4")
    for (const perm of client.permissions) {
      if (perm.includes(",")) {
        const permList = perm.split(",");
        if (permList.includes(permission)) {
          return true;
        }
      }
    }

    return false;
  }
}
