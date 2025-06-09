import { Relay } from "./relay";
import {
  NostrEvent,
  Filter,
  PublishOptions,
  PublishResponse,
} from "../types/nostr";
import { RelayConnectionOptions } from "../types/protocol";

export class RelayPool {
  private relays: Map<string, Relay> = new Map();
  private relayOptions?: RelayConnectionOptions;

  constructor(relayUrls: string[] = [], options?: { relayOptions?: RelayConnectionOptions }) {
    this.relayOptions = options?.relayOptions;
    relayUrls.forEach((url) => this.addRelay(url));
  }

  /**
   * Normalize a relay URL by adding wss:// prefix if missing
   * This ensures consistent URL keys in the relay map
   */
  private normalizeRelayUrl(url: string): string {
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      return `wss://${url}`;
    }
    return url;
  }

  public addRelay(url: string, options?: RelayConnectionOptions): Relay {
    url = this.normalizeRelayUrl(url);
    let relay = this.relays.get(url);
    if (!relay) {
      relay = new Relay(url, options || this.relayOptions);
      this.relays.set(url, relay);
    }
    return relay;
  }

  public removeRelay(url: string): void {
    url = this.normalizeRelayUrl(url);
    const relay = this.relays.get(url);
    if (relay) {
      relay.disconnect();
      this.relays.delete(url);
    }
  }

  public async ensureRelay(url: string): Promise<Relay> {
    const relay = this.addRelay(url);
    await relay.connect();
    return relay;
  }

  public close(relayUrls?: string[]): void {
    if (relayUrls) {
      relayUrls.forEach((url) => {
        // Normalize URL to match the key used in the map
        url = this.normalizeRelayUrl(url);
        const relay = this.relays.get(url);
        if (relay) relay.disconnect();
      });
    } else {
      this.relays.forEach((relay) => relay.disconnect());
    }
  }

  public publish(relays: string[], event: NostrEvent, options?: PublishOptions): Promise<PublishResponse>[] {
    return relays.map(async (url) => {
      const relay = await this.ensureRelay(url);
      return relay.publish(event, options);
    });
  }

  public async subscribe(
    relays: string[],
    filters: Filter[],
    onEvent: (event: NostrEvent, relay: string) => void,
    onEOSE?: () => void,
  ): Promise<{ close: () => void }> {
    const subscriptions: { relay: Relay; id: string; ready: boolean }[] = [];
    const failedRelays: string[] = [];
    let eoseCount = 0;
    let isClosed = false;

    // Safe event handler that catches and logs errors
    const safeOnEvent = (event: NostrEvent, relayUrl: string) => {
      if (isClosed) return; // Don't process events after close
      try {
        onEvent(event, relayUrl);
      } catch (eventError) {
        console.warn(`Error processing event from ${relayUrl}:`, eventError, event);
      }
    };

    // Safe EOSE handler
    const safeOnEOSE = () => {
      if (isClosed) return;
      eoseCount++;
      const successfulRelays = relays.length - failedRelays.length;
      if (eoseCount === successfulRelays && onEOSE && successfulRelays > 0) {
        try {
          onEOSE();
        } catch (eoseError) {
          console.warn('Error in EOSE callback:', eoseError);
        }
      }
    };

    // Track subscription promises individually to handle partial failures
    const subscriptionPromises = relays.map(async (url) => {
      try {
        const relay = await this.ensureRelay(url);
        const id = relay.subscribe(
          filters,
          (ev) => safeOnEvent(ev, url),
          safeOnEOSE,
        );
        
        // Mark as ready and add to subscriptions
        const subscription = { relay, id, ready: true };
        subscriptions.push(subscription);
        return { success: true, url, subscription };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to subscribe to relay ${url}:`, errorMessage);
        failedRelays.push(url);
        return { success: false, url, error: errorMessage };
      }
    });

    // Wait for all subscription attempts to complete (success or failure)
    const results = await Promise.allSettled(subscriptionPromises);
    
    // Process results and log any additional errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Unexpected error subscribing to ${relays[index]}:`, result.reason);
        if (!failedRelays.includes(relays[index])) {
          failedRelays.push(relays[index]);
        }
      }
    });

    // Immediate close function that doesn't wait for connections
    const immediateClose = () => {
      if (isClosed) return; // Prevent multiple closes
      isClosed = true;

      // Unsubscribe from ready subscriptions immediately
      subscriptions.forEach(({ relay, id, ready }) => {
        if (ready) {
          try {
            relay.unsubscribe(id);
          } catch (unsubError) {
            console.warn('Error during unsubscribe:', unsubError);
          }
        }
      });

      // Clear the subscriptions array
      subscriptions.length = 0;
    };

    return {
      close: immediateClose,
    };
  }

  public async querySync(
    relays: string[],
    filter: Filter,
    options: { timeout?: number } = {},
  ): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      let timer: NodeJS.Timeout | null = null;
      let sub: { close: () => void } | null = null;
      let isResolved = false;

      // Cleanup function to ensure resources are always freed
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (sub) {
          try {
            sub.close();
          } catch (cleanupError) {
            // Ignore cleanup errors, but log them if needed
            console.warn('Error during subscription cleanup:', cleanupError);
          }
          sub = null;
        }
      };

      // Safe resolve function that ensures cleanup and prevents multiple resolves
      const safeResolve = (result: NostrEvent[]) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(result);
        }
      };

      // Safe reject function that ensures cleanup and prevents multiple rejects
      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      try {
        this.subscribe(
          relays,
          [filter],
          (ev) => {
            try {
              events.push(ev);
            } catch (eventError) {
              console.warn('Error processing event:', eventError, ev);
              // Continue processing other events instead of failing completely
            }
          },
          () => {
            // EOSE callback - all relays finished sending stored events
            safeResolve(events);
          },
        ).then((subscription) => {
          try {
            sub = subscription;
            if (options.timeout && options.timeout > 0) {
              timer = setTimeout(() => {
                safeResolve(events);
              }, options.timeout);
            }
          } catch (subscriptionError) {
            safeReject(new Error(`Failed to setup subscription: ${subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError)}`));
          }
        }).catch((subscribeError) => {
          safeReject(new Error(`Failed to subscribe to relays: ${subscribeError.message}`));
        });
      } catch (error) {
        safeReject(new Error(`Failed to initialize querySync: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  public async get(
    relays: string[],
    filter: Filter,
    options: { timeout?: number } = {},
  ): Promise<NostrEvent | null> {
    const f = { ...filter, limit: 1 };
    const events = await this.querySync(relays, f, options);
    events.sort((a, b) => b.created_at - a.created_at);
    return events[0] || null;
  }
}
