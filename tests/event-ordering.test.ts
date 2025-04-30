import { Relay } from "../src/client/relay";
import { NostrEvent } from "../src/types/nostr";
import { jest } from "@jest/globals";

describe("Event ordering", () => {
  let relay: Relay;
  let mockWs: any;
  let onEventMock: jest.Mock;
  let subscribeMock: jest.Mock;

  beforeEach(() => {
    // Set up a mock WebSocket
    mockWs = {
      close: jest.fn(),
      send: jest.fn(),
      readyState: 1,
    };

    // Override global WebSocket for testing
    global.WebSocket = jest.fn().mockImplementation(() => {
      setTimeout(() => {
        mockWs.onopen && mockWs.onopen();
      }, 0);
      return mockWs;
    }) as any;

    // Create the relay with a very short buffer flush delay
    relay = new Relay("wss://test.relay", { bufferFlushDelay: 10 });

    // Create mocks for event handlers
    onEventMock = jest.fn();
    subscribeMock = jest.fn();
  });

  afterEach(() => {
    relay.disconnect();
    jest.clearAllMocks();
  });

  test("should order events by created_at (newest first)", async () => {
    // Connect to the relay
    await relay.connect();

    // Subscribe to events
    const subscriptionId = relay.subscribe([{ kinds: [1] }], onEventMock);

    // Create test events with different timestamps
    const event1: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000,
      kind: 1,
      tags: [],
      content: "First event (oldest)",
      sig: "sig",
    };

    const event2: NostrEvent = {
      id: "bbb",
      pubkey: "abc",
      created_at: 2000,
      kind: 1,
      tags: [],
      content: "Second event (newest)",
      sig: "sig",
    };

    // Simulate receiving events out of order
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event1]),
    });
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event2]),
    });

    // Wait for buffer to flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check if events were delivered in the correct order (newest first)
    expect(onEventMock).toHaveBeenCalledTimes(2);
    expect(onEventMock.mock.calls[0][0]).toEqual(event2); // Newest event first
    expect(onEventMock.mock.calls[1][0]).toEqual(event1); // Oldest event second
  });

  test("should order events by id when created_at is the same", async () => {
    // Connect to the relay
    await relay.connect();

    // Subscribe to events
    const subscriptionId = relay.subscribe([{ kinds: [1] }], onEventMock);

    // Create test events with the same timestamp but different IDs
    const event1: NostrEvent = {
      id: "bbb", // Lexically larger ID
      pubkey: "abc",
      created_at: 1000, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event B",
      sig: "sig",
    };

    const event2: NostrEvent = {
      id: "aaa", // Lexically smaller ID
      pubkey: "abc",
      created_at: 1000, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event A",
      sig: "sig",
    };

    // Simulate receiving events in random order
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event1]),
    });
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event2]),
    });

    // Wait for buffer to flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check if events were delivered in the correct order (lexically by ID when timestamps match)
    expect(onEventMock).toHaveBeenCalledTimes(2);
    expect(onEventMock.mock.calls[0][0]).toEqual(event2); // 'aaa' comes first
    expect(onEventMock.mock.calls[1][0]).toEqual(event1); // 'bbb' comes second
  });

  test("should immediately flush buffer on EOSE", async () => {
    // Connect to the relay
    await relay.connect();

    // Create a mock for the onEOSE callback
    const onEOSEMock = jest.fn();

    // Subscribe to events
    const subscriptionId = relay.subscribe(
      [{ kinds: [1] }],
      onEventMock,
      onEOSEMock,
    );

    // Create test events
    const event1: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000,
      kind: 1,
      tags: [],
      content: "First event",
      sig: "sig",
    };

    const event2: NostrEvent = {
      id: "bbb",
      pubkey: "abc",
      created_at: 2000,
      kind: 1,
      tags: [],
      content: "Second event",
      sig: "sig",
    };

    // Simulate receiving events
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event1]),
    });
    mockWs.onmessage({
      data: JSON.stringify(["EVENT", subscriptionId, event2]),
    });

    // Events should not be delivered yet
    expect(onEventMock).not.toHaveBeenCalled();

    // Simulate receiving EOSE
    mockWs.onmessage({ data: JSON.stringify(["EOSE", subscriptionId]) });

    // Events should be delivered immediately after EOSE without waiting for buffer flush delay
    expect(onEventMock).toHaveBeenCalledTimes(2);
    expect(onEventMock.mock.calls[0][0]).toEqual(event2); // Newest event first
    expect(onEventMock.mock.calls[1][0]).toEqual(event1); // Oldest event second

    // EOSE callback should be called
    expect(onEOSEMock).toHaveBeenCalledTimes(1);
  });
});
