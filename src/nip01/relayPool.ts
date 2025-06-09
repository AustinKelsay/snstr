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

  public addRelay(url: string, options?: RelayConnectionOptions): Relay {
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = `wss://${url}`;
    }
    let relay = this.relays.get(url);
    if (!relay) {
      relay = new Relay(url, options || this.relayOptions);
      this.relays.set(url, relay);
    }
    return relay;
  }

  public removeRelay(url: string): void {
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = `wss://${url}`;
    }
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
    const subscriptions: { relay: Relay; id: string }[] = [];
    let eoseCount = 0;

    const openPromises = Promise.all(
      relays.map(async (url) => {
        const relay = await this.ensureRelay(url);
        const id = relay.subscribe(
          filters,
          (ev) => onEvent(ev, url),
          () => {
            eoseCount++;
            if (eoseCount === relays.length && onEOSE) {
              onEOSE();
            }
          },
        );
        subscriptions.push({ relay, id });
      }),
    );

    return {
      close: () => {
        openPromises.then(() => {
          subscriptions.forEach(({ relay, id }) => relay.unsubscribe(id));
        });
      },
    };
  }

  public async querySync(
    relays: string[],
    filter: Filter,
    options: { timeout?: number } = {},
  ): Promise<NostrEvent[]> {
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      let timer: NodeJS.Timeout | null = null;
      let sub: { close: () => void } | null = null;

      this.subscribe(
        relays,
        [filter],
        (ev) => events.push(ev),
        () => {
          if (timer) clearTimeout(timer);
          if (sub) sub.close();
          resolve(events);
        },
      ).then((subscription) => {
        sub = subscription;
        if (options.timeout && options.timeout > 0) {
          timer = setTimeout(() => {
            if (sub) sub.close();
            resolve(events);
          }, options.timeout);
        }
      });
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
