/**
 * Integration test for the relay event ordering functionality.
 * This test validates that events are properly ordered according to the NIP-01 specification.
 */

import { Relay } from "../../src/client/relay";
import { NostrEvent } from "../../src/types/nostr";
import { jest } from "@jest/globals";

/**
 * This integration test validates that the relay properly orders events
 * according to NIP-01 specification:
 * 1. By created_at timestamp (newest first)
 * 2. By event ID (lexical order) when timestamps are the same
 */
describe("Relay Event Ordering Integration", () => {
  // Mock the WebSocket module at a higher level
  let mockSocketInstance: any;
  let relay: Relay;
  let onEventCallback: jest.Mock;
  let onEOSECallback: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Create mock callbacks
    onEventCallback = jest.fn();
    onEOSECallback = jest.fn();
    
    // Create a mock WebSocket implementation
    mockSocketInstance = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // WebSocket.OPEN
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null
    };
    
    // Mock the WebSocket constructor
    global.WebSocket = jest.fn(() => mockSocketInstance) as any;
    
    // Create a relay with a 50ms buffer flush delay
    relay = new Relay("wss://test-relay.com", { bufferFlushDelay: 50 });
    
    // Expose private methods for testing
    (relay as any).sortEvents = (relay as any).sortEvents.bind(relay);
    (relay as any).flushSubscriptionBuffer = (relay as any).flushSubscriptionBuffer.bind(relay);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    if (relay) {
      relay.disconnect();
    }
  });

  test("should properly order and deliver events from the buffer", async () => {
    // Start connection
    const connectionPromise = relay.connect();
    
    // Trigger onopen callback
    mockSocketInstance.onopen();
    
    await connectionPromise;
    
    // Create a subscription
    const subscriptionId = relay.subscribe([{ kinds: [1] }], onEventCallback, onEOSECallback);
    
    // Create test events with different timestamps
    const event1: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000, // Oldest
      kind: 1,
      tags: [],
      content: "Oldest event",
      sig: "sig",
    };
    
    const event2: NostrEvent = {
      id: "bbb",
      pubkey: "abc",
      created_at: 2000, // Newest
      kind: 1,
      tags: [],
      content: "Newest event",
      sig: "sig",
    };
    
    // Create events with same timestamp but different IDs
    const event3: NostrEvent = {
      id: "ddd", // Lexically larger
      pubkey: "abc",
      created_at: 1500, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event with same timestamp (d)",
      sig: "sig",
    };
    
    const event4: NostrEvent = {
      id: "ccc", // Lexically smaller
      pubkey: "abc",
      created_at: 1500, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event with same timestamp (c)",
      sig: "sig",
    };
    
    // Manually add events to the buffer
    (relay as any).eventBuffers.set(subscriptionId, [event1, event3, event4, event2]);
    
    // Directly call flushSubscriptionBuffer
    (relay as any).flushSubscriptionBuffer(subscriptionId);
    
    // Now events should be delivered in the correct order
    expect(onEventCallback).toHaveBeenCalledTimes(4);
    
    // Expected order:
    // 1. event2 (created_at: 2000) - newest
    // 2. event3 or event4 (created_at: 1500) - same timestamp
    // 3. event4 or event3 (created_at: 1500) - same timestamp
    // 4. event1 (created_at: 1000) - oldest
    
    // Check sorting order
    const firstArg = onEventCallback.mock.calls[0][0] as NostrEvent;
    const secondArg = onEventCallback.mock.calls[1][0] as NostrEvent;
    const thirdArg = onEventCallback.mock.calls[2][0] as NostrEvent;
    const fourthArg = onEventCallback.mock.calls[3][0] as NostrEvent;
    
    expect(firstArg.id).toBe(event2.id); // Newest timestamp
    expect(secondArg.id).toBe(event3.id); // Middle timestamp, lexically LARGER (new rule)
    expect(thirdArg.id).toBe(event4.id); // Middle timestamp, lexically SMALLER (new rule)
    expect(fourthArg.id).toBe(event1.id); // Oldest timestamp
  });

  test("should flush buffer immediately on EOSE", async () => {
    // Start connection
    const connectionPromise = relay.connect();
    
    // Trigger onopen callback
    mockSocketInstance.onopen();
    
    await connectionPromise;
    
    // Create a subscription
    const subscriptionId = relay.subscribe([{ kinds: [1] }], onEventCallback, onEOSECallback);
    
    // Create test events
    const event1: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000, // Older
      kind: 1,
      tags: [],
      content: "Older event",
      sig: "sig",
    };
    
    const event2: NostrEvent = {
      id: "bbb",
      pubkey: "abc",
      created_at: 2000, // Newer
      kind: 1,
      tags: [],
      content: "Newer event",
      sig: "sig",
    };
    
    // Manually add events to the buffer
    (relay as any).eventBuffers.set(subscriptionId, [event1, event2]);
    
    // Simulate receiving EOSE
    mockSocketInstance.onmessage({
      data: JSON.stringify(["EOSE", subscriptionId])
    });
    
    // EOSE should trigger immediate buffer flush
    expect(onEventCallback).toHaveBeenCalledTimes(2);
    expect(onEOSECallback).toHaveBeenCalledTimes(1);
    
    // Events should be ordered correctly
    const firstEventDelivered = onEventCallback.mock.calls[0][0] as NostrEvent;
    const secondEventDelivered = onEventCallback.mock.calls[1][0] as NostrEvent;
    
    expect(firstEventDelivered.id).toBe(event2.id); // Newer event first
    expect(secondEventDelivered.id).toBe(event1.id); // Older event second
  });
  
  test("should not deliver events for unsubscribed subscriptions", async () => {
    // Start connection
    const connectionPromise = relay.connect();
    
    // Trigger onopen callback
    mockSocketInstance.onopen();
    
    await connectionPromise;
    
    // Create a subscription
    const subscriptionId = relay.subscribe([{ kinds: [1] }], onEventCallback);
    
    // Unsubscribe immediately
    relay.unsubscribe(subscriptionId);
    
    // Create a test event
    const event: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000,
      kind: 1, 
      tags: [],
      content: "Test event",
      sig: "sig",
    };
    
    // Manually add events to the buffer
    (relay as any).eventBuffers.set(subscriptionId, [event]);
    
    // Directly call flushSubscriptionBuffer
    (relay as any).flushSubscriptionBuffer(subscriptionId);
    
    // No events should be delivered
    expect(onEventCallback).not.toHaveBeenCalled();
  });
}); 