import { Nostr } from "../nip01/nostr";
import { NostrEvent } from "../types/nostr";
import { getPublicKey } from "../utils/crypto";
import { createEvent, createSignedEvent, getEventHash } from "../nip01/event";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import {
  NIP47Method,
  NIP47Request,
  NIP47Response,
  NIP47ConnectionOptions,
  NIP47EventKind,
  NIP47Notification,
  TransactionType,
  NIP47ErrorCode,
  GetInfoRequest,
  PayInvoiceRequest,
  MakeInvoiceRequest,
  LookupInvoiceRequest,
  GetInfoResponse,
  PayInvoiceResponse,
  MakeInvoiceResponse,
  NIP47Error,
  ERROR_CATEGORIES,
  ERROR_RECOVERY_HINTS,
  NIP47ErrorCategory,
  NIP47Transaction,
  ListTransactionsResponseResult,
  SignMessageResponseResult,
  NIP47EncryptionScheme,
  GetInfoResponseResult,
} from "./types";
import { 
  SecurityValidationError 
} from "../utils/security-validator";

/**
 * Parse a NWC URL into connection options
 */
export function parseNWCURL(url: string): NIP47ConnectionOptions {
  if (!url.startsWith("nostr+walletconnect://")) {
    throw new Error("Invalid NWC URL format");
  }

  // Extract pubkey
  const [_, pubkeyAndParams] = url.split("://");
  const [pubkey, queryString] = pubkeyAndParams.split("?");

  if (!pubkey) {
    throw new Error("Missing pubkey in NWC URL");
  }

  // Parse query parameters
  const params = new URLSearchParams(queryString);
  const relays: string[] = [];
  params.getAll("relay").forEach((relay) => relays.push(relay));

  const secret = params.get("secret");
  if (!secret) {
    throw new Error("Missing secret in NWC URL");
  }

  return {
    pubkey,
    secret,
    relays,
  };
}

/**
 * Generate a NWC URL from connection options
 */
export function generateNWCURL(options: NIP47ConnectionOptions): string {
  if (!options.pubkey) {
    throw new Error("Missing pubkey in connection options");
  }

  if (!options.secret) {
    throw new Error("Missing secret in connection options");
  }

  if (!options.relays || options.relays.length === 0) {
    throw new Error("At least one relay must be specified");
  }

  const params = new URLSearchParams();
  options.relays.forEach((relay) => params.append("relay", relay));
  params.append("secret", options.secret);

  return `nostr+walletconnect://${options.pubkey}?${params.toString()}`;
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  factor: number; // exponential backoff factor
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  factor: 2, // Exponential backoff factor
};

// Custom error class for NIP-47 errors
export class NIP47ClientError extends Error {
  code: NIP47ErrorCode;
  category: NIP47ErrorCategory;
  recoveryHint?: string;
  data?: Record<string, unknown>;

  constructor(
    message: string,
    code: NIP47ErrorCode,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NIP47ClientError";
    this.code = code;

    // Determine error category
    this.category = ERROR_CATEGORIES[code] || NIP47ErrorCategory.INTERNAL;

    // Add recovery hint if available
    this.recoveryHint = ERROR_RECOVERY_HINTS[code];

    // Add additional error data if provided
    this.data = data;
  }

  /**
   * Creates an error instance from a NIP47Error response
   */
  static fromResponseError(error: NIP47Error): NIP47ClientError {
    return new NIP47ClientError(
      error.message || "Unknown error",
      error.code || NIP47ErrorCode.INTERNAL_ERROR,
      error.data,
    );
  }

  /**
   * Check if the error is a network-related error
   */
  isNetworkError(): boolean {
    return this.category === NIP47ErrorCategory.NETWORK;
  }

  /**
   * Check if the error is a timeout
   */
  isTimeoutError(): boolean {
    return this.category === NIP47ErrorCategory.TIMEOUT;
  }

  /**
   * Check if the error is authorization-related
   */
  isAuthorizationError(): boolean {
    return this.category === NIP47ErrorCategory.AUTHORIZATION;
  }

  /**
   * Check if retry is recommended for this error
   */
  isRetriable(): boolean {
    return (
      this.isNetworkError() ||
      this.isTimeoutError() ||
      this.code === NIP47ErrorCode.WALLET_UNAVAILABLE
    );
  }

  /**
   * Get user-friendly error message including recovery hint
   */
  getUserMessage(): string {
    return this.recoveryHint
      ? `${this.message}. ${this.recoveryHint}`
      : this.message;
  }
}

/**
 * Nostr Wallet Connect client implementation
 *
 * This class provides an API for applications to connect to a NIP-47 compatible
 * wallet service over Nostr.
 */
export class NostrWalletConnectClient {
  private pubkey: string;
  private clientPrivkey: string;
  private clientPubkey: string;
  private relays: string[];
  private client: Nostr;
  private supportedMethods: string[] = [];
  private supportedNotifications: string[] = [];
  private supportedEncryption: NIP47EncryptionScheme[] = [];
  private preferredEncryption: NIP47EncryptionScheme;
  private notificationHandlers = new Map<
    string,
    ((notification: NIP47Notification<unknown>) => void)[]
  >();
  private pendingRequests = new Map<
    string,
    (response: NIP47Response) => void
  >();
  private initialized = false;
  private subIds: string[] = [];

  constructor(options: NIP47ConnectionOptions) {
    if (!options.pubkey) {
      throw new Error("Missing pubkey in connection options");
    }

    if (!options.secret) {
      throw new Error("Missing secret in connection options");
    }

    if (!options.relays || options.relays.length === 0) {
      throw new Error("At least one relay must be specified");
    }

    this.pubkey = options.pubkey;
    this.clientPrivkey = options.secret;
    this.clientPubkey = getPublicKey(this.clientPrivkey);
    this.relays = options.relays;
    this.client = new Nostr(this.relays);
    
    // Set preferred encryption (default to NIP-44 if not specified)
    this.preferredEncryption = options.preferredEncryption || NIP47EncryptionScheme.NIP44_V2;
  }

  /**
   * Initialize the client, connect to relays and fetch capabilities
   */
  public async init(): Promise<void> {
    // Connect to relays
    await this.client.connectToRelays();
    console.log(`Client connected to relays: ${this.relays.join(", ")}`);

    // Set up subscription to receive responses
    this.setupSubscription();
    console.log("Client subscribed to service events");

    // Wait for capabilities to be discovered via events
    console.log("Waiting for service capabilities...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (this.supportedMethods.length === 0) {
      console.warn(
        "No methods discovered from service after timeout, will try explicit getInfo call",
      );
      try {
        // Fallback to explicit getInfo call
        const info = await this.getInfo();
        if (info && info.methods) {
          this.supportedMethods = info.methods;
          console.log(
            `Discovered methods via getInfo: ${this.supportedMethods.join(", ")}`,
          );
        }
        if (info && info.notifications) {
          this.supportedNotifications = info.notifications;
          console.log(
            `Discovered notifications via getInfo: ${this.supportedNotifications.join(", ")}`,
          );
        }
      } catch (error) {
        throw new Error(`Failed to initialize wallet connection: ${error}`);
      }
    }

    this.initialized = true;
  }

  /**
   * Check if the wallet supports a specific method
   */
  public supportsMethod(method: string): boolean {
    return this.supportedMethods.includes(method);
  }

  /**
   * Check if the wallet supports a specific notification type
   */
  public supportsNotification(type: string): boolean {
    return this.supportedNotifications.includes(type);
  }

  /**
   * Register a notification handler
   */
  public onNotification(
    type: string,
    handler: (notification: NIP47Notification<unknown>) => void,
  ): void {
    if (!this.notificationHandlers.has(type)) {
      this.notificationHandlers.set(type, []);
    }
    this.notificationHandlers.get(type)!.push(handler);
  }

  /**
   * Get the client's public key
   */
  public getPublicKey(): string {
    return this.clientPubkey;
  }

  /**
   * Get access to the underlying Nostr client for logging configuration
   */
  public getNostrClient(): Nostr {
    return this.client;
  }

  /**
   * Disconnect from the wallet service
   */
  public disconnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        // Clean up any pending subscriptions
        if (this.subIds.length > 0) {
          this.client.unsubscribe(this.subIds);
          this.subIds = [];
        }

        // Reject any pending requests
        if (this.pendingRequests.size > 0) {
          this.pendingRequests.forEach((resolver) => {
            resolver({
              result_type: NIP47Method.GET_INFO, // Use a placeholder method
              result: null,
              error: {
                code: NIP47ErrorCode.CONNECTION_ERROR,
                message: "Client disconnected before receiving response",
                category: NIP47ErrorCategory.NETWORK,
              },
            });
          });

          this.pendingRequests.clear();
        }

        // Clear notification handlers
        this.notificationHandlers.clear();

        // Disconnect from relay (don't wait for it)
        try {
          this.client.disconnectFromRelays();
        } catch (error) {
          console.error("Error disconnecting from relays:", error);
        }

        this.initialized = false;

        // Short delay to allow relay disconnection to complete
        setTimeout(() => {
          resolve();
        }, 100).unref();
      } catch (error) {
        console.error("Error during client disconnect:", error);
        resolve();
      }
    });
  }

  /**
   * Set up subscription to receive responses from the wallet service
   */
  private setupSubscription(): void {
    // Subscribe to events from the wallet service directed to us
    const responseFilter = {
      kinds: [
        NIP47EventKind.RESPONSE, 
        NIP47EventKind.NOTIFICATION,
        NIP47EventKind.NOTIFICATION_NIP44
      ],
      authors: [this.pubkey],
      "#p": [this.clientPubkey],
    };

    // Filter for INFO events from the service
    const infoFilter = {
      kinds: [NIP47EventKind.INFO],
      authors: [this.pubkey],
    };

    console.log("Setting up client subscriptions:");
    console.log("Filter 1:", JSON.stringify(responseFilter));
    console.log("Filter 2:", JSON.stringify(infoFilter));

    // Enhanced debug logging for the client filter
    console.log("Client pubkey for filter:", this.clientPubkey);
    console.log("Service pubkey for filter:", this.pubkey);

    this.subIds = this.client.subscribe(
      [responseFilter, infoFilter],
      (event: NostrEvent, relay: string) => {
        console.log(
          `Received event: ${event.id} of kind ${event.kind} from ${relay}`,
        );
        console.log(
          `Event pubkey: ${event.pubkey}, tags: ${JSON.stringify(event.tags)}`,
        );

        // Log all event data for debugging
        console.log(`Full event:`, JSON.stringify(event));

        this.handleEvent(event);
      },
    );
    console.log("Subscription IDs:", this.subIds);
  }

  /**
   * Handle incoming events from the wallet service
   */
  private async handleEvent(event: NostrEvent): Promise<void> {
    console.log(`Handling event of kind ${event.kind} from ${event.pubkey}`);
    console.log(`Event id: ${event.id}`);
    console.log(`Event tags: ${JSON.stringify(event.tags)}`);

    // Extract p-tag and e-tag values for easier debugging
    const pTags = event.tags
      .filter((tag) => tag[0] === "p")
      .map((tag) => tag[1]);
    const eTags = event.tags.filter((tag) => 
      Array.isArray(tag) && tag.length > 0 && tag[0] === "e"
    );

    console.log(`Event p-tags: ${pTags.join(", ")}`);
    console.log(`Event e-tags: ${eTags.join(", ")}`);
    console.log(`Expected p-tag for this client: ${this.clientPubkey}`);

    if (event.kind === NIP47EventKind.RESPONSE) {
      console.log(
        `Processing as RESPONSE event (kind ${NIP47EventKind.RESPONSE})`,
      );
      await this.handleResponse(event);
    } else if (event.kind === NIP47EventKind.NOTIFICATION || event.kind === NIP47EventKind.NOTIFICATION_NIP44) {
      console.log(
        `Processing as NOTIFICATION event (kind ${event.kind})`,
      );
      await this.handleNotification(event);
    } else if (event.kind === NIP47EventKind.INFO) {
      console.log(`Processing as INFO event (kind ${NIP47EventKind.INFO})`);
      this.handleInfoEvent(event);
    } else {
      console.log(
        `Unknown event kind: ${event.kind}, expected one of: ${NIP47EventKind.RESPONSE}, ${NIP47EventKind.NOTIFICATION}, ${NIP47EventKind.NOTIFICATION_NIP44}, ${NIP47EventKind.INFO}`,
      );
    }
  }

  /**
   * Validate that a response follows the NIP-47 specification structure
   */
  private validateResponse(response: unknown): NIP47Response {
    // First check if response is an object
    if (!response || typeof response !== "object") {
      throw new NIP47ClientError(
        "Invalid response: not an object",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    // Cast to a more specific type for property access
    const resp = response as Record<string, unknown>;

    // Check if result_type exists and is a string
    if (!resp.result_type || typeof resp.result_type !== "string") {
      throw new NIP47ClientError(
        "Invalid response: missing or invalid result_type",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    // Verify result_type is a known NIP47Method
    if (!Object.values(NIP47Method).includes(resp.result_type as NIP47Method)) {
      throw new NIP47ClientError(
        `Invalid response: unknown result_type '${resp.result_type}'`,
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    // Check that error field exists (can be null)
    if (!("error" in resp)) {
      throw new NIP47ClientError(
        "Invalid response: missing error field",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    // If error is not null, validate its structure
    if (resp.error !== null) {
      if (typeof resp.error !== "object") {
        throw new NIP47ClientError(
          "Invalid response: error field must be an object or null",
          NIP47ErrorCode.INVALID_REQUEST,
        );
      }

      const error = resp.error as Record<string, unknown>;

      // Check error has code and message
      if (!error.code || typeof error.code !== "string") {
        throw new NIP47ClientError(
          "Invalid response: error must have a code field",
          NIP47ErrorCode.INVALID_REQUEST,
        );
      }

      if (!error.message || typeof error.message !== "string") {
        throw new NIP47ClientError(
          "Invalid response: error must have a message field",
          NIP47ErrorCode.INVALID_REQUEST,
        );
      }

      // When there's an error, result should be null
      if (resp.result !== null) {
        throw new NIP47ClientError(
          "Invalid response: when error is present, result must be null",
          NIP47ErrorCode.INVALID_REQUEST,
        );
      }
    }

    // If no error, result should be defined and not null
    if (
      resp.error === null &&
      (resp.result === null || resp.result === undefined)
    ) {
      throw new NIP47ClientError(
        "Invalid response: when error is null, result must be defined and not null",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    return response as NIP47Response;
  }

  /**
   * Handle response events
   */
  private async handleResponse(event: NostrEvent): Promise<void> {
    try {
      // Try to decrypt response - first check if response has encryption tag
      let decrypted: string;
      
      // Check if the response has an encryption tag (though it's on the request, not response)
      // The service should use the same encryption as the request
      // For now, try NIP-44 first if we support it, then fall back to NIP-04
      if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP44_V2)) {
        try {
          decrypted = await decryptNIP44(
            event.content,
            this.clientPrivkey,
            this.pubkey,
          );
        } catch (nip44Error) {
          // Fall back to NIP-04 if NIP-44 decryption fails
          try {
            decrypted = decryptNIP04(
              this.clientPrivkey,
              this.pubkey,
              event.content,
            );
          } catch (nip04Error) {
            // Both failed, throw original NIP-44 error
            throw nip44Error;
          }
        }
      } else {
        // Only NIP-04 is supported
        decrypted = decryptNIP04(
          this.clientPrivkey,
          this.pubkey,
          event.content,
        );
      }
      
      const response = JSON.parse(decrypted);

      // Validate response structure
      this.validateResponse(response);

      console.log(
        `Validated response of type: ${(response as NIP47Response).result_type}`,
      );

      // Find the e-tag which references the request event ID
      const eTags = event.tags.filter((tag) => 
        Array.isArray(tag) && tag.length > 0 && tag[0] === "e"
      );
      
      if (eTags.length === 0) {
        console.warn(
          "Response event has no e-tag, cannot correlate with a request",
        );
        return;
      }

      // Get the request ID from the e-tag with simplified bounds checking
      let requestId: string;
      try {
        // Direct access after initial validation ensures presence and structure
        const firstETag = eTags[0];
        requestId = firstETag[1]; // e-tags have structure ["e", requestId, ...]
        
      } catch (error) {
        if (error instanceof SecurityValidationError) {
          console.warn(`NIP-47: Bounds checking error in e-tag processing: ${error.message}`);
        }
        return;
      }
      
      console.log(`Found request ID from e-tag: ${requestId}`);

      // Find the pending request
      if (this.pendingRequests.has(requestId)) {
        console.log(`Found pending request with ID: ${requestId}`);
        const resolver = this.pendingRequests.get(requestId);
        if (resolver) {
          resolver(response as NIP47Response);
          this.pendingRequests.delete(requestId);
          console.log(`Request ${requestId} resolved successfully`);
          return;
        }
      } else {
        console.warn(`No pending request found with ID: ${requestId}`);
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        console.warn(`NIP-47: Security validation error in response handling: ${error.message}`);
      } else {
        console.error("Error handling response event:", error);
      }
    }
  }

  /**
   * Handle notification events
   */
  private async handleNotification(event: NostrEvent): Promise<void> {
    try {
      // Decrypt the content with client's private key and service's public key
      let decrypted: string;
      
      // Determine encryption based on event kind
      if (event.kind === NIP47EventKind.NOTIFICATION_NIP44) {
        decrypted = await decryptNIP44(
          event.content,
          this.clientPrivkey,
          this.pubkey,
        );
      } else {
        // NIP47EventKind.NOTIFICATION uses NIP-04
        decrypted = decryptNIP04(
          this.clientPrivkey,
          this.pubkey,
          event.content,
        );
      }
      
      const notification: NIP47Notification<unknown> = JSON.parse(decrypted);

      // Find and call the notification handlers
      const handlers = this.notificationHandlers.get(
        notification.notification_type,
      );
      if (handlers) {
        handlers.forEach((handler) => handler(notification));
      }
    } catch (error) {
      console.error("Failed to handle notification:", error);
    }
  }

  /**
   * Handle info events to discover capabilities
   */
  private handleInfoEvent(event: NostrEvent): void {
    try {
      console.log("Received INFO event from:", event.pubkey);
      console.log("Expected service pubkey:", this.pubkey);
      console.log("Event kind:", event.kind, "Expected:", NIP47EventKind.INFO);
      console.log("Event content:", event.content);
      console.log("Event tags:", JSON.stringify(event.tags));

      // Extract supported methods from content
      if (event.content.trim()) {
        this.supportedMethods = event.content.trim().split(" ");
      }

      // Extract supported notifications from tags
      const notificationsTag = event.tags.find(
        (tag: string[]) => 
          Array.isArray(tag) && tag.length > 1 && tag[0] === "notifications"
      );
      
      if (notificationsTag && typeof notificationsTag[1] === "string") {
        this.supportedNotifications = notificationsTag[1].split(" ");
      }

      // Extract supported encryption schemes from tags
      const encryptionTag = event.tags.find(
        (tag: string[]) => 
          Array.isArray(tag) && tag.length > 1 && tag[0] === "encryption"
      );
      
      if (encryptionTag && typeof encryptionTag[1] === "string") {
        const schemes = encryptionTag[1].split(" ");
        this.supportedEncryption = schemes
          .map(s => s as NIP47EncryptionScheme)
          .filter(s => Object.values(NIP47EncryptionScheme).includes(s));
      } else {
        // If no encryption tag, assume only NIP-04 is supported (backwards compatibility)
        this.supportedEncryption = [NIP47EncryptionScheme.NIP04];
      }

      console.log("Discovered capabilities:");
      console.log(`Methods: ${this.supportedMethods.join(", ")}`);
      console.log(`Notifications: ${this.supportedNotifications.join(", ")}`);
      console.log(`Encryption: ${this.supportedEncryption.join(", ")}`);
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        console.warn(`NIP-47: Security validation error in info event handling: ${error.message}`);
      } else {
        console.error("Failed to handle info event:", error);
      }
    }
  }

  /**
   * Choose the best encryption scheme based on what's supported by both client and service
   */
  private chooseEncryptionScheme(): NIP47EncryptionScheme {
    // If service supports our preferred encryption, use it
    if (this.supportedEncryption.includes(this.preferredEncryption)) {
      return this.preferredEncryption;
    }
    
    // Otherwise, prefer NIP-44 if available
    if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP44_V2)) {
      return NIP47EncryptionScheme.NIP44_V2;
    }
    
    // Fall back to NIP-04
    return NIP47EncryptionScheme.NIP04;
  }

  /**
   * Send a request to the wallet service
   */
  private async sendRequest(
    request: NIP47Request,
    expiration?: number,
  ): Promise<NIP47Response> {
    if (!this.initialized) {
      throw new NIP47ClientError(
        "Client not initialized",
        NIP47ErrorCode.NOT_INITIALIZED,
      );
    }

    // Create tags for the request
    const tags: string[][] = [["p", this.pubkey]];

    // Add expiration tag if provided
    if (expiration) {
      // Ensure expiration is a timestamp in seconds
      const expirationTimestamp = Math.floor(expiration);
      tags.push(["expiration", expirationTimestamp.toString()]);
    }

    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.REQUEST,
      content: "",
      tags,
    };

    // Create the event
    const event = createEvent(eventTemplate, this.clientPubkey);

    // Choose the best encryption scheme
    const encryptionScheme = this.chooseEncryptionScheme();
    
    // Add encryption tag if using NIP-44
    if (encryptionScheme === NIP47EncryptionScheme.NIP44_V2) {
      event.tags.push(["encryption", encryptionScheme]);
    }
    
    // Encrypt the request
    let encryptedContent: string;
    try {
      if (encryptionScheme === NIP47EncryptionScheme.NIP44_V2) {
        encryptedContent = await encryptNIP44(
          JSON.stringify(request),
          this.clientPrivkey,
          this.pubkey,
        );
      } else {
        encryptedContent = encryptNIP04(
          this.clientPrivkey,
          this.pubkey,
          JSON.stringify(request),
        );
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Failed to encrypt request: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.ENCRYPTION_ERROR,
        { originalError: error, encryptionScheme },
      );
    }

    event.content = encryptedContent;

    // Generate event ID
    let eventId: string;
    try {
      eventId = await getEventHash(event);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Failed to generate event hash: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.INTERNAL_ERROR,
        { originalError: error },
      );
    }

    // Create a promise to wait for the response
    const responsePromise = new Promise<NIP47Response>((resolve, reject) => {
      // Set timeout for request
      const timeoutMs = 30000; // 30 seconds
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(eventId);
        reject(
          new NIP47ClientError("Request timed out", NIP47ErrorCode.TIMEOUT),
        );
      }, timeoutMs);

      // Store the resolve function for later
      this.pendingRequests.set(eventId, (response: NIP47Response) => {
        clearTimeout(timeout);

        // Check for errors in the response
        if (response.error) {
          const error = NIP47ClientError.fromResponseError(response.error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });

    try {
      // Sign and publish the event
      const signedEvent = await createSignedEvent(event, this.clientPrivkey);
      await this.client.publishEvent(signedEvent);
    } catch (error: unknown) {
      this.pendingRequests.delete(eventId);
      if (error instanceof NIP47ClientError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Failed to publish request: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.PUBLISH_FAILED,
        { originalError: error },
      );
    }

    // Wait for response
    return responsePromise;
  }

  /**
   * Get wallet info
   */
  public async getInfo(options?: {
    expiration?: number;
  }): Promise<GetInfoResponse["result"]> {
    try {
      const request: GetInfoRequest = {
        method: NIP47Method.GET_INFO,
        params: {},
      };

      const response = await this.sendRequest(request, options?.expiration);

      // If we got a successful response, update our capabilities
      if (response.result) {
        const info = response.result as GetInfoResponseResult;
        if (info?.methods) {
          this.supportedMethods = info.methods;
        }
        if (info?.notifications) {
          this.supportedNotifications = info.notifications;
        }
        if (info?.encryption) {
          this.supportedEncryption = info.encryption
            .map(s => s as NIP47EncryptionScheme)
            .filter(s => Object.values(NIP47EncryptionScheme).includes(s));
        } else {
          // If no encryption field, assume only NIP-04 is supported
          this.supportedEncryption = [NIP47EncryptionScheme.NIP04];
        }
      }

      return response.result as GetInfoResponse["result"];
    } catch (error: unknown) {
      if (error instanceof NIP47ClientError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Error getting wallet info: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.INTERNAL_ERROR,
        { originalError: error },
      );
    }
  }

  /**
   * Execute an operation with automatic retry for retriable errors
   * @param operation Function to execute
   * @param retryOptions Retry configuration
   * @returns Result of the operation
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    retryOptions: Partial<RetryOptions> = {},
  ): Promise<T> {
    const options: RetryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      ...retryOptions,
    };

    let lastError: NIP47ClientError | null = null;
    let currentDelay = options.initialDelay;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        // Wait before retrying (except on first attempt)
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, currentDelay));
          // Increase delay for next retry (with exponential backoff)
          currentDelay = Math.min(
            currentDelay * options.factor,
            options.maxDelay,
          );
        }

        return await operation();
      } catch (error: unknown) {
        // Only retry if it's a retriable error
        if (error instanceof NIP47ClientError && error.isRetriable()) {
          lastError = error;
          // Continue to next iteration for retry
        } else {
          // Non-retriable error, rethrow immediately
          throw error;
        }
      }
    }

    // If we've exhausted all retries
    if (lastError) {
      throw lastError;
    }

    // This should never happen, but TypeScript requires it
    throw new NIP47ClientError(
      "Retry operation failed for an unknown reason",
      NIP47ErrorCode.INTERNAL_ERROR,
    );
  }

  // Example use of retry with existing method
  /**
   * Get wallet balance with retry
   */
  public async getBalanceWithRetry(options?: {
    expiration?: number;
    retry?: Partial<RetryOptions>;
  }): Promise<number> {
    return this.withRetry(() => this.getBalance(options), options?.retry);
  }

  /**
   * Get wallet balance
   */
  public async getBalance(options?: { expiration?: number }): Promise<number> {
    const response = await this.sendRequest(
      {
        method: NIP47Method.GET_BALANCE,
        params: {},
      },
      options?.expiration,
    );
    return response.result as number;
  }

  /**
   * Pay a lightning invoice
   */
  public async payInvoice(
    invoice: string,
    amount?: number,
    maxfee?: number,
    options?: { expiration?: number },
  ): Promise<PayInvoiceResponse["result"]> {
    if (!invoice) {
      throw new NIP47ClientError(
        "Invoice is required",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    try {
      const request: PayInvoiceRequest = {
        method: NIP47Method.PAY_INVOICE,
        params: {
          invoice,
          amount,
          maxfee,
        },
      };

      const response = await this.sendRequest(request, options?.expiration);
      return response.result as PayInvoiceResponse["result"];
    } catch (error: unknown) {
      if (error instanceof NIP47ClientError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Error paying invoice: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.PAYMENT_FAILED,
        { originalError: error },
      );
    }
  }

  /**
   * Make an invoice
   */
  public async makeInvoice(
    amount: number,
    description: string,
    descriptionHash?: string,
    expiry?: number,
    options?: { expiration?: number },
  ): Promise<MakeInvoiceResponse["result"]> {
    // Add parameter validation
    if (amount === null || amount === undefined) {
      throw new NIP47ClientError(
        "Amount is required",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    if (!description && !descriptionHash) {
      throw new NIP47ClientError(
        "Description or description hash is required",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    try {
      const request: MakeInvoiceRequest = {
        method: NIP47Method.MAKE_INVOICE,
        params: {
          amount,
          description,
          description_hash: descriptionHash,
          expiry,
        },
      };

      const response = await this.sendRequest(request, options?.expiration);
      return response.result as MakeInvoiceResponse["result"];
    } catch (error: unknown) {
      if (error instanceof NIP47ClientError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Error creating invoice: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.INTERNAL_ERROR,
        { originalError: error },
      );
    }
  }

  /**
   * Look up invoice information by payment hash or invoice string
   *
   * @param params - Object containing either payment_hash, invoice, or both
   * @param params.payment_hash - The payment hash to look up
   * @param params.invoice - The invoice to look up
   * @param options - Optional request parameters
   * @param options.expiration - Request expiration time in seconds
   * @returns The invoice information
   *
   * @throws {NIP47ClientError} with code INVALID_REQUEST if neither payment_hash nor invoice is provided
   * @throws {NIP47ClientError} with code NOT_FOUND if the invoice or payment hash is not found in the wallet's database
   * @throws {NIP47ClientError} with code LOOKUP_INVOICE_FAILED for other errors
   */
  public async lookupInvoice(
    params: { payment_hash?: string; invoice?: string },
    options?: { expiration?: number },
  ): Promise<NIP47Transaction> {
    // Check that at least one required parameter is provided
    if (!params.payment_hash && !params.invoice) {
      throw new NIP47ClientError(
        "Payment hash or invoice is required",
        NIP47ErrorCode.INVALID_REQUEST,
      );
    }

    try {
      const request: LookupInvoiceRequest = {
        method: NIP47Method.LOOKUP_INVOICE,
        params: {
          payment_hash: params.payment_hash,
          invoice: params.invoice,
        },
      };

      const response = await this.sendRequest(request, options?.expiration);

      // If we get here, the request was successful
      return response.result as NIP47Transaction;
    } catch (error: unknown) {
      if (error instanceof NIP47ClientError) {
        // Check specifically for NOT_FOUND errors
        if (error.code === NIP47ErrorCode.NOT_FOUND) {
          // Properly propagate NOT_FOUND errors with a clear message
          const lookupType = params.payment_hash ? "payment_hash" : "invoice";
          const lookupValue = params.payment_hash || params.invoice;

          throw new NIP47ClientError(
            `Invoice not found: Could not find ${lookupType}: ${lookupValue} in the wallet's database`,
            NIP47ErrorCode.NOT_FOUND,
          );
        }

        // Pass through other existing NIP47ClientError instances
        throw error;
      }

      // For other errors, we wrap with a generic LOOKUP_INVOICE_FAILED error
      const err = error instanceof Error ? error : new Error(String(error));
      throw new NIP47ClientError(
        `Error looking up invoice: ${err.message || "Unknown error"}`,
        NIP47ErrorCode.LOOKUP_INVOICE_FAILED,
        { originalError: error },
      );
    }
  }

  /**
   * List transactions
   */
  public async listTransactions(
    params: {
      from?: number;
      until?: number;
      limit?: number;
      offset?: number;
      unpaid?: boolean;
      type?: TransactionType | string;
    } = {},
    options?: { expiration?: number },
  ): Promise<ListTransactionsResponseResult> {
    const response = await this.sendRequest(
      {
        method: NIP47Method.LIST_TRANSACTIONS,
        params,
      },
      options?.expiration,
    );

    // Ensure we return a standardized format with a transactions array
    const result = response.result;

    if (Array.isArray(result)) {
      return { transactions: result as NIP47Transaction[] };
    }

    return result as ListTransactionsResponseResult;
  }

  /**
   * Sign a message with the wallet's private key
   */
  public async signMessage(
    message: string,
    options?: { expiration?: number },
  ): Promise<SignMessageResponseResult> {
    const response = await this.sendRequest(
      {
        method: NIP47Method.SIGN_MESSAGE,
        params: {
          message,
        },
      },
      options?.expiration,
    );
    return response.result as SignMessageResponseResult;
  }
}
