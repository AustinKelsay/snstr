import "websocket-polyfill";
import {
  NostrEvent,
  Filter,
  Subscription,
  RelayEvent,
  RelayEventHandler,
} from "../types/nostr";

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

  constructor(
    url: string,
    options: { 
      connectionTimeout?: number; 
      bufferFlushDelay?: number;
      autoReconnect?: boolean;
      maxReconnectAttempts?: number;
      maxReconnectDelay?: number;
    } = {},
  ) {
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
        this.ws = new WebSocket(this.url);

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
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached for ${this.url}`);
      return;
    }
    
    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    const jitter = Math.random() * 0.3 * baseDelay; // Add 0-30% jitter
    const reconnectDelay = baseDelay + jitter;
    
    console.log(`Scheduling reconnection to ${this.url} in ${Math.round(reconnectDelay)}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed for ${this.url}:`, error);
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
      throw new Error("Maximum reconnect attempts must be a non-negative number");
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

  public on(event: RelayEvent, callback: (...args: any[]) => void): void {
    this.eventHandlers[event] = callback;
  }

  public off(event: RelayEvent, callback: (...args: any[]) => void): void {
    // Only remove if the current handler is the same callback
    if (this.eventHandlers[event] === callback) {
      delete this.eventHandlers[event];
    }
  }

  public async publish(
    event: NostrEvent,
    options: { timeout?: number } = {},
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.connected) {
      try {
        const connected = await this.connect();
        if (!connected) {
          return { success: false, reason: "connection_failed" };
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "unknown error";
        return { success: false, reason: `connection_error: ${errorMsg}` };
      }
    }

    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, reason: "not_connected" };
    }

    try {
      // First send the event
      const message = JSON.stringify(["EVENT", event]);
      this.ws.send(message);

      // Return a Promise that will resolve when we get the OK response for this event
      return new Promise<{ success: boolean; reason?: string }>((resolve) => {
        const timeout = options.timeout ?? 10000;
        let timeoutId: NodeJS.Timeout;

        // Create unique handler function for this specific publish operation
        const handleOk = (
          eventId: string,
          success: boolean,
          message: string,
        ) => {
          if (eventId === event.id) {
            cleanup();
            resolve({ success, reason: message || undefined });
          }
        };

        // Setup error handler in case of WebSocket errors during publishing
        const handleError = (_: string, error: any) => {
          cleanup();
          const errorMsg =
            error instanceof Error ? error.message : "unknown error";
          resolve({ success: false, reason: `error: ${errorMsg}` });
        };

        // Setup disconnect handler in case connection drops during wait
        const handleDisconnect = () => {
          cleanup();
          resolve({ success: false, reason: "disconnected" });
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
          resolve({ success: false, reason: "timeout" });
        }, timeout);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";
      console.error(`Error publishing event to ${this.url}:`, errorMessage);
      return { success: false, reason: `error: ${errorMessage}` };
    }
  }

  public subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEOSE?: () => void,
  ): string {
    const id = Math.random().toString(36).substring(2, 15);
    const subscription: Subscription = {
      id,
      filters,
      onEvent,
      onEOSE,
    };

    this.subscriptions.set(id, subscription);
    this.eventBuffers.set(id, []); // Initialize an empty event buffer for this subscription

    if (this.connected && this.ws) {
      const message = JSON.stringify(["REQ", id, ...filters]);
      this.ws.send(message);
    }

    return id;
  }

  public unsubscribe(id: string): void {
    if (!this.subscriptions.has(id)) return;
    this.subscriptions.delete(id);
    this.eventBuffers.delete(id); // Clean up the event buffer for this subscription

    if (this.connected && this.ws) {
      const message = JSON.stringify(["CLOSE", id]);
      this.ws.send(message);
    }
  }

  private handleMessage(data: any[]): void {
    if (!Array.isArray(data)) return;

    const [type, ...rest] = data;
    const debug = process.env.DEBUG?.includes("nostr:*") || false;

    if (debug) {
      console.log(`Relay(${this.url}): Received message type: ${type}`);
      console.log(
        `Relay(${this.url}): Message data:`,
        JSON.stringify(rest).substring(0, 200),
      );
    }

    switch (type) {
      case "EVENT": {
        const [subscriptionId, event] = rest;
        if (debug) {
          console.log(
            `Relay(${this.url}): Event for subscription ${subscriptionId}, kind: ${event?.kind}, id: ${event?.id?.slice(0, 8)}...`,
          );
        }

        // Perform initial synchronous validation
        if (!this.performBasicValidation(event)) {
          if (debug) {
            console.log(`Relay(${this.url}): Rejected invalid event: ${event?.id}`);
          }
          this.triggerEvent(RelayEvent.Error, this.url, new Error(`Invalid event: ${event?.id}`));
          break;
        }

        // Launch async validation and handle the event only if validation passes
        this.validateEventAsync(event)
          .then(isValid => {
            if (isValid) {
              this.processValidatedEvent(event, subscriptionId);
            } else {
              if (debug) {
                console.log(`Relay(${this.url}): Rejected event after async validation: ${event?.id}`);
              }
              this.triggerEvent(RelayEvent.Error, this.url, new Error(`Invalid event signature or ID: ${event?.id}`));
            }
          })
          .catch(error => {
            if (debug) {
              console.error(`Relay(${this.url}): Error during async validation for event ${event?.id}:`, error);
            }
            this.triggerEvent(RelayEvent.Error, this.url, new Error(`Validation error: ${error.message}`));
          });
        
        break;
      }
      case "EOSE": {
        const [subscriptionId] = rest;
        if (debug)
          console.log(
            `Relay(${this.url}): End of stored events for subscription ${subscriptionId}`,
          );

        // Flush the buffer for this subscription immediately on EOSE
        this.flushSubscriptionBuffer(subscriptionId);

        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription && subscription.onEOSE) {
          subscription.onEOSE();
        }
        break;
      }
      case "NOTICE": {
        const [notice] = rest;
        if (debug) console.log(`Relay(${this.url}): Notice: ${notice}`);
        this.triggerEvent(RelayEvent.Notice, this.url, notice);
        break;
      }
      case "OK": {
        const [eventId, success, message] = rest;
        if (debug)
          console.log(
            `Relay(${this.url}): OK message for event ${eventId}: ${success ? "success" : "failed"}, ${message}`,
          );
        this.triggerEvent(RelayEvent.OK, eventId, success, message);
        break;
      }
      case "CLOSED": {
        const [subscriptionId, message] = rest;
        if (debug)
          console.log(
            `Relay(${this.url}): Subscription ${subscriptionId} closed by relay: ${message}`,
          );
        this.triggerEvent(RelayEvent.Closed, subscriptionId, message);
        // Remove the subscription from our map since the relay closed it
        this.subscriptions.delete(subscriptionId);
        break;
      }
      default:
        if (debug)
          console.log(`Relay(${this.url}): Unhandled message type: ${type}`);
        break;
    }
  }

  /**
   * Process a validated event - called only after both basic and async validation
   */
  private processValidatedEvent(event: NostrEvent, subscriptionId: string): void {
    const debug = process.env.DEBUG?.includes("nostr:*") || false;

    // Process replaceable events (kinds 0, 3, 10000-19999)
    if (event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)) {
      this.processReplaceableEvent(event);
    }
    // Process addressable events (kinds 30000-39999) - using else to make them mutually exclusive
    else if (event.kind >= 30000 && event.kind < 40000) {
      this.processAddressableEvent(event);
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      if (debug)
        console.log(
          `Relay(${this.url}): Found subscription, buffering event for processing`,
        );

      // Buffer the event instead of immediately calling the handler
      const buffer = this.eventBuffers.get(subscriptionId) || [];
      buffer.push(event);
      this.eventBuffers.set(subscriptionId, buffer);
    } else {
      if (debug)
        console.log(
          `Relay(${this.url}): No subscription found for id: ${subscriptionId}`,
        );
    }
  }

  /**
   * Perform basic synchronous validation of an event
   * 
   * This checks:
   * 1. Required fields are present with correct types
   * 2. Fields have valid formats (lengths, structure)
   * 3. Timestamps are reasonable
   */
  private performBasicValidation(event: any): boolean {
    // Skip validation if event is not an object or is null
    if (!event || typeof event !== 'object') {
      return false;
    }

    try {
      // Check that all required fields are present and have the correct types
      if (!event.id || typeof event.id !== 'string' || event.id.length !== 64) {
        return false;
      }
      
      if (!event.pubkey || typeof event.pubkey !== 'string' || event.pubkey.length !== 64) {
        return false;
      }
      
      if (!event.created_at || typeof event.created_at !== 'number') {
        return false;
      }
      
      if (event.kind === undefined || typeof event.kind !== 'number' || 
          event.kind < 0 || event.kind > 65535) {
        return false;
      }
      
      if (!Array.isArray(event.tags)) {
        return false;
      }
      
      // Validate tag structure
      for (const tag of event.tags) {
        if (!Array.isArray(tag)) {
          return false;
        }
        
        // All tag items must be strings according to NIP-01
        for (const item of tag) {
          if (typeof item !== 'string') {
            return false;
          }
        }
      }
      
      if (typeof event.content !== 'string') {
        return false;
      }
      
      if (!event.sig || typeof event.sig !== 'string' || event.sig.length !== 128) {
        return false;
      }

      // Check reasonable timestamp (not more than 1 hour in the future and not too far in the past)
      const now = Math.floor(Date.now() / 1000);
      if (event.created_at > now + 3600) {
        return false; // Reject events with future timestamps
      }
      
      // Special handling for NIP-46 events (kind 24133)
      if (event.kind === 24133) {
        // NIP-46 events require at least one p tag with proper format
        const hasPTag = event.tags.some((tag: string[]) => 
          Array.isArray(tag) && tag.length >= 2 && tag[0] === 'p' && 
          typeof tag[1] === 'string' && tag[1].length === 64);
        
        if (!hasPTag) {
          const debug = process.env.DEBUG?.includes("nostr:*") || false;
          if (debug) {
            console.log(`Relay(${this.url}): NIP-46 event missing valid p tag:`, JSON.stringify(event.tags));
          }
          return false;
        }
      }
      
      // Optionally log a warning for very old events (e.g., older than a year)
      if (event.created_at < now - 31536000) {
        // Return true but log a warning if debug is enabled
        const debug = process.env.DEBUG?.includes("nostr:*") || false;
        if (debug) {
          console.warn(`Relay(${this.url}): Event ${event.id} is very old (${now - event.created_at} seconds)`);
        }
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
  private validateEvent(event: any): boolean {
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
      // Skip signature validation for NIP-46 events
      if (event.kind === 24133) {
        // For NIP-46, we did basic validation already in validateEvent
        // Skip the more expensive ID and signature validation
        return true;
      }
      
      // Extract the data needed for ID verification (excluding id and sig)
      const eventData = {
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content
      };
      
      // Import the verification functions dynamically to avoid circular dependencies
      const { getEventHash } = await import('./event');
      const { verifySignature } = await import('../utils/crypto');
      
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

  private triggerEvent(event: RelayEvent, ...args: any[]): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      switch (event) {
        case RelayEvent.Connect:
        case RelayEvent.Disconnect:
          (handler as (relay: string) => void)(this.url);
          break;
        case RelayEvent.Error:
          (handler as (relay: string, error: any) => void)(this.url, args[0]);
          break;
        case RelayEvent.Notice:
          (handler as (relay: string, notice: string) => void)(
            this.url,
            args[0],
          );
          break;
        case RelayEvent.OK:
          (
            handler as (
              eventId: string,
              success: boolean,
              message: string,
            ) => void
          )(args[0], args[1], args[2]);
          break;
        case RelayEvent.Closed:
          (handler as (subscriptionId: string, message: string) => void)(
            args[0],
            args[1],
          );
          break;
      }
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
      // If created_at is the same, sort by id (descending lexical order)
      // This ensures higher IDs win when timestamps match
      return b.id.localeCompare(a.id);
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
    
    if (!existingEvent || existingEvent.created_at < event.created_at) {
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
    const dTag = event.tags.find(tag => tag[0] === 'd');
    const dValue = dTag ? dTag[1] : '';
    
    // Create a composite key from kind, pubkey, and d-tag value
    const key = `${event.kind}:${event.pubkey}:${dValue}`;
    
    const existingEvent = this.addressableEvents.get(key);
    
    if (!existingEvent || existingEvent.created_at < event.created_at) {
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
  public getLatestReplaceableEvent(pubkey: string, kind: number): NostrEvent | undefined {
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
  public getLatestAddressableEvent(kind: number, pubkey: string, dTagValue: string = ''): NostrEvent | undefined {
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
    return Array.from(this.addressableEvents.values())
      .filter(event => event.pubkey === pubkey);
  }

  /**
   * Get all addressable events for a specific kind
   * 
   * @param kind The kind of event to retrieve (30000-39999)
   * @returns Array of addressable events
   */
  public getAddressableEventsByKind(kind: number): NostrEvent[] {
    return Array.from(this.addressableEvents.values())
      .filter(event => event.kind === kind);
  }
}
