import { generateKeypair } from "../../src/utils/crypto";
import { createAddressableEvent, createSignedEvent } from "../../src/utils/event";
import { Relay } from "../../src/client/relay";
import { NostrEvent } from "../../src/types/nostr";

// Mock WebSocket
jest.mock("websocket-polyfill", () => {});

describe("Addressable Events (NIP-01 §7.1)", () => {
  let relay: Relay;
  let user1Keypair: { privateKey: string; publicKey: string };
  let testEvents: {
    event1: NostrEvent;
    event2: NostrEvent;
    event3: NostrEvent;
    event4: NostrEvent;
  };

  beforeEach(async () => {
    // Create a relay instance
    relay = new Relay("wss://test.relay");

    // Set up test data
    user1Keypair = await generateKeypair();

    // Create test events
    const event1Template = createAddressableEvent(
      30000, 
      "value1", 
      "content-1", 
      user1Keypair.privateKey
    );
    
    const event2Template = createAddressableEvent(
      30000, 
      "value2", 
      "content-2", 
      user1Keypair.privateKey
    );
    
    const event3Template = createAddressableEvent(
      30000, 
      "value1", 
      "content-3-newer", 
      user1Keypair.privateKey
    );
    // Manually set a newer timestamp
    event3Template.created_at = Math.floor(Date.now() / 1000) + 100; // 100 seconds in the future
    
    const event4Template = createAddressableEvent(
      30001, 
      "value1", 
      "content-4-different-kind", 
      user1Keypair.privateKey
    );
    
    // Sign all events
    testEvents = {
      event1: await createSignedEvent(event1Template, user1Keypair.privateKey),
      event2: await createSignedEvent(event2Template, user1Keypair.privateKey),
      event3: await createSignedEvent(event3Template, user1Keypair.privateKey),
      event4: await createSignedEvent(event4Template, user1Keypair.privateKey)
    };
    
    // Expose the private methods for testing
    (relay as any).processValidatedEvent = Relay.prototype["processValidatedEvent"].bind(relay);
    (relay as any).processAddressableEvent = Relay.prototype["processAddressableEvent"].bind(relay);
    (relay as any).processReplaceableEvent = Relay.prototype["processReplaceableEvent"].bind(relay);
    (relay as any).getLatestAddressableEvent = Relay.prototype["getLatestAddressableEvent"].bind(relay);
  });

  test("Different d-tag values create separate addressable events", async () => {
    // Process events with same pubkey and kind but different d-tag values
    (relay as any).processValidatedEvent(testEvents.event1, "sub1");
    (relay as any).processValidatedEvent(testEvents.event2, "sub1");
    
    // Get latest events for each d-tag value
    const latest1 = (relay as any).getLatestAddressableEvent(
      30000, 
      user1Keypair.publicKey, 
      "value1"
    );
    
    const latest2 = (relay as any).getLatestAddressableEvent(
      30000, 
      user1Keypair.publicKey, 
      "value2"
    );
    
    // Both events should be stored separately
    expect(latest1).toBeDefined();
    expect(latest2).toBeDefined();
    expect(latest1.content).toBe("content-1");
    expect(latest2.content).toBe("content-2");
  });

  test("Newer event with same d-tag replaces older one", async () => {
    // Process original event
    (relay as any).processValidatedEvent(testEvents.event1, "sub1");
    
    // Process newer event with same d-tag
    (relay as any).processValidatedEvent(testEvents.event3, "sub1");
    
    // Get latest event
    const latest = (relay as any).getLatestAddressableEvent(
      30000, 
      user1Keypair.publicKey, 
      "value1"
    );
    
    // Should be the newer event
    expect(latest).toBeDefined();
    expect(latest.content).toBe("content-3-newer");
  });

  test("Different kinds with same d-tag are stored separately", async () => {
    // Process events with same pubkey and d-tag but different kinds
    (relay as any).processValidatedEvent(testEvents.event1, "sub1");
    (relay as any).processValidatedEvent(testEvents.event4, "sub1");
    
    // Get latest events for each kind
    const latest1 = (relay as any).getLatestAddressableEvent(
      30000, 
      user1Keypair.publicKey, 
      "value1"
    );
    
    const latest2 = (relay as any).getLatestAddressableEvent(
      30001, 
      user1Keypair.publicKey, 
      "value1"
    );
    
    // Both events should be stored separately
    expect(latest1).toBeDefined();
    expect(latest2).toBeDefined();
    expect(latest1.content).toBe("content-1");
    expect(latest2.content).toBe("content-4-different-kind");
  });
}); 