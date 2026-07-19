import type { RelayConnectionOptions } from "../types/protocol";
import { isValidRelayUrl } from "../nip19";
import { normalizeRelayUrl, preprocessRelayUrl } from "../utils/relayUrl";
import { Relay } from "./relay";

export interface RelayRegistration {
  url: string;
  relay: Relay;
  created: boolean;
}

/** Owns canonical relay identity, instances, and removal lifecycle. */
export class RelayRegistry {
  private readonly relays = new Map<string, Relay>();

  constructor(private readonly relayOptions?: RelayConnectionOptions) {}

  canonicalUrl(url: string): string {
    const canonical = normalizeRelayUrl(preprocessRelayUrl(url));
    if (!isValidRelayUrl(canonical)) {
      throw new Error(`Invalid relay URL: ${canonical}`);
    }
    return canonical;
  }

  register(url: string): RelayRegistration {
    const canonical = this.canonicalUrl(url);
    const existing = this.relays.get(canonical);
    if (existing) return { url: canonical, relay: existing, created: false };

    const relay = new Relay(canonical, this.relayOptions);
    this.relays.set(canonical, relay);
    return { url: canonical, relay, created: true };
  }

  lookup(url: string): Relay | undefined {
    try {
      return this.relays.get(this.canonicalUrl(url));
    } catch {
      return undefined;
    }
  }

  require(url: string): Relay {
    const canonical = this.canonicalUrl(url);
    const relay = this.relays.get(canonical);
    if (!relay) throw new Error(`Relay not found: ${canonical}`);
    return relay;
  }

  remove(url: string): void {
    this.delete(url);
  }

  get size(): number {
    return this.relays.size;
  }

  get(url: string): Relay | undefined {
    return this.lookup(url);
  }

  set(url: string, relay: Relay): this {
    const canonical = this.canonicalUrl(url);
    const displaced = this.relays.get(canonical);
    if (displaced && displaced !== relay) displaced.disconnect();
    this.relays.set(canonical, relay);
    return this;
  }

  has(url: string): boolean {
    return this.lookup(url) !== undefined;
  }

  delete(url: string): boolean {
    let canonical: string;
    try {
      canonical = this.canonicalUrl(url);
    } catch {
      return false;
    }
    const relay = this.relays.get(canonical);
    if (!relay) return false;
    relay.disconnect();
    return this.relays.delete(canonical);
  }

  values(): IterableIterator<Relay> {
    return this.relays.values();
  }

  entries(): IterableIterator<[string, Relay]> {
    return this.relays.entries();
  }

  forEach(callback: (relay: Relay, url: string) => void): void {
    this.relays.forEach(callback);
  }
}
