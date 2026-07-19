import { generateKeypair } from "../../../src/utils/crypto";
import {
  createAddressableEvent,
  createSignedEvent,
} from "../../../src/nip01/event";
import { RelayEventStore } from "../../../src/nip01/relayEventStore";
import { NostrEvent } from "../../../src/types/nostr";

// Mock WebSocket
jest.mock("websocket-polyfill", () => ({}));

describe("Addressable Events (NIP-01 §7.1)", () => {
  let store: RelayEventStore;
  let user1Keypair: { privateKey: string; publicKey: string };
  let testEvents: {
    event1: NostrEvent;
    event2: NostrEvent;
    event3: NostrEvent;
    event4: NostrEvent;
  };

  beforeEach(async () => {
    store = new RelayEventStore();

    // Set up test data
    user1Keypair = await generateKeypair();

    // Create test events
    const event1Template = createAddressableEvent(
      30000,
      "value1",
      "content-1",
      user1Keypair.privateKey,
    );

    const event2Template = createAddressableEvent(
      30000,
      "value2",
      "content-2",
      user1Keypair.privateKey,
    );

    const event3Template = createAddressableEvent(
      30000,
      "value1",
      "content-3-newer",
      user1Keypair.privateKey,
    );
    // Manually set a newer timestamp
    event3Template.created_at = Math.floor(Date.now() / 1000) + 100; // 100 seconds in the future

    const event4Template = createAddressableEvent(
      30001,
      "value1",
      "content-4-different-kind",
      user1Keypair.privateKey,
    );

    // Sign all events
    testEvents = {
      event1: await createSignedEvent(event1Template, user1Keypair.privateKey),
      event2: await createSignedEvent(event2Template, user1Keypair.privateKey),
      event3: await createSignedEvent(event3Template, user1Keypair.privateKey),
      event4: await createSignedEvent(event4Template, user1Keypair.privateKey),
    };
  });

  test("Different d-tag values create separate addressable events", async () => {
    // Process events with same pubkey and kind but different d-tag values
    store.storeAddressable(testEvents.event1);
    store.storeAddressable(testEvents.event2);

    // Get latest events for each d-tag value
    const latest1 = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      "value1",
    );

    const latest2 = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      "value2",
    );

    // Both events should be stored separately
    expect(latest1).toBeDefined();
    expect(latest2).toBeDefined();
    expect(latest1?.content).toBe("content-1");
    expect(latest2?.content).toBe("content-2");
  });

  test("Newer event with same d-tag replaces older one", async () => {
    // Process original event
    store.storeAddressable(testEvents.event1);

    // Process newer event with same d-tag
    store.storeAddressable(testEvents.event3);

    // Get latest event
    const latest = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      "value1",
    );

    // Should be the newer event
    expect(latest).toBeDefined();
    expect(latest?.content).toBe("content-3-newer");
  });

  test("Different kinds with same d-tag are stored separately", async () => {
    // Process events with same pubkey and d-tag but different kinds
    store.storeAddressable(testEvents.event1);
    store.storeAddressable(testEvents.event4);

    // Get latest events for each kind
    const latest1 = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      "value1",
    );

    const latest2 = store.getAddressable(
      30001,
      user1Keypair.publicKey,
      "value1",
    );

    // Both events should be stored separately
    expect(latest1).toBeDefined();
    expect(latest2).toBeDefined();
    expect(latest1?.content).toBe("content-1");
    expect(latest2?.content).toBe("content-4-different-kind");
  });

  test("should use event ID as tie-breaker when created_at is identical (lowest ID wins)", async () => {
    const fixedTimestamp = Math.floor(Date.now() / 1000);
    const dTagValue = "tie-break-test";

    // Create two event templates with identical timestamps and d-tag
    // Content is made slightly different to ensure different IDs after hashing
    const templateA = createAddressableEvent(
      30000,
      dTagValue,
      "Event A content - designed for smaller ID",
      user1Keypair.privateKey,
    );
    templateA.created_at = fixedTimestamp;

    const templateB = createAddressableEvent(
      30000,
      dTagValue,
      "Event B content - designed for larger ID",
      user1Keypair.privateKey,
    );
    templateB.created_at = fixedTimestamp;

    let eventA = await createSignedEvent(templateA, user1Keypair.privateKey);
    let eventB = await createSignedEvent(templateB, user1Keypair.privateKey);

    // Ensure eventA has the lexicographically smaller ID for the test
    if (eventA.id > eventB.id) {
      [eventA, eventB] = [eventB, eventA]; // Swap them
    }
    // At this point, eventA.id < eventB.id is guaranteed

    // Scenario 1: Process larger ID event first, then smaller ID event
    store.storeAddressable(eventB); // Process B (larger id)
    store.storeAddressable(eventA); // Process A (smaller id)

    let latestEvent = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      dTagValue,
    );

    expect(latestEvent).toBeDefined();
    expect(latestEvent?.id).toBe(eventA.id); // Smaller ID (eventA) should win

    // Reset state for next scenario by creating new relay instance or clearing manually
    // For this test, direct calls to processAddressableEvent mean we might need to clear manually
    // or ensure the test is robust. Let's re-process on a fresh state (conceptually)
    // Note: In a real scenario, we'd clear the relay's internal store or use a new instance.
    // For this specific test targeting `processAddressableEvent` directly, the previous event is overwritten.

    // Scenario 2: Process smaller ID event first, then larger ID event
    store.storeAddressable(eventA); // Process A (smaller id)
    store.storeAddressable(eventB); // Process B (larger id)

    latestEvent = store.getAddressable(
      30000,
      user1Keypair.publicKey,
      dTagValue,
    );
    expect(latestEvent).toBeDefined();
    expect(latestEvent?.id).toBe(eventA.id); // Smaller ID (eventA) should still be the one
  });
});
