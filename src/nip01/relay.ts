import { getWebSocketImplementation } from "../utils/websocket";
import {
  NostrEvent,
  Filter,
  Subscription,
  RelayEvent,
  RelayEventHandler,
  RelayEventCallbacks,
  PublishOptions,
  PublishResponse,
  NIP20Prefix,
  ParsedOkReason,
  SubscriptionOptions,
} from "../types/nostr";
import { RelayConnectionOptions } from "../types/protocol";
import { NostrValidationError } from "./event";
import { getUnixTime } from "../utils/time";

export class Relay {
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private subscriptions: Map<string, Subscription> = new Map();
  private eventHandlers: RelayEventHandler = {};
  private connectionPromise: Promise<boolean> | null = null;
  private connectionTimeout = 10000; // Default timeout of 10 seconds
  // Event buffer for implementing proper event ordering
  private eventBuffers: Map<string, NostrEvent[]> = new Map();
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private bufferFlushDelay = 50; // ms to wait before flushing event buffer
  // Reconnection parameters
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private autoReconnect = true; // Whether to automatically reconnect
  private maxReconnectAttempts = 10; // Maximum number of reconnection attempts
  private maxReconnectDelay = 30000; // Maximum delay between reconnect attempts (ms)
  // Track replaceable and addressable events according to NIP-01
  private replaceableEvents: Map<string, Map<number, NostrEvent>> = new Map();
  private addressableEvents: Map<string, NostrEvent> = new Map();

  constructor(url: string, options: RelayConnectionOptions = {}) {
    this.url = url;
    if (options.connectionTimeout !== undefined) {
      this.connectionTimeout = options.connectionTimeout;
    }
    if (options.bufferFlushDelay !== undefined) {
      this.bufferFlushDelay = options.bufferFlushDelay;
    }
    if (options.autoReconnect !== undefined) {
      this.autoReconnect = options.autoReconnect;
    }
    if (options.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = options.maxReconnectAttempts;
    }
    if (options.maxReconnectDelay !== undefined) {
      this.maxReconnectDelay = options.maxReconnectDelay;
    }
  }

  public async connect(): Promise<boolean> {
    if (this.connected) return true;
    if (this.connectionPromise) return this.connectionPromise;

    // Reset WebSocket if it exists already
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore close errors, the socket might already be in a closing state
      }
      this.ws = null;
    }

    // Create the connection promise
    const connectionPromise = new Promise<boolean>((resolve, reject) => {
      try {
        const WS = getWebSocketImplementation();
        this.ws = new WS(this.url);

        // Set up connection timeout
        const timeoutId = setTimeout(() => {
          // Only run this if we haven't connected yet
          if (this.ws && !this.connected) {
            this.triggerEvent(
              RelayEvent.Error,
              this.url,
              new Error("connection timeout"),
            );
            try {
              this.ws.close();
            } catch (e) {
              // Ignore errors during force close
            }
            this.ws = null;
            this.connectionPromise = null;
            reject(new Error("connection timeout"));
          }
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.connected = true;
          this.resetReconnectAttempts(); // Reset reconnect counter on successful connection
          this.setupBufferFlush(); // Set up the event buffer flush interval
          this.triggerEvent(RelayEvent.Connect, this.url);
          resolve(true);
        };

        this.ws.onclose = () => {
          clearTimeout(timeoutId);
          const wasConnected = this.connected;
          this.connected = false;
          this.clearBufferFlush(); // Clear the event buffer flush interval
          this.triggerEvent(RelayEvent.Disconnect, this.url);

          // Only reject the promise if we're still waiting to connect
          if (!wasConnected && this.connectionPromise) {
            this.connectionPromise = null;
            reject(new Error("connection closed"));
          }

          // Schedule reconnection if auto-reconnect is enabled
          if (this.autoReconnect && wasConnected) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          this.triggerEvent(RelayEvent.Error, this.url, error);

          // Only reject the promise if we haven't connected yet
          if (!this.connected && this.connectionPromise) {
            this.connectionPromise = null;
            reject(
              error instanceof Error ? error : new Error("websocket error"),
            );
          }
        };

        this.ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            this.handleMessage(data);
          } catch (error) {
            this.triggerEvent(RelayEvent.Error, this.url, error);
          }
        };
      } catch (error) {
        // Handle errors during WebSocket creation
        this.connectionPromise = null;
        reject(error);
      }
    }).catch((error) => {
      // Ensure we return false if connection fails but don't re-throw
      console.error(`Connection to ${this.url} failed:`, error);

      // Schedule reconnection if auto-reconnect is enabled
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }

      return false as boolean; // Explicit type assertion
    });

    // Store the promise for future connect() calls to return
    this.connectionPromise = connectionPromise;

    // Create a separate promise chain to handle cleanup
    // This ensures the original promise is not modified
    connectionPromise.then(
      () => {
        // Only clean up if this is still the active connection promise
        if (this.connectionPromise === connectionPromise) {
          this.connectionPromise = null;
        }
      },
      () => {
        // Also clean up on rejection
        if (this.connectionPromise === connectionPromise) {
          this.connectionPromise = null;
        }
      },
    );

    return this.connectionPromise;
  }

  public disconnect(): void {
    // Cancel any scheduled reconnection
    this.cancelReconnect();

    if (!this.ws) return;

    try {
      // Clear all subscriptions to prevent further processing
      this.subscriptions.clear();
      this.eventBuffers.clear(); // Clear any buffered events
      this.clearBufferFlush(); // Clear the buffer flush interval

      // Close the WebSocket if it's open or connecting
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING)
      ) {
        // First try to send CLOSE messages for any active subscriptions
        try {
          this.ws.close();
        } catch (e) {
          // Ignore close errors, the connection might already be closed or invalid
        }

        // Reset the connection promise if it exists
        this.connectionPromise = null;
      }
    } catch (error) {
      console.error(`Error closing WebSocket for ${this.url}:`, error);
    } finally {
      // Reset all state variables
      this.ws = null;
      this.connected = false;
      this.triggerEvent(RelayEvent.Disconnect, this.url);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Cancel any existing reconnect timer
    this.cancelReconnect();

    // Check if we've reached the maximum number of reconnect attempts
    if (
      this.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      console.warn(
        `Maximum reconnection attempts (${this.maxReconnectAttempts}) reached for ${this.url}`,
      );
      return;
    }

    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    const jitter = Math.random() * 0.3 * baseDelay; // Add 0-30% jitter
    const reconnectDelay = baseDelay + jitter;


    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        console.error(
          `Reconnection attempt ${this.reconnectAttempts} failed for ${this.url}:`,
          error,
        );
        // The next reconnection will be scheduled in the connect() method's catch handler
      });
    }, reconnectDelay);
  }

  /**
   * Cancel any scheduled reconnection attempt
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Reset the reconnection attempt counter
   */
  private resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
    this.cancelReconnect();
  }

  /**
   * Enable or disable automatic reconnection
   */
  public setAutoReconnect(enable: boolean): void {
    this.autoReconnect = enable;

    // If disabling, cancel any pending reconnect
    if (!enable) {
      this.cancelReconnect();
    }
  }

  /**
   * Set the maximum number of reconnection attempts
   * @param max Maximum number of attempts (0 for unlimited)
   */
  public setMaxReconnectAttempts(max: number): void {
    if (max < 0) {
      throw new Error(
        "Maximum reconnect attempts must be a non-negative number",
      );
    }
    this.maxReconnectAttempts = max;
  }

  /**
   * Set the maximum delay between reconnection attempts
   * @param maxDelayMs Maximum delay in milliseconds
   */
  public setMaxReconnectDelay(maxDelayMs: number): void {
    if (maxDelayMs < 1000) {
      throw new Error("Maximum reconnect delay must be at least 1000ms");
    }
    this.maxReconnectDelay = maxDelayMs;
  }

  public on<E extends RelayEvent>(
    event: E,
    callback: RelayEventCallbacks[E],
  ): void {
    if (typeof callback !== "function") return;

    const existingCallbacks = this.eventHandlers[event];

    if (!existingCallbacks) {
      // If no array exists for this event type, create one with the new callback
      this.eventHandlers[event] = [callback] as RelayEventHandler[E];
    } else {
      // existingCallbacks is already correctly typed as RelayEventCallbacks[E][] | undefined by the corrected RelayEventHandler
      if (!existingCallbacks.includes(callback)) {
        existingCallbacks.push(callback);
      }
    }
  }

  public off<E extends RelayEvent>(
    event: E,
    callback: RelayEventCallbacks[E],
  ): void {
    if (typeof callback !== "function") return;

    const handlerOrArray = this.eventHandlers[event];

    if (!handlerOrArray) {
      // If undefined, no handlers registered for this event.
      return;
    }

    // First, check if the stored entry is a single function (user's identified scenario for robustness)
    // Note: Types suggest handlerOrArray should be an array if defined (RelayEventCallbacks[E][]).
    // This check handles potential state where it might erroneously be a single function.
    if (typeof handlerOrArray === "function") {
      if (handlerOrArray === callback) {
        delete this.eventHandlers[event];
      }
    }
    // Else, if it's an array (the expected scenario based on types and `on` method)
    else if (Array.isArray(handlerOrArray)) {
      const callbacksArray = handlerOrArray; // Can also rename to handlerOrArray if preferred
      const index = callbacksArray.indexOf(callback);
      if (index > -1) {
        callbacksArray.splice(index, 1);
      }

      if (callbacksArray.length === 0) {
        delete this.eventHandlers[event];
      }
    }
    // If handlerOrArray is defined but is neither a function nor an array (e.g., other object types),
    // this would be a highly unexpected state. Current behavior is to do nothing, which is safe.
  }

  public async publish(
    event: NostrEvent,
    options: PublishOptions = {},
  ): Promise<PublishResponse> {
    if (!this.connected) {
      try {
        const connected = await this.connect();
        if (!connected) {
          return {
            success: false,
            reason: "connection_failed",
            relay: this.url,
          };
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "unknown error";
        return {
          success: false,
          reason: `connection_error: ${errorMsg}`,
          relay: this.url,
        };
      }
    }

    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, reason: "not_connected", relay: this.url };
    }

    try {
      // First send the event
      const message = JSON.stringify(["EVENT", event]);
      this.ws.send(message);

      // If we don't need to wait for acknowledgment, return immediately
      if (options.waitForAck === false) {
        return { success: true, relay: this.url };
      }

      // Return a Promise that will resolve when we get the OK response for this event
      return new Promise<PublishResponse>((resolve) => {
        const timeout = options.timeout ?? 10000;
        let timeoutId: NodeJS.Timeout = setTimeout(() => {
          cleanup();
          resolve({ success: false, reason: "timeout", relay: this.url });
        }, timeout);

        // Create unique handler function for this specific publish operation
        const handleOk = (
          eventId: string,
          success: boolean,
          details: ParsedOkReason,
        ) => {
          if (eventId === event.id) {
            cleanup();
            resolve({
              success,
              reason: details.rawMessage,
              parsedReason: details,
              relay: this.url,
            });
          }
        };

        // Setup error handler in case of WebSocket errors during publishing
        const handleError = (_: string, error: unknown) => {
          cleanup();
          const errorMsg =
            error instanceof Error ? error.message : "unknown error";
          resolve({
            success: false,
            reason: `error: ${errorMsg}`,
            relay: this.url,
          });
        };

        // Setup disconnect handler in case connection drops during wait
        const handleDisconnect = () => {
          cleanup();
          resolve({ success: false, reason: "disconnected", relay: this.url });
        };

        // Helper to clean up all handlers and timeout
        const cleanup = () => {
          this.off(RelayEvent.OK, handleOk);
          this.off(RelayEvent.Error, handleError);
          this.off(RelayEvent.Disconnect, handleDisconnect);
          clearTimeout(timeoutId);
        };

        // Register the event handlers
        this.on(RelayEvent.OK, handleOk);
        this.on(RelayEvent.Error, handleError);
        this.on(RelayEvent.Disconnect, handleDisconnect);

        // Set timeout to avoid hanging indefinitely
        timeoutId = setTimeout(() => {
          cleanup();
          resolve({ success: false, reason: "timeout", relay: this.url });
        }, timeout);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";
      console.error(`Error publishing event to ${this.url}:`, errorMessage);
      return {
        success: false,
        reason: `error: ${errorMessage}`,
        relay: this.url,
      };
    }
  }

  public subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEOSE?: () => void,
    options: SubscriptionOptions = {},
  ): string {
    const id = Math.random().toString(36).substring(2, 15);

    // Validate filters before proceeding
    const fieldsToValidate: (keyof Filter)[] = ["ids", "authors", "#e", "#p"];
    for (const filter of filters) {
      for (const field of fieldsToValidate) {
        const values = filter[field] as unknown; // Type assertion needed as Filter has [key: string]: unknown
        if (Array.isArray(values)) {
          for (const item of values) {
            if (!this._isValidNip01FilterIdentifier(item)) {
              const fieldName = field as string;
              throw new NostrValidationError(
                `Invalid NIP-01 filter value for '${fieldName}': item '${item}' is not a 64-character lowercase hex string.`,
                fieldName,
                filter,
              );
            }
          }
        }
      }
    }

    const subscription: Subscription = {
      id,
      filters,
      onEvent,
      onEOSE,
      options,
    };

    if (options.autoClose && options.eoseTimeout && options.eoseTimeout > 0) {
      subscription.eoseTimer = setTimeout(() => {
        this.unsubscribe(id);
      }, options.eoseTimeout);
    }

    this.subscriptions.set(id, subscription);
    this.eventBuffers.set(id, []); // Initialize an empty event buffer for this subscription

    if (this.connected && this.ws) {
      const message = JSON.stringify(["REQ", id, ...filters]);
      this.ws.send(message);
    }

    return id;
  }

  public unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return;
    if (subscription.eoseTimer) {
      clearTimeout(subscription.eoseTimer);
    }
    this.subscriptions.delete(id);
    this.eventBuffers.delete(id); // Clean up the event buffer for this subscription

    if (this.connected && this.ws) {
      const message = JSON.stringify(["CLOSE", id]);
      this.ws.send(message);
    }
  }

  private handleMessage(data: unknown[]): void {
    if (!Array.isArray(data)) return;

    const [type, ...rest] = data;

    switch (type) {
      case "EVENT": {
        const [subscriptionId, event] = rest;

        // Type guard to ensure event is a NostrEvent
        if (!this.isNostrEvent(event)) {
          this.triggerEvent(
            RelayEvent.Error,
            this.url,
            new Error(`Invalid event structure: ${JSON.stringify(event)}`),
          );
          break;
        }

        // Perform initial synchronous validation
        if (!this.performBasicValidation(event)) {
          this.triggerEvent(
            RelayEvent.Error,
            this.url,
            new Error(`Invalid event: ${event.id}`),
          );
          break;
        }

        // Launch async validation and handle the event only if validation passes
        this.validateEventAsync(event)
          .then((isValid) => {
            if (isValid) {
              this.processValidatedEvent(event, subscriptionId as string);
            } else {
              this.triggerEvent(
                RelayEvent.Error,
                this.url,
                new Error(`Async validation failed for event: ${event.id}`),
              );
            }
          })
          .catch((error) => {
            this.triggerEvent(
              RelayEvent.Error,
              this.url,
              new Error(
                `Validation error: ${error instanceof Error ? error.message : "unknown error"}`,
              ),
            );
          });

        break;
      }
      case "EOSE": {
        const [subscriptionId] = rest;

        // Flush the buffer for this subscription immediately on EOSE
        if (typeof subscriptionId === "string") {
          this.flushSubscriptionBuffer(subscriptionId);

          const subscription = this.subscriptions.get(subscriptionId);
          if (subscription && subscription.onEOSE) {
            subscription.onEOSE();
          }
          if (subscription && subscription.options?.autoClose) {
            this.unsubscribe(subscriptionId);
          }
        }
        break;
      }
      case "NOTICE": {
        const [notice] = rest;
        // Ensure notice is a string
        const noticeStr =
          typeof notice === "string" ? notice : String(notice || "");
        this.triggerEvent(RelayEvent.Notice, this.url, noticeStr);
        break;
      }
      case "OK": {
        const [eventId, success, rawMessageUntyped] = rest;

        // Ensure all params are of the correct type
        const eventIdStr =
          typeof eventId === "string" ? eventId : String(eventId || "");
        const successBool = Boolean(success);

        // Parse the raw message for NIP-20 prefixes
        const rawMessageStr =
          typeof rawMessageUntyped === "string" ? rawMessageUntyped : undefined;
        const parsedDetails = this.parseOkMessage(rawMessageStr);

        this.triggerEvent(
          RelayEvent.OK,
          eventIdStr,
          successBool,
          parsedDetails,
        );
        break;
      }
      case "CLOSED": {
        const [subscriptionId, message] = rest;
        // Ensure both params are strings
        const subIdStr =
          typeof subscriptionId === "string"
            ? subscriptionId
            : String(subscriptionId || "");
        const messageStr =
          typeof message === "string" ? message : String(message || "");

        this.triggerEvent(RelayEvent.Closed, subIdStr, messageStr);
        // Remove the subscription from our map since the relay closed it
        if (typeof subscriptionId === "string") {
          this.subscriptions.delete(subscriptionId);
        }
        break;
      }
      case "AUTH": {
        const [challengeEvent] = rest;
        // Check if the challenge is a proper NostrEvent
        if (this.isNostrEvent(challengeEvent)) {
          this.triggerEvent(RelayEvent.Auth, challengeEvent);
        } else {
          // If it's not a proper event, log an error
          this.triggerEvent(
            RelayEvent.Error,
            this.url,
            new Error(
              `Invalid AUTH challenge: ${JSON.stringify(challengeEvent)}`,
            ),
          );
        }
        break;
      }
      default:
        // Unknown message type, ignore or log
        console.warn(`Relay(${this.url}): Unknown message type:`, type, rest);
        break;
    }
  }

  /**
   * Process a validated event - called only after both basic and async validation
   */
  private processValidatedEvent(
    event: NostrEvent,
    subscriptionId: string,
  ): void {
    // Process replaceable events (kinds 0, 3, 10000-19999)
    if (
      event.kind === 0 ||
      event.kind === 3 ||
      (event.kind >= 10000 && event.kind < 20000)
    ) {
      this.processReplaceableEvent(event);
    }
    // Process addressable events (kinds 30000-39999) - using else to make them mutually exclusive
    else if (event.kind >= 30000 && event.kind < 40000) {
      this.processAddressableEvent(event);
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      // Buffer the event instead of immediately calling the handler
      const buffer = this.eventBuffers.get(subscriptionId) || [];
      buffer.push(event);
      this.eventBuffers.set(subscriptionId, buffer);
    }
  }

  // Helper function to check if a string is a valid hex string of a specific length
  private isHexString(value: unknown, length?: number): boolean {
    if (typeof value !== "string") {
      return false;
    }
    if (!/^[0-9a-fA-F]+$/.test(value)) {
      return false;
    }
    if (length !== undefined && value.length !== length) {
      return false;
    }
    return true;
  }

  /**
   * Perform basic synchronous validation of an event
   *
   * This checks:
   * 1. Required fields are present with correct types
   * 2. Fields have valid formats (lengths, structure)
   * 3. Timestamps are reasonable
   */
  private performBasicValidation(event: unknown): boolean {
    // Skip validation if event is not a NostrEvent
    if (!this.isNostrEvent(event)) {
      return false;
    }

    try {
      // Now we can safely access event properties
      // Check that all required fields are present and have the correct types
      if (!this.isHexString(event.id, 64)) {
        return false;
      }

      if (!this.isHexString(event.pubkey, 64)) {
        return false;
      }

      if (event.kind < 0 || event.kind > 65535) {
        return false;
      }

      // Validate tag structure
      for (const tag of event.tags) {
        if (!Array.isArray(tag) || tag.length === 0) {
          // Ensure tag is a non-empty array
          return false;
        }

        // All tag items must be strings according to NIP-01
        for (const item of tag) {
          if (typeof item !== "string") {
            return false;
          }
        }

        // Specific NIP-01 tag parameter validation
        const tagName = tag[0];
        if (tagName === "e" || tagName === "p") {
          // For 'e' (event ID) and 'p' (pubkey) tags, the second element must be a 64-char hex string
          // NIP-01: ["e", <event-id-hex>, <optional-relay-url-string>]
          // NIP-01: ["p", <pubkey-hex>, <optional-relay-url-string>]
          if (tag.length < 2 || !this.isHexString(tag[1], 64)) {
            return false;
          }
        } else if (tagName === "a") {
          // For 'a' tags, validate the <kind>:<pubkey>:<d-identifier> structure
          // NIP-01: ["a", "<kind>:<pubkey>:<d-identifier>", <optional-relay-url>]
          if (tag.length < 2 || typeof tag[1] !== 'string') {
            return false; // Must have at least name and value, value must be a string
          }
          const valueParts = tag[1].split(':');
          if (valueParts.length !== 3) {
            // This structure must contain exactly three parts: kind, pubkey, and d-tag value (which can be empty).
            // e.g., "30023:pubkeyhex:identifier" or "10002:pubkeyhex:"
            return false;
          }

          const kindStr = valueParts[0];
          const pubkeyStr = valueParts[1];
          // const dValueStr = valueParts[2]; // dValueStr is implicitly validated as a string by split

          // Validate kind (must be a non-negative integer string)
          const kindNum = parseInt(kindStr, 10);
          if (
            isNaN(kindNum) ||
            !Number.isInteger(kindNum) ||
            kindNum < 0 || // Kinds must be non-negative
            String(kindNum) !== kindStr // Ensures no trailing characters, e.g., "123xyz"
          ) {
            return false;
          }

          // Validate pubkey (must be 64-char hex)
          if (!this.isHexString(pubkeyStr, 64)) {
            return false;
          }
          // dValueStr (valueParts[2]) is a string by virtue of the split.
          // NIP-01 doesn't impose further generic constraints on its content for the 'a' tag structure itself.
        }
        // Other tag types might have different validation rules, not covered by this specific claim.
      }

      if (!this.isHexString(event.sig, 128)) {
        return false;
      }

      // Check reasonable timestamp (not more than 1 hour in the future and not too far in the past)
      const now = getUnixTime();
      if (event.created_at > now + 3600) {
        return false; // Reject events with future timestamps
      }

      // Special handling for NIP-46 events (kind 24133)
      if (event.kind === 24133) {
        // NIP-46 events require at least one 'p' tag.
        // The format of such a 'p' tag (tag[0]==='p', tag.length >= 2, and tag[1] is 64-char hex)
        // would have already been validated by the general tag loop above.
        // Here, we just ensure at least one such 'p' tag exists.
        const hasValidPTagForNIP46 = event.tags.some(
          (tag: string[]) => tag.length >= 2 && tag[0] === "p",
        );

        if (!hasValidPTagForNIP46) {
          // Optionally log here if needed
          return false;
        }
      }

      // Optionally log a warning for very old events (e.g., older than a year)
      if (event.created_at < now - 31536000) {
        // Optionally log here if needed
      }

      return true;
    } catch (error) {
      // If any validation throws an exception, reject the event
      return false;
    }
  }

  /**
   * Validate an event (deprecated - use async validation directly)
   * Maintained for backward compatibility with existing code
   */
  private validateEvent(event: unknown): boolean {
    if (!this.isNostrEvent(event)) {
      return false;
    }

    if (!this.performBasicValidation(event)) {
      return false;
    }

    // For NIP-46 encrypted events, we can skip async validation since
    // their content can only be verified after decryption
    if (event.kind === 24133) {
      return true;
    }

    // For all other events, indicate that basic validation passed, but defer
    // to async validation before actually accepting the event
    return true;
  }

  /**
   * Perform async validations on an event
   *
   * This includes:
   * 1. Verifying the event ID matches the hash of serialized data
   * 2. Verifying the signature is valid
   *
   * These operations are computationally expensive, so they're performed
   * asynchronously to avoid blocking the main thread.
   */
  private async validateEventAsync(event: NostrEvent): Promise<boolean> {
    try {
      // Extract the data needed for ID verification (excluding id and sig)
      const eventData = {
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      };

      // Import the verification functions dynamically to avoid circular dependencies
      const { getEventHash } = await import("./event");
      const { verifySignature } = await import("../utils/crypto");

      // Step 1: Validate event ID by comparing with calculated hash
      const calculatedId = await getEventHash(eventData);
      if (calculatedId !== event.id) {
        return false;
      }

      // Step 2: Validate signature
      return await verifySignature(event.id, event.sig, event.pubkey);
    } catch (error) {
      // Log error details if in debug mode
      const debug = process.env.DEBUG?.includes("nostr:*") || false;
      if (debug) {
        console.error(`Relay(${this.url}): Event validation error:`, error);
      }
      return false;
    }
  }

  // Use a type-safe approach with overloads for each event type
  private triggerEvent(
    event: RelayEvent.Connect | RelayEvent.Disconnect,
    url: string,
  ): void;
  private triggerEvent(
    event: RelayEvent.Error,
    url: string,
    error: unknown,
  ): void;
  private triggerEvent(
    event: RelayEvent.Notice,
    url: string,
    notice: string,
  ): void;
  private triggerEvent(
    event: RelayEvent.OK,
    eventId: string,
    success: boolean,
    details: ParsedOkReason,
  ): void;
  private triggerEvent(
    event: RelayEvent.Closed,
    subscriptionId: string,
    message: string,
  ): void;
  private triggerEvent(
    event: RelayEvent.Auth,
    challengeEvent: NostrEvent,
  ): void;
  private triggerEvent(event: RelayEvent, ...args: unknown[]): void {
    const callbacks = this.eventHandlers[event];

    if (callbacks && Array.isArray(callbacks)) {
      callbacks.forEach((callback) => {
        if (typeof callback === "function") {
          try {
            // Directly call the callback with the spread arguments.
            // The type assertion in Relay.on ensures the callback matches the event.
            (callback as (...args: unknown[]) => void)(...args);
          } catch (e) {
            console.error(`Relay(${this.url}): Error in ${event} callback:`, e);
          }
        }
      });
    }
  }

  /**
   * Set connection timeout in milliseconds
   * @param timeout Timeout in milliseconds
   */
  public setConnectionTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new Error("Connection timeout must be a positive number");
    }
    this.connectionTimeout = timeout;
  }

  /**
   * Get the current connection timeout in milliseconds
   */
  public getConnectionTimeout(): number {
    return this.connectionTimeout;
  }

  /**
   * Get all subscription IDs for this relay
   * @returns A Set containing all active subscription IDs
   */
  public getSubscriptionIds(): Set<string> {
    return new Set(this.subscriptions.keys());
  }

  /**
   * Get the current buffer flush delay in milliseconds
   */
  public getBufferFlushDelay(): number {
    return this.bufferFlushDelay;
  }

  /**
   * Set up the interval to flush event buffers
   */
  private setupBufferFlush(): void {
    // Clear any existing interval just in case
    this.clearBufferFlush();

    // Set up a new interval to flush event buffers periodically
    this.bufferFlushInterval = setInterval(() => {
      this.flushAllBuffers();
    }, this.bufferFlushDelay);
  }

  /**
   * Clear the buffer flush interval
   */
  private clearBufferFlush(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }
  }

  /**
   * Flush all event buffers for all subscriptions
   */
  private flushAllBuffers(): void {
    for (const subscriptionId of this.eventBuffers.keys()) {
      this.flushSubscriptionBuffer(subscriptionId);
    }
  }

  /**
   * Flush the event buffer for a specific subscription
   */
  private flushSubscriptionBuffer(subscriptionId: string): void {
    const buffer = this.eventBuffers.get(subscriptionId);
    if (!buffer || buffer.length === 0) return;

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      // If the subscription has been removed, clear the buffer
      this.eventBuffers.delete(subscriptionId);
      return;
    }

    // Sort the events according to NIP-01: newest first, then by lexical order of ID if same timestamp
    const sortedEvents = this.sortEvents(buffer);

    // Reset the buffer to empty
    this.eventBuffers.set(subscriptionId, []);

    // Process all events
    for (const event of sortedEvents) {
      try {
        subscription.onEvent(event);
      } catch (error) {
        console.error(
          `Error in subscription handler for ${subscriptionId}:`,
          error,
        );
      }
    }
  }

  /**
   * Sort events according to NIP-01 specification:
   * 1. created_at timestamp (descending - newer events first)
   * 2. event id (lexical ascending) if timestamps are the same
   */
  private sortEvents(events: NostrEvent[]): NostrEvent[] {
    return [...events].sort((a, b) => {
      // Sort by created_at (descending - newer events first)
      if (a.created_at !== b.created_at) {
        return b.created_at - a.created_at;
      }
      // If created_at is the same, sort by id (ascending lexical order)
      // This ensures lower IDs win when timestamps match, consistent with NIP-01 replaceable/addressable events.
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Process a replaceable event according to NIP-01
   * For events with kinds 0, 3, or 10000-19999, only the latest one should be stored
   */
  private processReplaceableEvent(event: NostrEvent): void {
    const key = event.pubkey;

    if (!this.replaceableEvents.has(key)) {
      this.replaceableEvents.set(key, new Map());
    }

    const userEvents = this.replaceableEvents.get(key)!;
    const existingEvent = userEvents.get(event.kind);

    if (
      !existingEvent ||
      event.created_at > existingEvent.created_at ||
      (event.created_at === existingEvent.created_at &&
        event.id < existingEvent.id)
    ) {
      userEvents.set(event.kind, event);
      // In a full implementation, we might want to notify subscribers about the replacement
    }
  }

  /**
   * Process an addressable event according to NIP-01
   * For events with kinds 30000-39999, only the latest event for each combination of
   * kind, pubkey, and d tag value should be stored
   */
  private processAddressableEvent(event: NostrEvent): void {
    // Find the d tag value (if any)
    const dTag = event.tags.find((tag) => tag[0] === "d");
    const dValue = dTag ? dTag[1] : "";

    // Create a composite key from kind, pubkey, and d-tag value
    const key = `${event.kind}:${event.pubkey}:${dValue}`;

    const existingEvent = this.addressableEvents.get(key);

    if (
      !existingEvent ||
      event.created_at > existingEvent.created_at ||
      (event.created_at === existingEvent.created_at &&
        event.id < existingEvent.id)
    ) {
      this.addressableEvents.set(key, event);
      // In a full implementation, we might want to notify subscribers about the replacement
    }
  }

  /**
   * Get the latest replaceable event of a specific kind for a pubkey
   *
   * @param pubkey The public key of the user
   * @param kind The kind of event to retrieve (0, 3, or 10000-19999)
   * @returns The latest event or undefined if none exists
   */
  public getLatestReplaceableEvent(
    pubkey: string,
    kind: number,
  ): NostrEvent | undefined {
    const userEvents = this.replaceableEvents.get(pubkey);
    if (!userEvents) return undefined;
    return userEvents.get(kind);
  }

  /**
   * Get the latest addressable event for a specific kind, pubkey, and d-tag value
   *
   * @param kind The kind of event to retrieve (30000-39999)
   * @param pubkey The public key of the user
   * @param dTagValue The value of the d tag
   * @returns The latest event or undefined if none exists
   */
  public getLatestAddressableEvent(
    kind: number,
    pubkey: string,
    dTagValue: string = "",
  ): NostrEvent | undefined {
    const key = `${kind}:${pubkey}:${dTagValue}`;
    return this.addressableEvents.get(key);
  }

  /**
   * Get all addressable events for a specific pubkey
   *
   * @param pubkey The public key of the user
   * @returns Array of addressable events
   */
  public getAddressableEventsByPubkey(pubkey: string): NostrEvent[] {
    return Array.from(this.addressableEvents.values()).filter(
      (event) => event.pubkey === pubkey,
    );
  }

  /**
   * Get all addressable events for a specific kind
   *
   * @param kind The kind of event to retrieve (30000-39999)
   * @returns Array of addressable events
   */
  public getAddressableEventsByKind(kind: number): NostrEvent[] {
    return Array.from(this.addressableEvents.values()).filter(
      (event) => event.kind === kind,
    );
  }

  // Helper function to parse NIP-20 prefixes from OK messages
  private parseOkMessage(rawMessage?: string): ParsedOkReason {
    const result: ParsedOkReason = {
      rawMessage: rawMessage || "",
      message: rawMessage || "", // Default to full message if no prefix
    };

    if (rawMessage) {
      for (const nipPrefix of Object.values(NIP20Prefix)) {
        if (rawMessage.startsWith(nipPrefix)) {
          result.prefix = nipPrefix;
          result.message = rawMessage.substring(nipPrefix.length).trimStart();
          break;
        }
      }
    }
    return result;
  }

  // Add this helper method to type guard for NostrEvent
  private isNostrEvent(event: unknown): event is NostrEvent {
    if (!event || typeof event !== "object") return false;

    const e = event as Record<string, unknown>;

    return (
      typeof e.id === "string" &&
      typeof e.pubkey === "string" &&
      typeof e.created_at === "number" &&
      typeof e.kind === "number" &&
      Array.isArray(e.tags) &&
      typeof e.content === "string" &&
      typeof e.sig === "string"
    );
  }

  // New private helper method for validating NIP-01 filter identifiers
  private _isValidNip01FilterIdentifier(value: unknown): value is string {
    if (typeof value !== "string") {
      return false;
    }
    // Must be 64 characters, lowercase hex
    return /^[0-9a-f]{64}$/.test(value);
  }
}
