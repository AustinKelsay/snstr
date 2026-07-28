import { RelayEventStore } from "../../../src/nip01/relayEventStore";
import { NostrEvent } from "../../../src/types/nostr";

function event(
  id: string,
  createdAt: number,
  overrides: Partial<NostrEvent> = {},
): NostrEvent {
  return {
    id,
    pubkey: "pubkey",
    created_at: createdAt,
    kind: 1,
    tags: [],
    content: id,
    sig: "sig",
    ...overrides,
  };
}

describe("RelayEventStore", () => {
  test.each([
    ["maxEventBuffers", 0],
    ["maxEventsPerBuffer", -1],
    ["maxReplaceableEventPubkeys", Number.NaN],
    ["maxReplaceableEventsPerPubkey", Number.POSITIVE_INFINITY],
    ["maxAddressableEvents", 1.5],
    ["maxAddressableEvents", Number.MAX_SAFE_INTEGER + 1],
  ] as const)("rejects invalid %s capacity %s", (option, value) => {
    expect(() => new RelayEventStore({ [option]: value })).toThrow(
      `${option} must be a positive safe integer`,
    );
  });

  test("drains buffered events in NIP-01 order", () => {
    const store = new RelayEventStore();
    store.addToBuffer("sub", event("d", 2));
    store.addToBuffer("sub", event("b", 3));
    store.addToBuffer("sub", event("a", 3));
    store.addToBuffer("sub", event("c", 1));

    expect(store.drainBuffer("sub").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(store.drainBuffer("sub")).toEqual([]);
  });

  test("enforces per-buffer capacity by retaining the newest arrivals", () => {
    const store = new RelayEventStore({ maxEventsPerBuffer: 2 });
    store.addToBuffer("sub", event("first", 3));
    store.addToBuffer("sub", event("second", 2));
    store.addToBuffer("sub", event("third", 1));

    expect(store.drainBuffer("sub").map(({ id }) => id)).toEqual([
      "second",
      "third",
    ]);
  });

  test("evicts the least-recently-used subscription buffer deterministically", () => {
    let now = 0;
    const evictions: string[] = [];
    const store = new RelayEventStore({
      maxEventBuffers: 2,
      now: () => now++,
      onEviction: (message) => evictions.push(message),
    });
    store.addToBuffer("old", event("old", 1));
    store.addToBuffer("kept", event("kept", 1));
    store.addToBuffer("new", event("new", 1));

    expect([...store.bufferIds()]).toEqual(["kept", "new"]);
    expect(evictions).toEqual(["Evicted event buffer for subscription: old"]);
  });

  test("uses the lower event id when replaceable timestamps tie", () => {
    const store = new RelayEventStore();
    store.storeReplaceable(event("z", 10, { kind: 0 }));
    store.storeReplaceable(event("a", 10, { kind: 0 }));
    store.storeReplaceable(event("m", 10, { kind: 0 }));

    expect(store.getReplaceable("pubkey", 0)?.id).toBe("a");
  });

  test("keeps the newer replaceable event when an older candidate arrives", () => {
    const store = new RelayEventStore();
    store.storeReplaceable(event("newer", 20, { kind: 0 }));
    store.storeReplaceable(event("older", 10, { kind: 0 }));

    expect(store.getReplaceable("pubkey", 0)?.id).toBe("newer");
  });

  test("bounds replaceable pubkeys and ignores misses for LRU accounting", () => {
    let now = 0;
    const store = new RelayEventStore({
      maxReplaceableEventPubkeys: 1,
      now: () => now++,
    });
    store.storeReplaceable(event("first", 1, { kind: 0, pubkey: "first" }));
    expect(store.getReplaceable("missing", 0)).toBeUndefined();
    store.storeReplaceable(event("second", 2, { kind: 0, pubkey: "second" }));

    expect(store.getReplaceable("first", 0)).toBeUndefined();
    expect(store.getReplaceable("second", 0)?.id).toBe("second");
  });

  test("bounds replaceable kinds per pubkey by oldest event time", () => {
    const store = new RelayEventStore({
      maxReplaceableEventsPerPubkey: 2,
    });
    store.storeReplaceable(event("old", 1, { kind: 0 }));
    store.storeReplaceable(event("kept", 2, { kind: 3 }));
    store.storeReplaceable(event("new", 3, { kind: 10000 }));

    expect(store.getReplaceable("pubkey", 0)).toBeUndefined();
    expect(store.getReplaceable("pubkey", 3)?.id).toBe("kept");
    expect(store.getReplaceable("pubkey", 10000)?.id).toBe("new");
  });

  test("keys addressable events by kind, pubkey, and d tag", () => {
    const store = new RelayEventStore();
    store.storeAddressable(
      event("old", 1, { kind: 30001, tags: [["d", "profile"]] }),
    );
    store.storeAddressable(
      event("new", 2, { kind: 30001, tags: [["d", "profile"]] }),
    );
    store.storeAddressable(
      event("other", 1, { kind: 30001, tags: [["d", "other"]] }),
    );

    expect(store.getAddressable(30001, "pubkey", "profile")?.id).toBe("new");
    expect(store.getAddressableByPubkey("pubkey")).toHaveLength(2);
    expect(store.getAddressableByKind(30001)).toHaveLength(2);
  });

  test("keeps the newer addressable event when an older candidate arrives", () => {
    const store = new RelayEventStore();
    const coordinate = { kind: 30001, tags: [["d", "profile"]] };
    store.storeAddressable(event("newer", 20, coordinate));
    store.storeAddressable(event("older", 10, coordinate));

    expect(store.getAddressable(30001, "pubkey", "profile")?.id).toBe("newer");
  });

  test("bounds addressable storage and ignores misses for LRU accounting", () => {
    let now = 0;
    const store = new RelayEventStore({
      maxAddressableEvents: 1,
      now: () => now++,
    });
    store.storeAddressable(
      event("first", 1, { kind: 30000, tags: [["d", "first"]] }),
    );
    expect(store.getAddressable(30000, "pubkey", "missing")).toBeUndefined();
    store.storeAddressable(
      event("second", 2, { kind: 30000, tags: [["d", "second"]] }),
    );

    expect(store.getAddressableByKind(30000).map(({ id }) => id)).toEqual([
      "second",
    ]);
  });

  test("bulk addressable reads refresh only matching LRU entries", () => {
    let now = 0;
    const store = new RelayEventStore({
      maxAddressableEvents: 3,
      now: () => now++,
    });
    store.storeAddressable(
      event("match-pubkey", 1, {
        kind: 30000,
        pubkey: "match",
        tags: [["d", "one"]],
      }),
    );
    store.storeAddressable(
      event("match-kind", 1, {
        kind: 30001,
        pubkey: "other",
        tags: [["d", "two"]],
      }),
    );
    store.storeAddressable(
      event("untouched", 1, {
        kind: 30002,
        pubkey: "other",
        tags: [["d", "three"]],
      }),
    );

    expect(store.getAddressableByPubkey("match")).toHaveLength(1);
    expect(store.getAddressableByKind(30001)).toHaveLength(1);
    store.storeAddressable(
      event("new", 2, {
        kind: 30003,
        pubkey: "new",
        tags: [["d", "four"]],
      }),
    );

    expect(store.getAddressableByKind(30002)).toEqual([]);
    expect(store.getAddressableByKind(30000)).toHaveLength(1);
    expect(store.getAddressableByKind(30001)).toHaveLength(1);
    expect(store.getAddressableByKind(30003)).toHaveLength(1);
  });

  test("clears buffering and retained event state together", () => {
    const store = new RelayEventStore();
    store.addToBuffer("sub", event("buffered", 1));
    store.storeReplaceable(event("replaceable", 1, { kind: 0 }));
    store.storeAddressable(
      event("addressable", 1, { kind: 30000, tags: [["d", "d"]] }),
    );

    store.clear();

    expect([...store.bufferIds()]).toEqual([]);
    expect(store.getReplaceable("pubkey", 0)).toBeUndefined();
    expect(store.getAddressable(30000, "pubkey", "d")).toBeUndefined();
  });
});
