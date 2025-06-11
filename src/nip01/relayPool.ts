import { Relay } from "./relay";
import {
  NostrEvent,
  Filter,
  PublishOptions,
  PublishResponse,
} from "../types/nostr";
import { RelayConnectionOptions } from "../types/protocol";
import { isValidRelayUrl } from "../nip19";

export class RelayPool {
  private relays: Map<string, Relay> = new Map();
  private relayOptions?: RelayConnectionOptions;

  constructor(relayUrls: string[] = [], options?: { relayOptions?: RelayConnectionOptions }) {
    this.relayOptions = options?.relayOptions;
    relayUrls.forEach((url) => this.addRelay(url));
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
    if (!url || typeof url !== "string") {
      throw new Error("URL must be a non-empty string");
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      throw new Error("URL cannot be empty or whitespace only");
    }

    // Check if URL already has a scheme - but be more precise about what constitutes a scheme
    // A scheme must be followed by :// for URLs, not just :
    const schemePattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
    const schemeMatch = trimmedUrl.match(schemePattern);
    
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      // If it has a scheme, it must be ws or wss (case insensitive)
      if (scheme === "ws" || scheme === "wss") {
        return trimmedUrl;
      } else {
        throw new Error(
          `Invalid relay URL scheme: "${scheme}://". ` +
          `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
          `Got: "${trimmedUrl}"`
        );
      }
    } else {
      // Check for URLs that might have a port (like "domain.com:8080")
      // These should not be treated as having a scheme
      const hasPort = /^[^:/]+:\d+/.test(trimmedUrl);
      if (hasPort) {
        // It's likely a hostname with port, add wss:// prefix
        return `wss://${trimmedUrl}`;
      }
      
      // Check if there's a colon but not in a valid scheme format
      const colonIndex = trimmedUrl.indexOf(':');
      if (colonIndex !== -1) {
        // There's a colon, but not in a valid scheme format
        const beforeColon = trimmedUrl.substring(0, colonIndex);
        
        // If it looks like a scheme attempt (single word before colon), reject it
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(beforeColon) && !hasPort) {
          throw new Error(
            `Invalid relay URL scheme: "${beforeColon}://". ` +
            `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
            `Got: "${trimmedUrl}"`
          );
        }
      }
      
      // No scheme detected, add wss:// prefix
      return `wss://${trimmedUrl}`;
    }
  }

  /**
   * Normalize a relay URL by preprocessing, case normalizing, and validating.
   * This ensures consistent URL keys in the relay map and prevents duplicates.
   * 
   * @param url - The input URL string to normalize
   * @returns The canonicalized URL if valid, otherwise undefined
   */
  private normalizeRelayUrl(url: string): string | undefined {
    try {
      // First preprocess the URL to handle scheme validation and addition
      const preprocessedUrl = this.preprocessRelayUrl(url);
      
      // Then normalize case for scheme and host while preserving path/query case
      const parsedUrl = new URL(preprocessedUrl);
      
      // Construct the normalized URL, being careful about the path
      let normalizedUrl = `${parsedUrl.protocol.toLowerCase()}//${parsedUrl.host.toLowerCase()}`;
      
      // Only add pathname if it's not just "/" (which is the default for URLs without a path)
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        normalizedUrl += parsedUrl.pathname;
      }
      
      // Add search and hash if they exist
      if (parsedUrl.search) {
        normalizedUrl += parsedUrl.search;
      }
      if (parsedUrl.hash) {
        normalizedUrl += parsedUrl.hash;
      }
      
      // Finally validate the URL
      return isValidRelayUrl(normalizedUrl) ? normalizedUrl : undefined;
    } catch (error) {
      // If preprocessing fails (invalid scheme), we can optionally log it
      if (error instanceof Error && error.message.includes("Invalid relay URL scheme")) {
        // For RelayPool, we might want to be more lenient and just return undefined
        // instead of throwing, so the caller can decide how to handle it
        console.warn(`RelayPool: ${error.message}`);
      }
      return undefined;
    }
  }

  public addRelay(url: string, options?: RelayConnectionOptions): Relay {
    const normalizedUrl = this.normalizeRelayUrl(url);
    if (!normalizedUrl) {
      throw new Error("Invalid relay URL");
    }
    let relay = this.relays.get(normalizedUrl);
    if (!relay) {
      relay = new Relay(normalizedUrl, options || this.relayOptions);
      this.relays.set(normalizedUrl, relay);
    }
    return relay;
  }

  public removeRelay(url: string): void {
    const normalizedUrl = this.normalizeRelayUrl(url);
    if (!normalizedUrl) return;
    const relay = this.relays.get(normalizedUrl);
    if (relay) {
      relay.disconnect();
      this.relays.delete(normalizedUrl);
    }
  }

  public async ensureRelay(url: string): Promise<Relay> {
    const relay = this.addRelay(url);
    await relay.connect();
    return relay;
  }

  /**
   * Close relay connections. Invalid relay URLs are ignored.
   * @param relayUrls Optional array of relay URLs to close. If not provided, all relays are closed.
   */
  public close(relayUrls?: string[]): void {
    if (relayUrls) {
      relayUrls.forEach((url) => {
        // Normalize URL to match the key used in the map
        const normalizedUrl = this.normalizeRelayUrl(url);
        if (!normalizedUrl) return;
        const relay = this.relays.get(normalizedUrl);
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
