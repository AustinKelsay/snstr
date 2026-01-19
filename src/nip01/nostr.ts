import { Relay } from "./relay";
import {
  NostrEvent,
  Filter,
  RelayEvent,
  ParsedOkReason,
  SubscriptionOptions,
} from "../types/nostr";
import { getPublicKey, generateKeypair } from "../utils/crypto";
import { isValidRelayUrl } from "../nip19";
import {
  createSignedEvent,
  createTextNote,
  createDirectMessage,
  createMetadataEvent,
} from "./event";
import {
  preprocessRelayUrl as preprocessRelayUrlUtil,
  normalizeRelayUrl as normalizeRelayUrlUtil,
  RelayUrlValidationError,
} from "../utils/relayUrl";
import { Logger, LogLevel } from "../nip46/utils/logger";
import {
  validateFilters,
  validateEventContent,
  validateTags,
  validateNumber,
  SecurityValidationError,
  checkRateLimit,
  RateLimitState,
  SECURITY_LIMITS,
} from "../utils/security-validator";

/**
 * Rate limit configuration for different operation types
 */
export interface RateLimitConfig {
  /** Maximum number of operations allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Configuration options for rate limiting different Nostr operations
 */
export interface NostrRateLimits {
  /** Rate limits for subscription operations */
  subscribe?: RateLimitConfig;
  /** Rate limits for publish operations */
  publish?: RateLimitConfig;
  /** Rate limits for fetch operations */
  fetch?: RateLimitConfig;
}

/**
 * Options for Nostr client configuration
 */
export interface NostrOptions {
  /** Options to pass to each Relay instance */
  relayOptions?: {
    connectionTimeout?: number;
    bufferFlushDelay?: number;
  };
  /** Rate limiting configuration for different operations */
  rateLimits?: NostrRateLimits;
}

// Types for Nostr.on() callbacks (user-provided)
export type NostrConnectCallback = (relay: string) => void;
export type NostrErrorCallback = (relay: string, error: unknown) => void;
export type NostrNoticeCallback = (relay: string, notice: string) => void;
export type NostrOkCallback = (
  relay: string,
  eventId: string,
  success: boolean,
  details: ParsedOkReason,
) => void;
export type NostrClosedCallback = (
  relay: string,
  subscriptionId: string,
  message: string,
) => void;
export type NostrAuthCallback = (
  relay: string,
  challengeEvent: NostrEvent,
) => void;

export type NostrEventCallback =
  | NostrConnectCallback
  | NostrErrorCallback
  | NostrNoticeCallback
  | NostrOkCallback
  | NostrClosedCallback
  | NostrAuthCallback;

// Types for handlers passed to Relay.on() (internal)
type RelayConnectHandler = () => void;
type RelayErrorHandler = (error: unknown) => void;
type RelayNoticeHandler = (notice: string) => void;
type RelayOkHandler = (
  eventId: string,
  success: boolean,
  details: ParsedOkReason,
) => void;
type RelayClosedHandler = (subscriptionId: string, message: string) => void;
type RelayAuthHandler = (challengeEvent: NostrEvent) => void;

type RelayEventHandler =
  | RelayConnectHandler
  | RelayErrorHandler
  | RelayNoticeHandler
  | RelayOkHandler
  | RelayClosedHandler
  | RelayAuthHandler;

export class Nostr {
  private relays: Map<string, Relay> = new Map();
  private privateKey?: string;
  private publicKey?: string;
  private relayOptions?: {
    connectionTimeout?: number;
    bufferFlushDelay?: number;
  };
  private eventCallbacks: Map<RelayEvent, Set<NostrEventCallback>> = new Map();
  private logger: Logger;

  // Rate limiting state
  private subscribeRateLimit: RateLimitState = {
    count: 0,
    windowStart: Date.now(),
    blocked: false,
  };

  private publishRateLimit: RateLimitState = {
    count: 0,
    windowStart: Date.now(),
    blocked: false,
  };

  private fetchRateLimit: RateLimitState = {
    count: 0,
    windowStart: Date.now(),
    blocked: false,
  };

  // Rate limiting configuration
  private RATE_LIMITS: {
    SUBSCRIBE: RateLimitConfig;
    PUBLISH: RateLimitConfig;
    FETCH: RateLimitConfig;
  };

  /**
   * Create a new Nostr client
   * @param relayUrls List of relay URLs to connect to
   * @param options Client options
   * @param options.relayOptions Options to pass to each Relay instance
   * @param options.rateLimits Rate limiting configuration for different operations
   */
  constructor(relayUrls: string[] = [], options?: NostrOptions) {
    this.relayOptions = options?.relayOptions;

    // Initialize rate limits with defaults or user-provided values
    this.RATE_LIMITS = {
      SUBSCRIBE: options?.rateLimits?.subscribe || {
        limit: 50,
        windowMs: 60000,
      }, // 50 subscriptions per minute
      PUBLISH: options?.rateLimits?.publish || { limit: 100, windowMs: 60000 }, // 100 publications per minute
      FETCH: options?.rateLimits?.fetch || { limit: 200, windowMs: 60000 }, // 200 fetches per minute
    };

    this.logger = new Logger({
      prefix: "Nostr",
      level: LogLevel.WARN,
      includeTimestamp: false,
      silent: process.env.NODE_ENV === "test",
    });
    relayUrls.forEach((url) => this.addRelay(url));
  }

  /**
   * Normalize a relay URL by lowercasing only the scheme and host,
   * while preserving the case of path, query, and fragment parts.
   * This is the correct behavior per URL standards.
   */
  private normalizeRelayUrl(url: string): string {
    // Delegate to shared utility for consistent canonicalization
    return normalizeRelayUrlUtil(url);
  }

  /**
   * Preprocesses a relay URL before normalization and validation.
   * Adds wss:// prefix only to URLs without any scheme.
   * Throws an error for URLs with incompatible schemes.
   *
   * @param url - The input URL string to preprocess
   * @returns The preprocessed URL with appropriate scheme
   * @throws Error if URL has an incompatible scheme
   */
  private preprocessRelayUrl(url: string): string {
    // Delegate to shared utility for consistent preprocessing
    return preprocessRelayUrlUtil(url);
  }

  // Helper function to create the event handler wrapper
  private _createRelayEventHandler(
    relayUrl: string,
    originalCallback: NostrEventCallback, // This is the callback provided by the user to Nostr.on()
    event: RelayEvent,
  ): RelayEventHandler {
    switch (event) {
      case RelayEvent.Connect:
      case RelayEvent.Disconnect:
        return () => {
          (originalCallback as NostrConnectCallback)(relayUrl);
        };
      case RelayEvent.Error:
        return (error: unknown) => {
          (originalCallback as NostrErrorCallback)(relayUrl, error);
        };
      case RelayEvent.Notice:
        return (notice: string) => {
          (originalCallback as NostrNoticeCallback)(relayUrl, notice);
        };
      case RelayEvent.OK:
        return (eventId: string, success: boolean, details: ParsedOkReason) => {
          (originalCallback as NostrOkCallback)(
            relayUrl,
            eventId,
            success,
            details,
          );
        };
      case RelayEvent.Closed:
        return (subscriptionId: string, message: string) => {
          (originalCallback as NostrClosedCallback)(
            relayUrl,
            subscriptionId,
            message,
          );
        };
      case RelayEvent.Auth:
        return (challengeEvent: NostrEvent) => {
          (originalCallback as NostrAuthCallback)(relayUrl, challengeEvent);
        };
      default:
        // Should not happen if RelayEvent enum is comprehensive
        console.warn(
          `Unhandled RelayEvent type for handler creation: ${event}`,
        );
        // This case should ideally be impossible if RelayEvent is exhaustive
        // and all cases are handled. Return a no-op that matches a common handler signature.
        return () => {};
    }
  }

  public addRelay(url: string): Relay {
    url = this.preprocessRelayUrl(url);
    url = this.normalizeRelayUrl(url);
    if (!isValidRelayUrl(url)) {
      throw new Error(`Invalid relay URL: ${url}`);
    }

    if (this.relays.has(url)) {
      return this.relays.get(url)!;
    }

    const relay = new Relay(url, this.relayOptions);
    this.relays.set(url, relay);

    // Attach stored callbacks to the new relay
    this.eventCallbacks.forEach((callbacksSet, eventType) => {
      callbacksSet.forEach((originalCallback: NostrEventCallback) => {
        const handler = this._createRelayEventHandler(
          url,
          originalCallback,
          eventType,
        );
        // Attach handler to the new relay, using the appropriate signature
        switch (eventType) {
          case RelayEvent.Connect:
          case RelayEvent.Disconnect:
            relay.on(eventType, handler as RelayConnectHandler);
            break;
          case RelayEvent.Error:
            relay.on(eventType, handler as RelayErrorHandler);
            break;
          case RelayEvent.Notice:
            relay.on(eventType, handler as RelayNoticeHandler);
            break;
          case RelayEvent.OK:
            relay.on(eventType, handler as RelayOkHandler);
            break;
          case RelayEvent.Closed:
            relay.on(eventType, handler as RelayClosedHandler);
            break;
          case RelayEvent.Auth:
            relay.on(eventType, handler as RelayAuthHandler);
            break;
        }
      });
    });

    return relay;
  }

  public getRelay(url: string): Relay | undefined {
    // Re-use the same normalisation logic as addRelay()
    try {
      url = this.preprocessRelayUrl(url);
      url = this.normalizeRelayUrl(url);
      if (!isValidRelayUrl(url)) {
        return undefined;
      }
      return this.relays.get(url);
    } catch (error) {
      // Handle RelayUrlValidationError and other URL processing errors gracefully
      if (error instanceof RelayUrlValidationError) {
        return undefined;
      }
      // For other unexpected errors, also return undefined for graceful handling
      return undefined;
    }
  }

  public removeRelay(url: string): void {
    // Re-use the same normalisation logic as addRelay() and getRelay()
    try {
      url = this.preprocessRelayUrl(url);
      url = this.normalizeRelayUrl(url);
      if (!isValidRelayUrl(url)) {
        return;
      }

      const relay = this.relays.get(url);
      if (relay) {
        relay.disconnect();
        this.relays.delete(url);
      }
    } catch (error) {
      // Handle RelayUrlValidationError and other URL processing errors gracefully
      if (error instanceof RelayUrlValidationError) {
        return; // Silently ignore invalid URLs as intended
      }
      // For other unexpected errors, also return void for graceful handling
      return;
    }
  }

  public async connectToRelays(): Promise<void> {
    const connectPromises = Array.from(this.relays.values()).map((relay) =>
      relay.connect(),
    );
    await Promise.all(connectPromises);
  }

  public disconnectFromRelays(): void {
    this.relays.forEach((relay) => relay.disconnect());
  }

  public setPrivateKey(privateKey: string): void {
    this.privateKey = privateKey;
    this.publicKey = getPublicKey(privateKey);
  }

  public async generateKeys(): Promise<{
    privateKey: string;
    publicKey: string;
  }> {
    const keypair = await generateKeypair();
    this.privateKey = keypair.privateKey;
    this.publicKey = keypair.publicKey;
    return keypair;
  }

  public getPublicKey(): string | undefined {
    return this.publicKey;
  }

  /**
   * Get current rate limit configuration
   * @returns Current rate limit settings
   */
  public getRateLimits(): NostrRateLimits {
    return {
      subscribe: { ...this.RATE_LIMITS.SUBSCRIBE },
      publish: { ...this.RATE_LIMITS.PUBLISH },
      fetch: { ...this.RATE_LIMITS.FETCH },
    };
  }

  /**
   * Update rate limit configuration
   * @param rateLimits New rate limit settings (partial updates allowed)
   */
  public updateRateLimits(rateLimits: NostrRateLimits): void {
    if (rateLimits.subscribe) {
      this.RATE_LIMITS.SUBSCRIBE = { ...rateLimits.subscribe };
      // Reset rate limit state to prevent issues with changed limits
      this.subscribeRateLimit = {
        count: 0,
        windowStart: Date.now(),
        blocked: false,
      };
    }

    if (rateLimits.publish) {
      this.RATE_LIMITS.PUBLISH = { ...rateLimits.publish };
      this.publishRateLimit = {
        count: 0,
        windowStart: Date.now(),
        blocked: false,
      };
    }

    if (rateLimits.fetch) {
      this.RATE_LIMITS.FETCH = { ...rateLimits.fetch };
      this.fetchRateLimit = {
        count: 0,
        windowStart: Date.now(),
        blocked: false,
      };
    }
  }

  /**
   * Reset rate limit counters for all operations
   */
  public resetRateLimits(): void {
    this.subscribeRateLimit = {
      count: 0,
      windowStart: Date.now(),
      blocked: false,
    };

    this.publishRateLimit = {
      count: 0,
      windowStart: Date.now(),
      blocked: false,
    };

    this.fetchRateLimit = {
      count: 0,
      windowStart: Date.now(),
      blocked: false,
    };
  }

  public async publishEvent(
    event: NostrEvent,
    options?: { timeout?: number },
  ): Promise<{
    success: boolean;
    event: NostrEvent | null;
    relayResults: Map<string, { success: boolean; reason?: string }>;
  }> {
    if (!this.relays.size) {
      this.logger.warn("No relays configured for publishing", {
        eventId: event.id,
        eventKind: event.kind,
        operation: "publishEvent",
      });

      return {
        success: false,
        event: null,
        relayResults: new Map(),
      };
    }

    try {
      const relayResults = new Map<
        string,
        { success: boolean; reason?: string }
      >();
      const publishPromises = Array.from(this.relays.entries()).map(
        async ([url, relay]) => {
          const result = await relay.publish(event, options);
          relayResults.set(url, result);
          return result;
        },
      );

      const results = await Promise.all(publishPromises);

      // Check if at least one relay accepted the event
      const atLeastOneSuccess = results.some((result) => result.success);

      if (atLeastOneSuccess) {
        return {
          success: true,
          event,
          relayResults,
        };
      } else {
        // Get reasons for failures and log them for diagnostics
        const failureReasons = Array.from(relayResults.entries())
          .filter(([_, result]) => !result.success)
          .map(([url, result]) => `${url}: ${result.reason || "unknown"}`);

        this.logger.warn("Failed to publish event to any relay", {
          eventId: event.id,
          eventKind: event.kind,
          failureCount: failureReasons.length,
          failures: failureReasons,
        });

        return {
          success: false,
          event: null,
          relayResults,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";

      this.logger.error("Failed to publish event", {
        eventId: event.id,
        eventKind: event.kind,
        error: errorMessage,
      });

      return {
        success: false,
        event: null,
        relayResults: new Map(),
      };
    }
  }

  public async publishTextNote(
    content: string,
    tags: string[][] = [],
    options?: { timeout?: number },
  ): Promise<NostrEvent | null> {
    // Rate limiting check
    const rateLimitCheck = checkRateLimit(
      this.publishRateLimit,
      this.RATE_LIMITS.PUBLISH.limit,
      this.RATE_LIMITS.PUBLISH.windowMs,
    );

    if (!rateLimitCheck.allowed) {
      throw new SecurityValidationError(
        `Publish rate limit exceeded. Try again in ${Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)} seconds`,
        "RATE_LIMIT_EXCEEDED",
        "publish",
      );
    }

    // Update rate limit state (increment count)
    this.publishRateLimit.count++;

    if (!this.privateKey || !this.publicKey) {
      throw new Error("Private key is not set");
    }

    // Validate inputs
    try {
      const validatedContent = validateEventContent(content);
      const validatedTags = validateTags(tags);

      // Calculate actual UTF-8 byte length for proper size validation
      const contentByteLength = new TextEncoder().encode(
        validatedContent,
      ).length;
      if (contentByteLength > SECURITY_LIMITS.MAX_CONTENT_SIZE) {
        throw new Error(
          `Content too large: ${contentByteLength} bytes (max ${SECURITY_LIMITS.MAX_CONTENT_SIZE})`,
        );
      }

      const noteTemplate = createTextNote(
        validatedContent,
        this.privateKey,
        validatedTags,
      );
      const signedEvent = await createSignedEvent(
        noteTemplate,
        this.privateKey,
      );

      const publishResult = await this.publishEvent(signedEvent, options);
      return publishResult.success ? publishResult.event : null;
    } catch (error) {
      throw new Error(
        `publishTextNote validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  public async publishDirectMessage(
    content: string,
    recipientPubkey: string,
    tags: string[][] = [],
    options?: { timeout?: number },
  ): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error("Private key is not set");
    }

    const dmTemplate = await createDirectMessage(
      content,
      recipientPubkey,
      this.privateKey,
      tags,
    );
    const signedEvent = await createSignedEvent(dmTemplate, this.privateKey);

    const publishResult = await this.publishEvent(signedEvent, options);
    return publishResult.success ? publishResult.event : null;
  }

  /**
   * Decrypt a direct message received from another user
   *
   * Uses NIP-04 encryption which is the standard for kind:4 direct messages
   */
  public decryptDirectMessage(event: NostrEvent): string {
    if (!this.privateKey) {
      throw new Error("Private key is not set");
    }

    if (event.kind !== 4) {
      throw new Error("Event is not a direct message (kind 4)");
    }

    // In a direct message:
    // - The sender's pubkey is in event.pubkey
    // - The recipient's pubkey is in the 'p' tag
    // We need to use our private key and the sender's pubkey to decrypt

    const senderPubkey = event.pubkey;

    // Double-check that the message was intended for us
    const pTag = event.tags.find((tag) => tag[0] === "p");
    if (!pTag || !pTag[1]) {
      throw new Error("Direct message is missing recipient pubkey in p tag");
    }

    const recipientPubkey = pTag[1];

    // If we're not the intended recipient, we shouldn't be able to decrypt this
    if (this.publicKey && recipientPubkey !== this.publicKey) {
      this.logger.warn("Direct message not intended for this user", {
        recipientPubkey,
        currentUserPubkey: this.publicKey,
        senderPubkey,
      });
    }

    // Decrypt the message using our private key and the sender's pubkey
    try {
      const decryptNIP04: (priv: string, pub: string, c: string) => string =
        (() => {
          // Prefer Node path when running under Node (tests)
          try {
            // eslint-disable-next-line no-eval
            if (
              typeof process !== "undefined" &&
              process.versions &&
              process.versions.node
            ) {
              return eval('require("../nip04")').decrypt;
            }
          } catch (_e) {
            // eslint-disable-next-line no-empty
          }
          // Fallback to web/RN path
          try {
            // eslint-disable-next-line no-eval
            return eval('require("../nip04/web")').decrypt;
          } catch (_e) {
            // eslint-disable-next-line no-empty
          }
          throw new Error("NIP-04 module not available in this environment");
        })();
      return decryptNIP04(this.privateKey, senderPubkey, event.content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";

      this.logger.error("Failed to decrypt direct message", {
        eventId: event.id,
        senderPubkey,
        recipientPubkey,
        error: errorMessage,
      });

      throw new Error(
        "Failed to decrypt message. Make sure you are the intended recipient.",
      );
    }
  }

  public async publishMetadata(
    metadata: Record<string, string | number | boolean | null | undefined>,
    options?: { timeout?: number },
  ): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error("Private key is not set");
    }

    const metadataTemplate = createMetadataEvent(metadata, this.privateKey);
    const signedEvent = await createSignedEvent(
      metadataTemplate,
      this.privateKey,
    );

    const publishResult = await this.publishEvent(signedEvent, options);
    return publishResult.success ? publishResult.event : null;
  }

  public subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent, relay: string) => void,
    onEOSE?: () => void,
    options: SubscriptionOptions = {},
  ): string[] {
    // Rate limiting check
    const rateLimitCheck = checkRateLimit(
      this.subscribeRateLimit,
      this.RATE_LIMITS.SUBSCRIBE.limit,
      this.RATE_LIMITS.SUBSCRIBE.windowMs,
    );

    if (!rateLimitCheck.allowed) {
      throw new SecurityValidationError(
        `Subscription rate limit exceeded. Try again in ${Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)} seconds`,
        "RATE_LIMIT_EXCEEDED",
        "subscribe",
      );
    }

    // Update rate limit state (increment count)
    this.subscribeRateLimit.count++;

    // Validate filters before sending to relays
    try {
      const validatedFilters = validateFilters(filters);
      const subscriptionIds: string[] = [];

      this.relays.forEach((relay, url) => {
        const id = relay.subscribe(
          validatedFilters,
          (event) => onEvent(event, url),
          onEOSE,
          options,
        );
        subscriptionIds.push(id);
      });

      return subscriptionIds;
    } catch (error) {
      throw new Error(
        `Filter validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  public unsubscribe(subscriptionIds: string[]): void {
    this.relays.forEach((relay) => {
      subscriptionIds.forEach((id) => relay.unsubscribe(id));
    });
  }

  public unsubscribeAll(): void {
    // Clear all subscriptions on all relays
    this.relays.forEach((relay) => {
      // Get all subscription IDs for this relay
      const subscriptionIds = Array.from(relay.getSubscriptionIds());

      // Close each subscription properly
      subscriptionIds.forEach((id) => relay.unsubscribe(id));
    });
  }

  /**
   * Collect events matching the given filters from all connected relays.
   *
   * @param filters Array of filters to apply
   * @param options Optional max wait time in milliseconds (defaults to 5000ms if not provided)
   * @returns Promise resolving to all received events
   */
  public async fetchMany(
    filters: Filter[],
    options: { maxWait?: number; signal?: AbortSignal } = {},
  ): Promise<NostrEvent[]> {
    // Rate limiting check
    const rateLimitCheck = checkRateLimit(
      this.fetchRateLimit,
      this.RATE_LIMITS.FETCH.limit,
      this.RATE_LIMITS.FETCH.windowMs,
    );

    if (!rateLimitCheck.allowed) {
      throw new SecurityValidationError(
        `Fetch rate limit exceeded. Try again in ${Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)} seconds`,
        "RATE_LIMIT_EXCEEDED",
        "fetch",
      );
    }

    // Update rate limit state (increment count)
    this.fetchRateLimit.count++;

    if (this.relays.size === 0) return [];

    // Validate inputs
    try {
      const validatedFilters = validateFilters(filters);
      const maxWait = options.maxWait
        ? validateNumber(options.maxWait, 0, 300000, "fetchMany.maxWait")
        : 5000;

      return new Promise((resolve, reject) => {
        const eventsMap = new Map<string, NostrEvent>();
        let eoseCount = 0;
        let isCleanedUp = false;

        const subIds = this.subscribe(
          validatedFilters,
          (event) => {
            eventsMap.set(event.id, event);
          },
          () => {
            eoseCount++;
            if (eoseCount >= this.relays.size) {
              cleanup(false);
            }
          },
        );

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let abortListener: (() => void) | null = null;

        const cleanup = (isAborted = false) => {
          if (isCleanedUp) return; // Prevent multiple cleanup executions
          isCleanedUp = true;

          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          // Remove abort listener to prevent memory leaks
          if (abortListener && options.signal) {
            options.signal.removeEventListener("abort", abortListener);
            abortListener = null;
          }

          // Unsubscribe from all relays
          this.unsubscribe(subIds);

          // Resolve or reject based on abort status
          if (isAborted) {
            reject(new Error("Fetch operation was aborted"));
          } else {
            resolve(Array.from(eventsMap.values()));
          }
        };

        // Handle AbortSignal if provided
        if (options.signal) {
          // Check if already aborted
          if (options.signal.aborted) {
            cleanup(true);
            return;
          }

          // Add abort listener
          abortListener = () => cleanup(true);
          options.signal.addEventListener("abort", abortListener);
        }

        // Set timeout to ensure Promise always resolves
        if (maxWait > 0) {
          timeoutId = setTimeout(() => cleanup(false), maxWait);
        }
      });
    } catch (error) {
      throw new Error(
        `fetchMany validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Retrieve the newest single event matching the filters from all relays.
   *
   * @param filters Filters to apply (limit will be forced to 1)
   * @param options Optional max wait time in milliseconds and abort signal
   * @returns The newest matching event or null
   */
  public async fetchOne(
    filters: Filter[],
    options?: { maxWait?: number; signal?: AbortSignal },
  ): Promise<NostrEvent | null> {
    const limitedFilters = filters.map((f) => ({ ...f, limit: 1 }));
    const events = await this.fetchMany(limitedFilters, options);

    if (events.length === 0) return null;

    events.sort((a, b) => {
      if (a.created_at !== b.created_at) {
        return b.created_at - a.created_at;
      }
      return a.id.localeCompare(b.id);
    });

    return events[0];
  }

  // Define overloads for each event type with proper parameter typing
  public on(
    event: RelayEvent.Connect | RelayEvent.Disconnect,
    callback: (relay: string) => void,
  ): void;
  public on(
    event: RelayEvent.Error,
    callback: (relay: string, error: unknown) => void,
  ): void;
  public on(
    event: RelayEvent.Notice,
    callback: (relay: string, notice: string) => void,
  ): void;
  public on(
    event: RelayEvent.OK,
    callback: (
      relay: string,
      eventId: string,
      success: boolean,
      details: ParsedOkReason,
    ) => void,
  ): void;
  public on(
    event: RelayEvent.Closed,
    callback: (relay: string, subscriptionId: string, message: string) => void,
  ): void;
  public on(
    event: RelayEvent.Auth,
    callback: (relay: string, challengeEvent: NostrEvent) => void,
  ): void;
  public on(event: RelayEvent, callback: unknown): void {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    }

    // Store the callback in the registry
    let callbacksForEvent = this.eventCallbacks.get(event);
    if (!callbacksForEvent) {
      callbacksForEvent = new Set();
      this.eventCallbacks.set(event, callbacksForEvent);
    }
    callbacksForEvent.add(callback as NostrEventCallback);

    // Attach the callback to all currently existing relays
    this.relays.forEach((relay, url) => {
      const handler = this._createRelayEventHandler(
        url,
        callback as NostrEventCallback,
        event,
      );
      // Attach handler to the existing relay, using the appropriate signature
      switch (event) {
        case RelayEvent.Connect:
        case RelayEvent.Disconnect:
          relay.on(event, handler as RelayConnectHandler);
          break;
        case RelayEvent.Error:
          relay.on(event, handler as RelayErrorHandler);
          break;
        case RelayEvent.Notice:
          relay.on(event, handler as RelayNoticeHandler);
          break;
        case RelayEvent.OK:
          relay.on(event, handler as RelayOkHandler);
          break;
        case RelayEvent.Closed:
          relay.on(event, handler as RelayClosedHandler);
          break;
        case RelayEvent.Auth:
          relay.on(event, handler as RelayAuthHandler);
          break;
      }
    });
  }

  /**
   * Publish an event and get detailed results from all relays
   *
   * @param event The NostrEvent to publish
   * @param options Options including timeout
   * @returns Detailed publish results including success status and relay-specific information
   */
  public async publishWithDetails(
    event: NostrEvent,
    options?: { timeout?: number },
  ): Promise<{
    success: boolean;
    event: NostrEvent;
    relayResults: Map<string, { success: boolean; reason?: string }>;
    successCount: number;
    failureCount: number;
  }> {
    const result = await this.publishEvent(event, options);

    // Count successful and failed relays
    let successCount = 0;
    let failureCount = 0;

    result.relayResults.forEach((relayResult) => {
      if (relayResult.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    return {
      ...result,
      event: result.event || event,
      successCount,
      failureCount,
    };
  }

  /**
   * Get the latest replaceable event of a specific kind for a pubkey from all connected relays
   *
   * @param pubkey The public key of the user
   * @param kind The kind of event to retrieve (0, 3, or 10000-19999)
   * @returns The latest event or null if none exists
   */
  public getLatestReplaceableEvent(
    pubkey: string,
    kind: number,
  ): NostrEvent | null {
    let latestEvent: NostrEvent | null = null;

    for (const relay of this.relays.values()) {
      const event = relay.getLatestReplaceableEvent(pubkey, kind);
      if (
        event &&
        (!latestEvent ||
          event.created_at > latestEvent.created_at ||
          (event.created_at === latestEvent.created_at &&
            event.id < latestEvent.id))
      ) {
        latestEvent = event;
      }
    }

    return latestEvent;
  }

  /**
   * Get the latest addressable event for a specific kind, pubkey, and d-tag value
   * from all connected relays
   *
   * @param kind The kind of event to retrieve (30000-39999)
   * @param pubkey The public key of the user
   * @param dTagValue The value of the d tag
   * @returns The latest event or null if none exists
   */
  public getLatestAddressableEvent(
    kind: number,
    pubkey: string,
    dTagValue: string = "",
  ): NostrEvent | null {
    let latestEvent: NostrEvent | null = null;

    for (const relay of this.relays.values()) {
      const event = relay.getLatestAddressableEvent(kind, pubkey, dTagValue);
      if (
        event &&
        (!latestEvent ||
          event.created_at > latestEvent.created_at ||
          (event.created_at === latestEvent.created_at &&
            event.id < latestEvent.id))
      ) {
        latestEvent = event;
      }
    }

    return latestEvent;
  }

  /**
   * Get all addressable events for a specific pubkey from all connected relays
   *
   * @param pubkey The public key of the user
   * @returns Array of unique addressable events
   */
  public getAddressableEventsByPubkey(pubkey: string): NostrEvent[] {
    const eventsMap = new Map<string, NostrEvent>();

    for (const relay of this.relays.values()) {
      const events = relay.getAddressableEventsByPubkey(pubkey);

      for (const event of events) {
        // Find the d tag value
        const dTag = event.tags.find((tag) => tag[0] === "d");
        const dValue = dTag ? dTag[1] : "";

        // Create a composite key from kind, pubkey, and d-tag value
        const key = `${event.kind}:${event.pubkey}:${dValue}`;

        // Only keep the latest event for each key
        const existing = eventsMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          eventsMap.set(key, event);
        }
      }
    }

    return Array.from(eventsMap.values());
  }

  /**
   * Get all addressable events for a specific kind from all connected relays
   *
   * @param kind The kind of event to retrieve (30000-39999)
   * @returns Array of unique addressable events
   */
  public getAddressableEventsByKind(kind: number): NostrEvent[] {
    const eventsMap = new Map<string, NostrEvent>();

    for (const relay of this.relays.values()) {
      const events = relay.getAddressableEventsByKind(kind);

      for (const event of events) {
        // Find the d tag value
        const dTag = event.tags.find((tag) => tag[0] === "d");
        const dValue = dTag ? dTag[1] : "";

        // Create a composite key from pubkey and d-tag value (kind is already filtered)
        const key = `${event.pubkey}:${dValue}`;

        // Only keep the latest event for each key
        const existing = eventsMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          eventsMap.set(key, event);
        }
      }
    }

    return Array.from(eventsMap.values());
  }
}
