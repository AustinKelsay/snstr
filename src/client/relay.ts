import 'websocket-polyfill';
import { NostrEvent, Filter, Subscription, RelayEvent, RelayEventHandler } from '../types/nostr';

export class Relay {
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private subscriptions: Map<string, Subscription> = new Map();
  private eventHandlers: RelayEventHandler = {};
  private connectionPromise: Promise<boolean> | null = null;
  private connectionTimeout = 10000; // Default timeout of 10 seconds

  constructor(url: string, options: { connectionTimeout?: number } = {}) {
    this.url = url;
    if (options.connectionTimeout !== undefined) {
      this.connectionTimeout = options.connectionTimeout;
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
            this.triggerEvent(RelayEvent.Error, this.url, new Error('connection timeout'));
            try {
              this.ws.close();
            } catch (e) {
              // Ignore errors during force close
            }
            this.ws = null;
            this.connectionPromise = null;
            reject(new Error('connection timeout'));
          }
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.connected = true;
          this.triggerEvent(RelayEvent.Connect, this.url);
          resolve(true);
        };

        this.ws.onclose = () => {
          clearTimeout(timeoutId);
          const wasConnected = this.connected;
          this.connected = false;
          this.triggerEvent(RelayEvent.Disconnect, this.url);
          
          // Only reject the promise if we're still waiting to connect
          if (!wasConnected && this.connectionPromise) {
            this.connectionPromise = null;
            reject(new Error('connection closed'));
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          this.triggerEvent(RelayEvent.Error, this.url, error);
          
          // Only reject the promise if we haven't connected yet
          if (!this.connected && this.connectionPromise) {
            this.connectionPromise = null;
            reject(error instanceof Error ? error : new Error('websocket error'));
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
    }).catch(error => {
      // Ensure we return false if connection fails but don't re-throw
      console.error(`Connection to ${this.url} failed:`, error);
      return false as boolean; // Explicit type assertion
    });

    // Store the promise for future connect() calls to return
    this.connectionPromise = connectionPromise;

    // Create a separate promise chain to handle cleanup
    // This ensures the original promise is not modified
    connectionPromise.then(() => {
      // Only clean up if this is still the active connection promise
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = null;
      }
    }, () => {
      // Also clean up on rejection
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  public disconnect(): void {
    if (!this.ws) return;
    
    try {
      // Clear all subscriptions to prevent further processing
      this.subscriptions.clear();
      
      // Close the WebSocket if it's open or connecting
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
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

  public on(event: RelayEvent, callback: (...args: any[]) => void): void {
    this.eventHandlers[event] = callback;
  }

  public off(event: RelayEvent, callback: (...args: any[]) => void): void {
    // Only remove if the current handler is the same callback
    if (this.eventHandlers[event] === callback) {
      delete this.eventHandlers[event];
    }
  }

  public async publish(event: NostrEvent, options: { timeout?: number } = {}): Promise<{ success: boolean; reason?: string }> {
    if (!this.connected) {
      try {
        const connected = await this.connect();
        if (!connected) {
          return { success: false, reason: 'connection_failed' };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'unknown error';
        return { success: false, reason: `connection_error: ${errorMsg}` };
      }
    }

    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, reason: 'not_connected' };
    }

    try {
      // First send the event
      const message = JSON.stringify(['EVENT', event]);
      this.ws.send(message);
      
      // Return a Promise that will resolve when we get the OK response for this event
      return new Promise<{ success: boolean; reason?: string }>((resolve) => {
        const timeout = options.timeout ?? 10000;
        let timeoutId: NodeJS.Timeout;
        
        // Create unique handler function for this specific publish operation
        const handleOk = (eventId: string, success: boolean, message: string) => {
          if (eventId === event.id) {
            cleanup();
            resolve({ success, reason: message || undefined });
          }
        };
        
        // Setup error handler in case of WebSocket errors during publishing
        const handleError = (_: string, error: any) => {
          cleanup();
          const errorMsg = error instanceof Error ? error.message : 'unknown error';
          resolve({ success: false, reason: `error: ${errorMsg}` });
        };
        
        // Setup disconnect handler in case connection drops during wait
        const handleDisconnect = () => {
          cleanup();
          resolve({ success: false, reason: 'disconnected' });
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
          resolve({ success: false, reason: 'timeout' });
        }, timeout);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      console.error(`Error publishing event to ${this.url}:`, errorMessage);
      return { success: false, reason: `error: ${errorMessage}` };
    }
  }

  public subscribe(filters: Filter[], onEvent: (event: NostrEvent) => void, onEOSE?: () => void): string {
    const id = Math.random().toString(36).substring(2, 15);
    const subscription: Subscription = {
      id,
      filters,
      onEvent,
      onEOSE,
    };

    this.subscriptions.set(id, subscription);

    if (this.connected && this.ws) {
      const message = JSON.stringify(['REQ', id, ...filters]);
      this.ws.send(message);
    }

    return id;
  }

  public unsubscribe(id: string): void {
    if (!this.subscriptions.has(id)) return;
    this.subscriptions.delete(id);

    if (this.connected && this.ws) {
      const message = JSON.stringify(['CLOSE', id]);
      this.ws.send(message);
    }
  }

  private handleMessage(data: any[]): void {
    if (!Array.isArray(data)) return;

    const [type, ...rest] = data;
    const debug = process.env.DEBUG?.includes('nostr:*') || false;

    if (debug) {
      console.log(`Relay(${this.url}): Received message type: ${type}`);
      console.log(`Relay(${this.url}): Message data:`, JSON.stringify(rest).substring(0, 200));
    }

    switch (type) {
      case 'EVENT': {
        const [subscriptionId, event] = rest;
        if (debug) {
          console.log(`Relay(${this.url}): Event for subscription ${subscriptionId}, kind: ${event?.kind}, id: ${event?.id?.slice(0, 8)}...`);
        }
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          if (debug) console.log(`Relay(${this.url}): Found subscription, calling onEvent handler`);
          subscription.onEvent(event);
        } else {
          if (debug) console.log(`Relay(${this.url}): No subscription found for id: ${subscriptionId}`);
        }
        break;
      }
      case 'EOSE': {
        const [subscriptionId] = rest;
        if (debug) console.log(`Relay(${this.url}): End of stored events for subscription ${subscriptionId}`);
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription && subscription.onEOSE) {
          subscription.onEOSE();
        }
        break;
      }
      case 'NOTICE': {
        const [notice] = rest;
        if (debug) console.log(`Relay(${this.url}): Notice: ${notice}`);
        this.triggerEvent(RelayEvent.Notice, this.url, notice);
        break;
      }
      case 'OK': {
        const [eventId, success, message] = rest;
        if (debug) console.log(`Relay(${this.url}): OK message for event ${eventId}: ${success ? 'success' : 'failed'}, ${message}`);
        this.triggerEvent(RelayEvent.OK, eventId, success, message);
        break;
      }
      case 'CLOSED': {
        const [subscriptionId, message] = rest;
        if (debug) console.log(`Relay(${this.url}): Subscription ${subscriptionId} closed by relay: ${message}`);
        this.triggerEvent(RelayEvent.Closed, subscriptionId, message);
        // Remove the subscription from our map since the relay closed it
        this.subscriptions.delete(subscriptionId);
        break;
      }
      default:
        if (debug) console.log(`Relay(${this.url}): Unhandled message type: ${type}`);
        break;
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
          (handler as (relay: string, notice: string) => void)(this.url, args[0]);
          break;
        case RelayEvent.OK:
          (handler as (eventId: string, success: boolean, message: string) => void)(args[0], args[1], args[2]);
          break;
        case RelayEvent.Closed:
          (handler as (subscriptionId: string, message: string) => void)(args[0], args[1]);
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
      throw new Error('Connection timeout must be a positive number');
    }
    this.connectionTimeout = timeout;
  }

  /**
   * Get the current connection timeout in milliseconds
   */
  public getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
} 