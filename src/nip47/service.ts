import { Nostr } from "../nip01/nostr";
import { NostrEvent } from "../types/nostr";
import { signEvent } from "../utils/crypto";
import { getEventHash } from "../nip01/event";
import { getUnixTime } from "../utils/time";
import { createEvent, createSignedEvent } from "../nip01/event";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import {
  NIP47Method,
  NIP47Request,
  NIP47Response,
  NIP47EventKind,
  NIP47Notification,
  WalletImplementation,
  NIP47ErrorCode,
  ERROR_CATEGORIES,
  ERROR_RECOVERY_HINTS,
  NIP47NotificationType,
  NIP47ResponseResult,
  NIP47EncryptionScheme,
} from "./types";
import {
  validateArrayAccess,
  safeArrayAccess,
  SecurityValidationError,
} from "../utils/security-validator";
import { maybeUnref } from "../utils/timers";
import { Logger, LogLevel } from "../utils/logger";
import type { DiagnosticLogger } from "../utils/logger";
import { dispatchNIP47Request } from "./requestDispatcher";
import { NIP47RequestParseError, parseNIP47Request } from "./protocol";

/**
 * TTL Map implementation with automatic cleanup
 */
class TTLMap<K, V> {
  private store = new Map<K, { value: V; expiry: number }>();
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 60000, maxSize: number = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    // Start periodic cleanup every 30 seconds
    this.startCleanup();
  }

  set(key: K, value: V): void {
    // Remove oldest entries if we're at max size
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    const expiry = Date.now() + this.ttlMs;
    this.store.set(key, { value, expiry });
  }

  get(key: K): V | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return undefined;
    }

    return item.value;
  }

  has(key: K): boolean {
    const item = this.store.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiry) {
        this.store.delete(key);
      }
    }
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    maybeUnref(this.cleanupInterval);
  }

  start(): void {
    this.startCleanup();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Options for the NostrWalletService
 */
export interface NostrWalletServiceOptions {
  /**
   * List of relay URLs to connect to
   */
  relays: string[];

  /**
   * Public key of the wallet service
   */
  pubkey: string;

  /**
   * Private key of the wallet service
   */
  privkey: string;

  /**
   * Name of the wallet service (optional)
   */
  name?: string;

  /**
   * Supported methods
   */
  methods: NIP47Method[];

  /**
   * Supported notification types
   */
  notificationTypes?: NIP47NotificationType[];

  /**
   * List of authorized client public keys.
   * If provided, only these clients will be able to use the service.
   * If not provided, all clients will be authorized (not recommended for production).
   */
  authorizedClients?: string[];

  /**
   * Supported encryption schemes (optional, defaults to both NIP-04 and NIP-44)
   */
  encryptionSchemes?: NIP47EncryptionScheme[];

  /** Optional logger. WARN/ERROR are enabled; INFO/DEBUG/TRACE are suppressed by default. */
  logger?: DiagnosticLogger;
}

/**
 * Nostr Wallet Service implementation
 *
 * This class provides an implementation of the NIP-47 wallet service protocol
 * which allows wallet providers to handle wallet operations over Nostr.
 */
export class NostrWalletService {
  private pubkey: string;
  private privkey: string;
  private relays: string[];
  private name: string;
  private client: Nostr;
  private logger: DiagnosticLogger;
  private supportedMethods: NIP47Method[];
  private supportedNotificationTypes: NIP47NotificationType[];
  private supportedEncryption: NIP47EncryptionScheme[];
  private walletImpl: WalletImplementation;
  private subIds: string[] = [];
  private authorizedClients: string[] = [];
  private requestEncryption: TTLMap<string, NIP47EncryptionScheme>; // Track encryption per request with TTL
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private disconnectionPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;

  constructor(
    options: NostrWalletServiceOptions,
    walletImpl: WalletImplementation,
  ) {
    if (!options.pubkey) {
      throw new Error("Missing pubkey in service options");
    }

    if (!options.privkey) {
      throw new Error("Missing privkey in service options");
    }

    if (!options.relays || options.relays.length === 0) {
      throw new Error("At least one relay must be specified");
    }

    if (!options.methods || options.methods.length === 0) {
      throw new Error("At least one method must be supported");
    }

    this.pubkey = options.pubkey;
    this.privkey = options.privkey;
    this.relays = options.relays;
    this.name = options.name || "NostrWalletService";
    this.supportedMethods = options.methods;
    this.supportedNotificationTypes = options.notificationTypes || [];
    this.supportedEncryption = options.encryptionSchemes || [
      NIP47EncryptionScheme.NIP44_V2,
      NIP47EncryptionScheme.NIP04,
    ];
    this.walletImpl = walletImpl;
    this.client = new Nostr(this.relays);
    this.logger =
      options.logger ??
      new Logger({ level: LogLevel.WARN, prefix: "nip47-service" });
    this.authorizedClients = options.authorizedClients || [];
    // Initialize TTL map with 5 minute TTL and max 1000 entries
    this.requestEncryption = new TTLMap<string, NIP47EncryptionScheme>(
      5 * 60 * 1000,
      1000,
    );
  }

  /**
   * Initialize the service, connect to relays, and publish capabilities
   */
  public init(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initializationPromise) return this.initializationPromise;

    const generation = this.lifecycleGeneration;
    const initialization = this.initialize(generation).finally(() => {
      if (this.initializationPromise === initialization) {
        this.initializationPromise = null;
      }
    });
    this.initializationPromise = initialization;
    return initialization;
  }

  /** Perform one initialization attempt after any active disconnect completes. */
  private async initialize(generation: number): Promise<void> {
    if (this.disconnectionPromise) {
      await this.disconnectionPromise;
    }
    this.assertInitializationCurrent(generation);
    if (this.initialized) return;

    let attemptSubIds: string[] = [];

    try {
      this.requestEncryption.start();

      await this.client.connectToRelays();
      this.assertInitializationCurrent(generation);
      this.logger.info("Service connected to configured relays");

      attemptSubIds = this.setupSubscription(generation);
      this.subIds = attemptSubIds;
      this.assertInitializationCurrent(generation);
      this.logger.info("Service subscribed to requests");

      await this.publishInfoEvent();
      this.assertInitializationCurrent(generation);
      this.logger.info(
        `Service published info event with methods: ${this.supportedMethods.join(", ")}`,
      );
      this.initialized = true;
    } catch (error) {
      if (attemptSubIds.length > 0) {
        this.client.unsubscribe(attemptSubIds);
      }
      if (this.subIds === attemptSubIds) {
        this.subIds = [];
      }
      if (generation === this.lifecycleGeneration) {
        this.initialized = false;
        this.requestEncryption.destroy();
        try {
          await this.client.disconnectFromRelays();
        } catch (disconnectError) {
          this.logger.error(
            "Error cleaning up failed service initialization:",
            disconnectError instanceof Error
              ? disconnectError
              : String(disconnectError),
          );
        }
      }
      throw error;
    }
  }

  /** Reject an initialization attempt invalidated by disconnect. */
  private assertInitializationCurrent(generation: number): void {
    if (generation !== this.lifecycleGeneration) {
      throw new Error("Service initialization cancelled by disconnect");
    }
  }

  /**
   * Disconnect from relays
   */
  public disconnect(): Promise<void> {
    if (this.disconnectionPromise) {
      if (this.initializationPromise) {
        this.lifecycleGeneration += 1;
        const invalidatedInitialization = this.initializationPromise;
        this.initializationPromise = null;
        this.observeInvalidatedInitialization(invalidatedInitialization);
      }
      return this.disconnectionPromise;
    }

    this.lifecycleGeneration += 1;
    this.initialized = false;
    const invalidatedInitialization = this.initializationPromise;
    this.initializationPromise = null;
    this.observeInvalidatedInitialization(invalidatedInitialization);

    const disconnection = this.performDisconnect(invalidatedInitialization).finally(
      () => {
        if (this.disconnectionPromise === disconnection) {
          this.disconnectionPromise = null;
        }
      },
    );
    this.disconnectionPromise = disconnection;
    return disconnection;
  }

  /** Prevent an expected cancellation from becoming an unhandled rejection. */
  private observeInvalidatedInitialization(
    initialization: Promise<void> | null,
  ): void {
    void initialization?.catch(() => {
      // Awaiters still receive the original rejection from initialization.
    });
  }

  /** Release all service-owned lifecycle resources. */
  private async performDisconnect(
    invalidatedInitialization: Promise<void> | null,
  ): Promise<void> {
    try {
      // Clean up TTL map
      this.requestEncryption.destroy();

      // Clean up subscriptions
      if (this.subIds.length > 0) {
        this.client.unsubscribe(this.subIds);
        this.subIds = [];
      }

      // Make sure we aren't leaving any pending operations
      try {
        await this.client.disconnectFromRelays();
      } catch (error) {
        this.logger.error(
          "Error disconnecting service from relays:",
          error instanceof Error ? error : String(error),
        );
      }

      if (invalidatedInitialization) {
        try {
          await invalidatedInitialization;
        } catch {
          // Disconnect intentionally invalidates an in-flight initialization.
        }
      }

      // Short delay to allow any other cleanup to complete
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        maybeUnref(t);
      });
    } catch (error) {
      this.logger.error(
        "Error during service disconnect:",
        error instanceof Error ? error : String(error),
      );
    }
  }

  /**
   * Publish the info event to advertise capabilities
   */
  private async publishInfoEvent(): Promise<void> {
    // Create tags
    const tags: string[][] = [];

    // Add encryption tag
    tags.push(["encryption", this.supportedEncryption.join(" ")]);

    // Add notifications tag if applicable
    if (this.supportedNotificationTypes.length > 0) {
      tags.push(["notifications", this.supportedNotificationTypes.join(" ")]);
    }

    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.INFO,
      content: this.supportedMethods.join(" "),
      tags,
    };

    // Create and sign the event
    const unsignedEvent = createEvent(eventTemplate, this.pubkey);
    const id = await getEventHash(unsignedEvent);
    const sig = await signEvent(id, this.privkey);

    // Create the full signed event
    const signedEvent: NostrEvent = {
      ...unsignedEvent,
      id,
      sig,
    };

    this.logger.debug(
      `Publishing INFO event with methods: ${this.supportedMethods.join(", ")}`,
    );

    // Publish the event
    await this.client.publishEvent(signedEvent);
  }

  /**
   * Set up subscription to receive requests
   */
  private setupSubscription(generation: number): string[] {
    // Subscribe to request events directed at this service
    const filter = {
      kinds: [NIP47EventKind.REQUEST],
      "#p": [this.pubkey],
    };

    return this.client.subscribe([filter], (event: NostrEvent) => {
      if (generation !== this.lifecycleGeneration) return;
      this.handleEvent(event);
    });
  }

  /**
   * Handle incoming events
   */
  private async handleEvent(event: NostrEvent): Promise<void> {
    if (event.kind !== NIP47EventKind.REQUEST) {
      return;
    }

    // Determine the pubkey of the client making the request
    const requesterClientPubkey = event.pubkey;

    // Determine the pubkey of the service (us) from the p-tag, if present, with safe access
    let servicePubkeyTagged: string | undefined;
    try {
      const pTag = event.tags.find((tag) => {
        try {
          return validateArrayAccess(tag, 0) && safeArrayAccess(tag, 0) === "p";
        } catch {
          return false;
        }
      });

      if (pTag && validateArrayAccess(pTag, 1)) {
        const pubkeyValue = safeArrayAccess(pTag, 1);
        if (typeof pubkeyValue === "string") {
          servicePubkeyTagged = pubkeyValue;
        }
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        this.logger.warn("NIP-47: Bounds checking error in p-tag parsing");
      }
    }

    if (!servicePubkeyTagged || servicePubkeyTagged !== this.pubkey) {
      // If there's no p-tag for us, or it's not for us, ignore.
      // Or, if strict, error back if p-tag is for someone else. For now, ignore.
      this.logger.warn(
        "Request not directly addressed to this service based on p-tag. Ignoring.",
      );
      return;
    }

    let decryptedContent: string | undefined;
    let nip47Request: NIP47Request | undefined;
    let encryptionSchemeStored = false;

    try {
      // Check for expiration (can be done before decryption) with safe access
      let expirationTimestamp: number | undefined;
      try {
        const expirationTag = event.tags.find((tag) => {
          try {
            return (
              validateArrayAccess(tag, 0) &&
              safeArrayAccess(tag, 0) === "expiration"
            );
          } catch {
            return false;
          }
        });

        if (expirationTag && validateArrayAccess(expirationTag, 1)) {
          const expirationValue = safeArrayAccess(expirationTag, 1);
          if (typeof expirationValue === "string") {
            const parsedExpiration = parseInt(expirationValue, 10);
            if (!isNaN(parsedExpiration)) {
              expirationTimestamp = parsedExpiration;
            }
          }
        }
      } catch (error) {
        if (error instanceof SecurityValidationError) {
          this.logger.warn(
            "NIP-47: Bounds checking error in expiration parsing",
          );
        }
      }

      if (expirationTimestamp) {
        const now = getUnixTime();
        if (now > expirationTimestamp) {
          this.logger.debug("Request has already expired");

          // Determine encryption scheme from the request for the error response
          const encryptionTag = event.tags.find(
            (tag) => tag[0] === "encryption",
          );
          let requestEncryption = NIP47EncryptionScheme.NIP04; // Default
          if (encryptionTag && encryptionTag[1] === "nip44_v2") {
            requestEncryption = NIP47EncryptionScheme.NIP44_V2;
          }

          // Store the encryption scheme temporarily for the error response
          this.requestEncryption.set(event.id, requestEncryption);
          encryptionSchemeStored = true;

          // Send error response for already expired request
          // The recipient is the original requester (event.pubkey)
          // The second parameter to sendErrorResponse is 'senderPubkey' (effectively, who was targeted, i.e. this.pubkey)
          await this.sendErrorResponse(
            requesterClientPubkey,
            this.pubkey, // The service is the context for this "sender"
            NIP47ErrorCode.REQUEST_EXPIRED,
            "Request has expired",
            event.id,
            NIP47Method.UNKNOWN, // Method is unknown before decryption
          );
          return;
        }
      }

      // Check if client is authorized (can also be done before decryption)
      if (
        this.authorizedClients.length > 0 &&
        !this.authorizedClients.includes(requesterClientPubkey)
      ) {
        this.logger.error("Client is not authorized to use the service");

        // Determine encryption scheme from the request for the error response
        const encryptionTag = event.tags.find((tag) => tag[0] === "encryption");
        let requestEncryption = NIP47EncryptionScheme.NIP04; // Default
        if (encryptionTag && encryptionTag[1] === "nip44_v2") {
          requestEncryption = NIP47EncryptionScheme.NIP44_V2;
        }

        // Store the encryption scheme temporarily for the error response
        this.requestEncryption.set(event.id, requestEncryption);
        encryptionSchemeStored = true;

        await this.sendErrorResponse(
          requesterClientPubkey,
          this.pubkey,
          NIP47ErrorCode.UNAUTHORIZED_CLIENT,
          "Client not authorized to use this wallet service",
          event.id,
          NIP47Method.UNKNOWN,
        );
        return;
      }

      this.logger.debug("Handling NIP-47 request");

      // Extract encryption scheme from request
      let requestEncryption: NIP47EncryptionScheme =
        NIP47EncryptionScheme.NIP04; // Default
      try {
        const encryptionTag = event.tags.find((tag) => {
          try {
            return (
              validateArrayAccess(tag, 0) &&
              safeArrayAccess(tag, 0) === "encryption"
            );
          } catch {
            return false;
          }
        });

        if (encryptionTag && validateArrayAccess(encryptionTag, 1)) {
          const encryptionValue = safeArrayAccess(encryptionTag, 1);
          if (
            typeof encryptionValue === "string" &&
            Object.values(NIP47EncryptionScheme).includes(
              encryptionValue as NIP47EncryptionScheme,
            )
          ) {
            requestEncryption = encryptionValue as NIP47EncryptionScheme;
          }
        }
      } catch (error) {
        if (error instanceof SecurityValidationError) {
          this.logger.warn(
            "NIP-47: Bounds checking error in encryption tag parsing",
          );
        }
      }

      // Check if we support the requested encryption
      if (!this.supportedEncryption.includes(requestEncryption)) {
        this.logger.error(
          `Unsupported encryption scheme: ${requestEncryption}`,
        );
        // Since we can't decrypt, we can't send an encrypted error response
        // Following NIP-47 spec, we should not respond
        return;
      }

      // Store the encryption scheme for this request
      this.requestEncryption.set(event.id, requestEncryption);
      encryptionSchemeStored = true;

      try {
        if (requestEncryption === NIP47EncryptionScheme.NIP44_V2) {
          decryptedContent = await decryptNIP44(
            event.content,
            this.privkey,
            requesterClientPubkey,
          );
        } else {
          decryptedContent = decryptNIP04(
            this.privkey,
            requesterClientPubkey,
            event.content,
          );
        }
        this.logger.trace("Successfully decrypted request content");
      } catch (decryptError) {
        this.logger.error(
          "Failed to decrypt message:",
          decryptError instanceof Error ? decryptError : String(decryptError),
        );
        // Do not send an error response here as per NIP-47 spec (section: "failed to decrypt")
        // "The recipient SHOULD NOT send a response event if it cannot decrypt the content."
        return;
      }

      nip47Request = parseNIP47Request(decryptedContent);

      // Now that we have the request method, we can use it if an expiration occurs during processing

      if (expirationTimestamp) {
        const nowMs = Date.now();
        const expirationMs = expirationTimestamp * 1000;
        const timeoutDurationMs = expirationMs - nowMs;

        if (timeoutDurationMs <= 0) {
          // This case should ideally be caught by the earlier check, but as a safeguard after decryption:
          this.logger.debug(
            `Request (method: ${nip47Request.method}) expired just before wallet call`,
          );
          const errorRsp = this.createErrorResponse(
            nip47Request.method,
            NIP47ErrorCode.REQUEST_EXPIRED,
            "Request has expired",
          );
          await this.sendResponse(requesterClientPubkey, errorRsp, event.id);
          return;
        }

        let timeoutHandle: NodeJS.Timeout | undefined;

        const walletCallPromise = this.handleRequest(nip47Request).finally(
          () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          },
        );

        const timeoutPromise = new Promise<NIP47Response>((resolve) => {
          timeoutHandle = setTimeout(() => {
            this.logger.debug(
              `Request (method: ${nip47Request!.method}) timed out during wallet processing`,
            );
            resolve(
              this.createErrorResponse(
                nip47Request!.method, // nip47Request is guaranteed to be defined here
                NIP47ErrorCode.REQUEST_EXPIRED,
                "Request expired during processing",
              ),
            );
          }, timeoutDurationMs);
        });

        const response = await Promise.race([
          walletCallPromise,
          timeoutPromise,
        ]);
        // Ensure timeout is cleared if it hasn't fired and walletCall won, or if it did fire.
        if (timeoutHandle) clearTimeout(timeoutHandle);

        await this.sendResponse(requesterClientPubkey, response, event.id);
      } else {
        // No valid expiration tag, proceed normally
        const response = await this.handleRequest(nip47Request);
        await this.sendResponse(requesterClientPubkey, response, event.id);
      }
    } catch (error) {
      // General error handling for unexpected issues during the try block
      // (e.g., JSON parsing error if content is not valid JSON after decryption, or other unexpected errors)
      this.logger.error(
        "Error processing request:",
        error instanceof Error ? error : String(error),
      );

      // Determine method if possible, otherwise use UNKNOWN
      const methodForError = nip47Request?.method || NIP47Method.UNKNOWN;

      // It's important not to send an error response if the initial error was due to decryption failure
      // which is handled by returning early without response.
      // This catch block is for errors *after* successful decryption or if decryption wasn't the issue.
      if (decryptedContent !== undefined) {
        // Check if decryption was attempted and potentially successful
        await this.sendErrorResponse(
          requesterClientPubkey,
          this.pubkey,
          error instanceof NIP47RequestParseError
            ? NIP47ErrorCode.INVALID_REQUEST
            : NIP47ErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal server error",
          event.id,
          methodForError,
        );
      } else {
        // If decryption was not even attempted or failed in a way that decryptedContent is still undefined,
        // and we somehow reached here, log it but don't send NIP-47 error to avoid breaking NIP-47 rule for decryption failure.
        this.logger.error(
          "Unhandled error where decryption state is unclear. No response sent.",
        );
      }
    } finally {
      // Clean up stored encryption scheme if it was stored
      if (encryptionSchemeStored && this.requestEncryption.has(event.id)) {
        this.requestEncryption.delete(event.id);
      }
    }
  }

  /**
   * Send a response to a client
   */
  private async sendResponse(
    clientPubkey: string,
    response: NIP47Response,
    requestId: string,
  ): Promise<void> {
    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.RESPONSE,
      content: "",
      tags: [
        ["p", clientPubkey],
        ["e", requestId],
      ],
    };

    // Create the event
    const unsignedEvent = createEvent(eventTemplate, this.pubkey);

    this.logger.debug("Encrypting response");
    this.logger.debug("Response will reference the correlated request");

    // Get the encryption scheme used in the request
    const encryptionScheme =
      this.requestEncryption.get(requestId) || NIP47EncryptionScheme.NIP04;

    // Clean up after retrieving
    this.requestEncryption.delete(requestId);

    // Encrypt with the same scheme as the request
    let encryptedContent: string;
    if (encryptionScheme === NIP47EncryptionScheme.NIP44_V2) {
      encryptedContent = await encryptNIP44(
        JSON.stringify(response),
        this.privkey,
        clientPubkey,
      );
    } else {
      encryptedContent = encryptNIP04(
        this.privkey,
        clientPubkey,
        JSON.stringify(response),
      );
    }

    unsignedEvent.content = encryptedContent;

    // Sign the event
    const signedEvent = await createSignedEvent(unsignedEvent, this.privkey);

    this.logger.debug("Sending response for correlated request");

    // Publish the event
    await this.client.publishEvent(signedEvent);
    this.logger.debug("Response published successfully");
  }

  /**
   * Create a properly formatted successful response according to NIP-47 spec
   */
  private createSuccessResponse(
    method: NIP47Method,
    result: NIP47ResponseResult,
  ): NIP47Response {
    return {
      result_type: method,
      result,
      error: null,
    };
  }

  /**
   * Create a properly formatted error response according to NIP-47 spec
   */
  private createErrorResponse(
    method: NIP47Method,
    errorCode: NIP47ErrorCode,
    errorMessage: string,
    data?: Record<string, unknown>,
  ): NIP47Response {
    // Determine error category and recovery hint
    const category = ERROR_CATEGORIES[errorCode];
    const recoveryHint = ERROR_RECOVERY_HINTS[errorCode];

    return {
      result_type: method,
      result: null,
      error: {
        code: errorCode,
        message: errorMessage,
        category,
        recoveryHint,
        data,
      },
    };
  }

  /** Delegate pure parameter validation and wallet invocation. */
  private handleRequest(request: NIP47Request): Promise<NIP47Response> {
    return dispatchNIP47Request(request, {
      wallet: this.walletImpl,
      supportedMethods: this.supportedMethods,
      supportedEncryption: this.supportedEncryption,
    });
  }

  /**
   * Send a notification to a client
   */
  public async sendNotification(
    clientPubkey: string,
    type: NIP47NotificationType,
    notification: Record<string, unknown>,
  ): Promise<void> {
    // Check if notification type is supported
    if (!this.supportedNotificationTypes.includes(type)) {
      throw new Error(`Notification type ${type} not supported`);
    }

    // Create the notification object
    const notificationObj: NIP47Notification = {
      notification_type: type,
      notification,
    };

    // Send notifications for each supported encryption scheme
    const publishPromises: Promise<void>[] = [];

    // Send NIP-04 encrypted notification if supported
    if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP04)) {
      const nip04Promise = (async () => {
        try {
          const eventTemplate = {
            kind: NIP47EventKind.NOTIFICATION,
            content: "",
            tags: [["p", clientPubkey]],
          };

          const unsignedEvent = createEvent(eventTemplate, this.pubkey);
          const encryptedContent = encryptNIP04(
            this.privkey,
            clientPubkey,
            JSON.stringify(notificationObj),
          );
          unsignedEvent.content = encryptedContent;

          const signedEvent = await createSignedEvent(
            unsignedEvent,
            this.privkey,
          );
          await this.client.publishEvent(signedEvent);

          this.logger.debug("Successfully sent NIP-04 notification");
        } catch (error) {
          this.logger.error(
            "Failed to send NIP-04 notification:",
            error instanceof Error ? error.message : String(error),
          );
          // Don't rethrow - allow other notifications to be sent
        }
      })();
      publishPromises.push(nip04Promise);
    }

    // Send NIP-44 encrypted notification if supported
    if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP44_V2)) {
      const nip44Promise = (async () => {
        try {
          const eventTemplate = {
            kind: NIP47EventKind.NOTIFICATION_NIP44,
            content: "",
            tags: [["p", clientPubkey]],
          };

          const unsignedEvent = createEvent(eventTemplate, this.pubkey);
          const encryptedContent = await encryptNIP44(
            JSON.stringify(notificationObj),
            this.privkey,
            clientPubkey,
          );
          unsignedEvent.content = encryptedContent;

          const signedEvent = await createSignedEvent(
            unsignedEvent,
            this.privkey,
          );
          await this.client.publishEvent(signedEvent);

          this.logger.debug("Successfully sent NIP-44 notification");
        } catch (error) {
          this.logger.error(
            "Failed to send NIP-44 notification:",
            error instanceof Error ? error.message : String(error),
          );
          // Don't rethrow - allow other notifications to be sent
        }
      })();
      publishPromises.push(nip44Promise);
    }

    // Wait for all notifications to complete (success or failure)
    await Promise.all(publishPromises);
  }

  /**
   * Send an error response to a client
   */
  private async sendErrorResponse(
    clientPubkey: string,
    serviceContextPubkey: string,
    errorCode: NIP47ErrorCode,
    errorMessage: string,
    requestId: string,
    method: NIP47Method,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // Create error response using the utility method
    const response = this.createErrorResponse(
      method,
      errorCode,
      errorMessage,
      data,
    );

    // Send response TO the clientPubkey (the original requester)
    await this.sendResponse(clientPubkey, response, requestId);
  }
}
