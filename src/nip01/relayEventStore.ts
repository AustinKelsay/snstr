import { NostrEvent } from "../types/nostr";
import { SECURITY_LIMITS } from "../utils/security-validator";

export interface RelayEventStoreOptions {
  maxEventBuffers?: number;
  maxEventsPerBuffer?: number;
  maxReplaceableEventPubkeys?: number;
  maxReplaceableEventsPerPubkey?: number;
  maxAddressableEvents?: number;
  now?: () => number;
  onEviction?: (message: string) => void;
}

/**
 * Owns deterministic, in-memory Relay buffering and replaceable/addressable
 * event retention policy. Connection lifecycle and callback delivery remain in
 * Relay; this module only decides what is retained and in which order.
 */
export class RelayEventStore {
  private readonly eventBuffers = new Map<string, NostrEvent[]>();
  private readonly eventBufferAccessTimes = new Map<string, number>();
  private readonly replaceableEvents = new Map<
    string,
    Map<number, NostrEvent>
  >();
  private readonly replaceableEventAccessTimes = new Map<string, number>();
  private readonly addressableEvents = new Map<string, NostrEvent>();
  private readonly addressableEventAccessTimes = new Map<string, number>();

  private readonly maxEventBuffers: number;
  private readonly maxEventsPerBuffer: number;
  private readonly maxReplaceableEventPubkeys: number;
  private readonly maxReplaceableEventsPerPubkey: number;
  private readonly maxAddressableEvents: number;
  private readonly now: () => number;
  private readonly onEviction: (message: string) => void;

  constructor(options: RelayEventStoreOptions = {}) {
    this.maxEventBuffers = RelayEventStore.capacity(
      "maxEventBuffers",
      options.maxEventBuffers,
      SECURITY_LIMITS.MAX_RELAY_EVENT_BUFFERS,
    );
    this.maxEventsPerBuffer = RelayEventStore.capacity(
      "maxEventsPerBuffer",
      options.maxEventsPerBuffer,
      SECURITY_LIMITS.MAX_EVENTS_PER_BUFFER,
    );
    this.maxReplaceableEventPubkeys = RelayEventStore.capacity(
      "maxReplaceableEventPubkeys",
      options.maxReplaceableEventPubkeys,
      SECURITY_LIMITS.MAX_REPLACEABLE_EVENT_PUBKEYS,
    );
    this.maxReplaceableEventsPerPubkey = RelayEventStore.capacity(
      "maxReplaceableEventsPerPubkey",
      options.maxReplaceableEventsPerPubkey,
      SECURITY_LIMITS.MAX_REPLACEABLE_EVENTS_PER_PUBKEY,
    );
    this.maxAddressableEvents = RelayEventStore.capacity(
      "maxAddressableEvents",
      options.maxAddressableEvents,
      SECURITY_LIMITS.MAX_ADDRESSABLE_EVENTS,
    );
    this.now = options.now ?? Date.now;
    this.onEviction = options.onEviction ?? (() => {});
  }

  clear(): void {
    this.eventBuffers.clear();
    this.eventBufferAccessTimes.clear();
    this.replaceableEvents.clear();
    this.replaceableEventAccessTimes.clear();
    this.addressableEvents.clear();
    this.addressableEventAccessTimes.clear();
  }

  initializeBuffer(subscriptionId: string): void {
    if (this.eventBuffers.has(subscriptionId)) return;
    this.ensureBufferCapacity();
    this.eventBuffers.set(subscriptionId, []);
    this.eventBufferAccessTimes.set(subscriptionId, this.now());
  }

  deleteBuffer(subscriptionId: string): void {
    this.eventBuffers.delete(subscriptionId);
    this.eventBufferAccessTimes.delete(subscriptionId);
  }

  bufferIds(): IterableIterator<string> {
    return this.eventBuffers.keys();
  }

  addToBuffer(subscriptionId: string, event: NostrEvent): void {
    this.initializeBuffer(subscriptionId);
    this.eventBufferAccessTimes.set(subscriptionId, this.now());
    const buffer = this.eventBuffers.get(subscriptionId)!;
    if (buffer.length >= this.maxEventsPerBuffer) {
      buffer.shift();
    }
    buffer.push(event);
  }

  drainBuffer(subscriptionId: string): NostrEvent[] {
    const buffer = this.eventBuffers.get(subscriptionId);
    if (!buffer || buffer.length === 0) return [];
    this.deleteBuffer(subscriptionId);
    return RelayEventStore.sortEvents(buffer);
  }

  static sortEvents(events: readonly NostrEvent[]): NostrEvent[] {
    return [...events].sort((a, b) => {
      if (a.created_at !== b.created_at) {
        return b.created_at - a.created_at;
      }
      return a.id.localeCompare(b.id);
    });
  }

  storeReplaceable(event: NostrEvent): void {
    const pubkey = event.pubkey;
    if (
      !this.replaceableEvents.has(pubkey) &&
      this.replaceableEvents.size >= this.maxReplaceableEventPubkeys
    ) {
      this.evictOldestReplaceablePubkey();
    }
    this.replaceableEventAccessTimes.set(pubkey, this.now());

    let kindMap = this.replaceableEvents.get(pubkey);
    if (!kindMap) {
      kindMap = new Map();
      this.replaceableEvents.set(pubkey, kindMap);
    }
    const existing = kindMap.get(event.kind);
    if (existing && !RelayEventStore.shouldReplace(existing, event)) return;

    if (
      !kindMap.has(event.kind) &&
      kindMap.size >= this.maxReplaceableEventsPerPubkey
    ) {
      const oldest = [...kindMap.entries()].sort(
        ([kindA, eventA], [kindB, eventB]) =>
          eventA.created_at - eventB.created_at ||
          eventB.id.localeCompare(eventA.id) ||
          kindA - kindB,
      )[0];
      if (oldest) {
        kindMap.delete(oldest[0]);
        this.onEviction(
          `Evicted replaceable event kind ${oldest[0]} for pubkey: ${pubkey}`,
        );
      }
    }
    kindMap.set(event.kind, event);
  }

  getReplaceable(pubkey: string, kind: number): NostrEvent | undefined {
    const event = this.replaceableEvents.get(pubkey)?.get(kind);
    if (event) {
      this.replaceableEventAccessTimes.set(pubkey, this.now());
    }
    return event;
  }

  storeAddressable(event: NostrEvent): void {
    const address = RelayEventStore.addressFor(event);
    if (
      !this.addressableEvents.has(address) &&
      this.addressableEvents.size >= this.maxAddressableEvents
    ) {
      this.evictOldestAddressableEvent();
    }
    this.addressableEventAccessTimes.set(address, this.now());
    const existing = this.addressableEvents.get(address);
    if (!existing || RelayEventStore.shouldReplace(existing, event)) {
      this.addressableEvents.set(address, event);
    }
  }

  getAddressable(
    kind: number,
    pubkey: string,
    dTagValue = "",
  ): NostrEvent | undefined {
    const address = `${kind}:${pubkey}:${dTagValue}`;
    const event = this.addressableEvents.get(address);
    if (event) {
      this.addressableEventAccessTimes.set(address, this.now());
    }
    return event;
  }

  getAddressableByPubkey(pubkey: string): NostrEvent[] {
    return this.collectAddressable((event) => event.pubkey === pubkey);
  }

  getAddressableByKind(kind: number): NostrEvent[] {
    return this.collectAddressable((event) => event.kind === kind);
  }

  private collectAddressable(
    matches: (event: NostrEvent) => boolean,
  ): NostrEvent[] {
    const events: NostrEvent[] = [];
    for (const [address, event] of this.addressableEvents) {
      if (matches(event)) {
        this.addressableEventAccessTimes.set(address, this.now());
        events.push(event);
      }
    }
    return events;
  }

  private static capacity(
    name: string,
    value: number | undefined,
    fallback: number,
  ): number {
    const capacity = value ?? fallback;
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError(`${name} must be a positive safe integer`);
    }
    return capacity;
  }

  private static shouldReplace(
    existing: NostrEvent,
    candidate: NostrEvent,
  ): boolean {
    return (
      candidate.created_at > existing.created_at ||
      (candidate.created_at === existing.created_at &&
        candidate.id < existing.id)
    );
  }

  private static addressFor(event: NostrEvent): string {
    const dValue = event.tags.find((tag) => tag[0] === "d")?.[1] ?? "";
    return `${event.kind}:${event.pubkey}:${dValue}`;
  }

  private ensureBufferCapacity(): void {
    if (this.eventBuffers.size < this.maxEventBuffers) return;
    const oldest = this.oldestAccess(this.eventBufferAccessTimes);
    if (oldest) {
      this.deleteBuffer(oldest);
      this.onEviction(`Evicted event buffer for subscription: ${oldest}`);
    }
  }

  private evictOldestReplaceablePubkey(): void {
    const oldest = this.oldestAccess(this.replaceableEventAccessTimes);
    if (oldest) {
      this.replaceableEvents.delete(oldest);
      this.replaceableEventAccessTimes.delete(oldest);
      this.onEviction(`Evicted replaceable events for pubkey: ${oldest}`);
    }
  }

  private evictOldestAddressableEvent(): void {
    const oldest = this.oldestAccess(this.addressableEventAccessTimes);
    if (oldest) {
      this.addressableEvents.delete(oldest);
      this.addressableEventAccessTimes.delete(oldest);
      this.onEviction(`Evicted addressable event: ${oldest}`);
    }
  }

  private oldestAccess(accessTimes: ReadonlyMap<string, number>): string {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, time] of accessTimes) {
      if (time < oldestTime || (time === oldestTime && key < oldestKey)) {
        oldestKey = key;
        oldestTime = time;
      }
    }
    return oldestKey;
  }
}
