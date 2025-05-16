import { generateKeypair } from "../../../src/utils/crypto";
import {
  createAddressableEvent,
  createSignedEvent,
} from "../../../src/nip01/event";
import { Relay } from "../../../src/nip01/relay";
import { NostrEvent } from "../../../src/types/nostr";

// Mock WebSocket
jest.mock("websocket-polyfill", () => {});

// Define interface for private relay methods we need to access in tests
interface RelayPrivateMethods {
  processValidatedEvent(event: NostrEvent, subscriptionId: string): void;
  processAddressableEvent(event: NostrEvent): void;
  processReplaceableEvent(event: NostrEvent): void;
  getLatestAddressableEvent(
    kind: number,
    pubkey: string,
    dTagValue?: string,
  ): NostrEvent | undefined;
}

// Type-safe TestRelay class
class TestRelay extends Relay {
  // Expose private methods with proper typing via type assertion
  getPrivateMethods(): RelayPrivateMethods {
    return this as unknown as RelayPrivateMethods;
  }
}

describe("Addressable Events (NIP-01 §7.1)", () => {
  let relay: TestRelay;
  let relayMethods: RelayPrivateMethods;
  let user1Keypair: { privateKey: string; publicKey: string };
  let testEvents: {
    event1: NostrEvent;
    event2: NostrEvent;
    event3: NostrEvent;
    event4: NostrEvent;
  };

  beforeEach(async () => {
    // Create a relay instance
    relay = new TestRelay("wss://test.relay");
    relayMethods = relay.getPrivateMethods();

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
    relayMethods.processValidatedEvent(testEvents.event1, "sub1");
    relayMethods.processValidatedEvent(testEvents.event2, "sub1");

    // Get latest events for each d-tag value
    const latest1 = relayMethods.getLatestAddressableEvent(
      30000,
      user1Keypair.publicKey,
      "value1",
    );

    const latest2 = relayMethods.getLatestAddressableEvent(
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
    relayMethods.processValidatedEvent(testEvents.event1, "sub1");

    // Process newer event with same d-tag
    relayMethods.processValidatedEvent(testEvents.event3, "sub1");

    // Get latest event
    const latest = relayMethods.getLatestAddressableEvent(
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
    relayMethods.processValidatedEvent(testEvents.event1, "sub1");
    relayMethods.processValidatedEvent(testEvents.event4, "sub1");

    // Get latest events for each kind
    const latest1 = relayMethods.getLatestAddressableEvent(
      30000,
      user1Keypair.publicKey,
      "value1",
    );

    const latest2 = relayMethods.getLatestAddressableEvent(
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
});
