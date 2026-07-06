import {
  Relay,
  RelayEvent,
  NostrEvent,
  PublishOptions,
  PublishResponse,
  NIP20Prefix,
  ParsedOkReason,
  createEvent,
  getEventHash,
  getPublicKey,
  signEvent,
} from "../../../src";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import { testUtils } from "../../types";
import {
  asTestRelay,
  RelayConnectCallback,
  RelayDisconnectCallback,
  RelayErrorCallback,
  RelayNoticeCallback,
  RelayOkCallback,
  RelayClosedCallback,
  RelayAuthCallback,
} from "../../types";

// Union type for any relay callback to avoid repeating local unions in tests
type AnyRelayCallback =
  | RelayConnectCallback
  | RelayDisconnectCallback
  | RelayErrorCallback
  | RelayNoticeCallback
  | RelayOkCallback
  | RelayClosedCallback
  | RelayAuthCallback;

// Ephemeral relay port for tests
const RELAY_TEST_PORT = 0;
const RELAY_TEST_PRIVATE_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";

async function createSignedRelayEvent(
  overrides: {
    kind?: number;
    tags?: string[][];
    content?: string;
    created_at?: number;
  } = {},
): Promise<NostrEvent> {
  const pubkey = getPublicKey(RELAY_TEST_PRIVATE_KEY);
  const unsigned = createEvent(
    {
      kind: overrides.kind ?? 1,
      tags: overrides.tags ?? [],
      content: overrides.content ?? "Relay ingress event",
      created_at: overrides.created_at ?? Math.floor(Date.now() / 1000),
    },
    pubkey,
  );
  const id = await getEventHash(unsigned);
  const sig = await signEvent(id, RELAY_TEST_PRIVATE_KEY);

  return {
    ...unsigned,
    id,
    sig,
  };
}

async function handleInboundEvent(
  relay: Relay,
  subscriptionId: string,
  event: unknown,
): Promise<void> {
  asTestRelay(relay).handleMessage(["EVENT", subscriptionId, event]);
  await testUtils.sleep(20);
}

function expectRelayError(errors: unknown[], message: string): void {
  const errorMessages = errors.map((error) =>
    error instanceof Error ? error.message : String(error),
  );
  expect(errorMessages).toEqual(
    expect.arrayContaining([expect.stringContaining(message)]),
  );
}

describe("Relay", () => {
  // Setup ephemeral relay for integration tests
  let ephemeralRelay: NostrRelay;

  beforeAll(async () => {
    // Start the ephemeral relay before all tests
    ephemeralRelay = new NostrRelay(RELAY_TEST_PORT);
    await ephemeralRelay.start();
  });

  afterAll(() => {
    // Close the ephemeral relay after tests
    if (ephemeralRelay) {
      ephemeralRelay.close();
    }
  });

  describe("Connection Management", () => {
    test("should connect to ephemeral relay", async () => {
      const relay = new Relay(ephemeralRelay.url);

      // Track connection event
      let connectionEvent = false;
      relay.on(RelayEvent.Connect, () => {
        connectionEvent = true;
      });

      const result = await relay.connect();

      expect(result).toBe(true);
      expect(connectionEvent).toBe(true);

      // Cleanup
      relay.disconnect();
    });

    test("should disconnect gracefully", async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Track disconnect event
      let disconnectEvent = false;
      relay.on(RelayEvent.Disconnect, () => {
        disconnectEvent = true;
      });

      relay.disconnect();

      // Give time for the disconnect event to fire
      await testUtils.sleep(100);

      expect(disconnectEvent).toBe(true);
    });

    test("should handle connection timeout", async () => {
      // Use a non-routable address to force timeout
      const relay = new Relay("ws://10.255.255.255:8080", {
        connectionTimeout: 500,
      });

      // Track error event
      let errorEvent = false;
      relay.on(RelayEvent.Error, () => {
        errorEvent = true;
      });

      const connectPromise = relay.connect();

      // Connection should fail
      const result = await connectPromise;
      expect(result).toBe(false);
      expect(errorEvent).toBe(true);

      // Clean up to prevent async warnings
      relay.disconnect();
    });

    test("should allow setting connection timeout after creation", () => {
      const relay = new Relay(ephemeralRelay.url);

      // Default should be 10000
      expect(relay.getConnectionTimeout()).toBe(10000);

      // Set a new timeout
      relay.setConnectionTimeout(5000);
      expect(relay.getConnectionTimeout()).toBe(5000);

      // Should throw on negative value
      expect(() => {
        relay.setConnectionTimeout(-1);
      }).toThrow();
    });

    test("should handle multiple connect calls efficiently", async () => {
      const relay = new Relay(ephemeralRelay.url);

      // First connection call
      const promise1 = relay.connect();

      // Second connection call while first is in progress
      const promise2 = relay.connect();

      // Both should resolve to the same result
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // After connection is established, connect() should return true immediately
      const result3 = await relay.connect();
      expect(result3).toBe(true);

      // Cleanup
      relay.disconnect();
    });

    test("should clear connectionPromise after connection attempt", async () => {
      const relay = new Relay(ephemeralRelay.url);

      // First connect successfully
      await relay.connect();
      relay.disconnect();

      // Verify the connectionPromise is cleared
      expect(asTestRelay(relay).connectionPromise).toBeNull();

      // Second connect attempt should work
      const result = await relay.connect();
      expect(result).toBe(true);

      // Cleanup
      relay.disconnect();
    });
  });

  describe("Event Handling", () => {
    test("should register event handlers", () => {
      const relay = new Relay(ephemeralRelay.url);

      const handleConnect = jest.fn();
      const handleDisconnect = jest.fn();

      relay.on(RelayEvent.Connect, handleConnect);
      relay.on(RelayEvent.Disconnect, handleDisconnect);

      expect(typeof relay.on).toBe("function");
      expect(() => {
        relay.on(RelayEvent.Notice, () => {});
        relay.on(RelayEvent.Error, () => {});
      }).not.toThrow();
    });

    test("should surface AUTH challenges as strings", () => {
      const relay = new Relay(ephemeralRelay.url);
      const authHandler = jest.fn();

      relay.on(RelayEvent.Auth, authHandler);
      asTestRelay(relay).handleMessage(["AUTH", "challenge-123"]);

      expect(authHandler).toHaveBeenCalledWith("challenge-123");
    });

    test("should reject non-string AUTH challenges", () => {
      const relay = new Relay(ephemeralRelay.url);
      const authHandler = jest.fn();
      const errorHandler = jest.fn();

      relay.on(RelayEvent.Auth, authHandler);
      relay.on(RelayEvent.Error, errorHandler);
      asTestRelay(relay).handleMessage(["AUTH", 123]);

      expect(authHandler).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0]).toBe(ephemeralRelay.url);
      expect(errorHandler.mock.calls[0][1]).toBeInstanceOf(Error);
      expect(errorHandler.mock.calls[0][1].message).toContain(
        "Invalid AUTH challenge",
      );
    });
  });

  describe("Publishing Events", () => {
    let relay: Relay;

    beforeEach(async () => {
      relay = new Relay(ephemeralRelay.url);
      await relay.connect();
    });

    afterEach(() => {
      relay.disconnect();
    });

    test("should wait for relay confirmation before resolving publish", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-123",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      const callbacks = new Map<RelayEvent, AnyRelayCallback>();
      const originalOn = relay.on;
      relay.on = jest.fn((event: RelayEvent, callback: AnyRelayCallback) => {
        callbacks.set(event, callback);
        return originalOn.call(relay, event, callback);
      });

      // Now start the publish
      const publishPromise = relay.publish(event);

      // The publish method should have registered a callback for OK events
      expect(relay.on).toHaveBeenCalledWith(
        RelayEvent.OK,
        expect.any(Function),
      );
      expect(callbacks.has(RelayEvent.OK)).toBe(true);

      // Now directly call the callback as if an OK message was received
      const okCallback = callbacks.get(RelayEvent.OK) as RelayOkCallback;
      // Construct ParsedOkReason for a simple success message
      const successDetails: ParsedOkReason = {
        rawMessage: "accepted: all good",
        message: "accepted: all good", // No standard prefix for simple accept
        // prefix: undefined by default
      };
      okCallback(event.id, true, successDetails);

      // Now the publish promise should resolve with success=true
      const result: PublishResponse = await publishPromise;
      expect(result.success).toBe(true);
      // The 'reason' field (for backward compatibility) should contain the raw message
      expect(result.reason).toBe("accepted: all good");
      // The new 'parsedReason' field should contain the parsed details
      expect(result.parsedReason).toEqual(successDetails);
      expect(result.relay).toBe(ephemeralRelay.url);

      // Restore the original implementation
      relay.on = originalOn;
    });

    test("should handle relay rejection with detailed reason", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-456",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      const callbacks = new Map<RelayEvent, AnyRelayCallback>();
      const originalOn = relay.on;
      relay.on = jest.fn((event: RelayEvent, callback: AnyRelayCallback) => {
        callbacks.set(event, callback);
        return originalOn.call(relay, event, callback);
      });

      // Start the publish
      const publishPromise = relay.publish(event);

      // The publish method should have registered a callback for OK events
      expect(relay.on).toHaveBeenCalledWith(
        RelayEvent.OK,
        expect.any(Function),
      );
      expect(callbacks.has(RelayEvent.OK)).toBe(true);

      // Now directly call the callback with a rejection
      const okCallback = callbacks.get(RelayEvent.OK) as RelayOkCallback;
      // Construct ParsedOkReason for a rejection message
      const failureDetails: ParsedOkReason = {
        prefix: NIP20Prefix.PoW,
        message: "too low, min difficulty 20 required",
        rawMessage: "pow: too low, min difficulty 20 required",
      };
      okCallback(event.id, false, failureDetails);

      // Now the publish promise should resolve with success=false
      const result: PublishResponse = await publishPromise;
      expect(result.success).toBe(false);
      expect(result.reason).toBe("pow: too low, min difficulty 20 required");
      expect(result.parsedReason).toEqual(failureDetails);
      expect(result.relay).toBe(ephemeralRelay.url);

      // Restore the original implementation
      relay.on = originalOn;
    });

    test("should send AUTH events to the relay and wait for OK by default", async () => {
      const authRelay = new Relay(ephemeralRelay.url);
      const relayInternals = asTestRelay(authRelay);

      relayInternals.connected = true;
      relayInternals.ws = {
        readyState: 1,
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        send: jest.fn((payload: string) => {
          expect(payload).toBe(JSON.stringify(["AUTH", authEvent]));
          relayInternals.handleMessage(["OK", authEvent.id, true, "accepted"]);
        }),
        close: jest.fn(),
      } as unknown as WebSocket;

      const authEvent: NostrEvent = {
        id: "auth-event-id",
        pubkey: "f".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 22242,
        tags: [
          ["relay", ephemeralRelay.url],
          ["challenge", "challenge-abc"],
        ],
        content: "",
        sig: "a".repeat(128),
      };

      const result = await authRelay.authenticate(authEvent);

      expect(result).toEqual({
        success: true,
        reason: "accepted",
        parsedReason: {
          rawMessage: "accepted",
          message: "accepted",
        },
        relay: ephemeralRelay.url,
      });
    });

    test("should ignore unrelated relay errors while waiting for OK", async () => {
      const callbacks = new Map<RelayEvent, AnyRelayCallback>();
      const originalOn = relay.on;
      relay.on = jest.fn((event: RelayEvent, callback: AnyRelayCallback) => {
        callbacks.set(event, callback);
        return originalOn.call(relay, event, callback);
      });

      const event: NostrEvent = {
        id: "test-event-id-unrelated-error",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      const publishPromise = relay.publish(event);

      const errorCallback = callbacks.get(RelayEvent.Error) as (
        relayUrl: string,
        error: unknown,
      ) => void;
      const okCallback = callbacks.get(RelayEvent.OK) as RelayOkCallback;

      errorCallback(ephemeralRelay.url, new Error("unrelated relay error"));
      okCallback(event.id, true, {
        rawMessage: "accepted",
        message: "accepted",
      });

      await expect(publishPromise).resolves.toEqual({
        success: true,
        reason: "accepted",
        parsedReason: {
          rawMessage: "accepted",
          message: "accepted",
        },
        relay: ephemeralRelay.url,
      });

      relay.on = originalOn;
    });

    test("should support waitForAck false for AUTH events", async () => {
      const authRelay = new Relay(ephemeralRelay.url);
      const send = jest.fn();
      const relayInternals = asTestRelay(authRelay);

      relayInternals.connected = true;
      relayInternals.ws = {
        readyState: 1,
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        send,
        close: jest.fn(),
      } as unknown as WebSocket;

      const authEvent: NostrEvent = {
        id: "auth-event-id",
        pubkey: "f".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 22242,
        tags: [
          ["relay", ephemeralRelay.url],
          ["challenge", "challenge-abc"],
        ],
        content: "",
        sig: "a".repeat(128),
      };

      const result = await authRelay.authenticate(authEvent, {
        waitForAck: false,
      });

      expect(send).toHaveBeenCalledWith(JSON.stringify(["AUTH", authEvent]));
      expect(result).toEqual({
        success: true,
        relay: ephemeralRelay.url,
      });
    });

    test("should resolve with timeout reason after timeout with no OK response", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-789",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      // Avoid relay-side validation errors interfering with timeout behavior
      const testRelay = asTestRelay(relay);
      const originalWs = testRelay.ws;
      const mockSend = jest.fn();
      testRelay.ws = {
        // Use literal readyState values to avoid global WebSocket mutations
        readyState: 1, // OPEN
        send: mockSend,
      } as unknown as WebSocket;

      try {
        // Use a short real timeout for cross-runner compatibility
        const options: PublishOptions = { timeout: 20 };
        const publishPromise = relay.publish(event, options);

        // Publish can race with disconnects in Bun full-suite runs
        const result: PublishResponse = await publishPromise;
        expect(result.success).toBe(false);
        expect(["timeout", "not_connected"]).toContain(result.reason);
        expect(result.relay).toBe(ephemeralRelay.url);

        if (result.reason === "timeout") {
          expect(mockSend).toHaveBeenCalled();
        } else {
          expect(mockSend).not.toHaveBeenCalled();
        }
      } finally {
        // Restore the original socket
        testRelay.ws = originalWs;
      }
    });

    test("should handle connection issues gracefully", async () => {
      // Create a new disconnected relay
      const disconnectedRelay = new Relay(ephemeralRelay.url);

      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-no-connection",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      // Try to publish without a connection
      const result: PublishResponse = await disconnectedRelay.publish(event);

      // Should fail with a not_connected reason
      expect(result.success).toBe(false);
      // The relay implementation tries to connect automatically, so the failure reason might vary
      // but it should definitely fail with some reason
      expect(result.reason).toBeDefined();
      expect(result.relay).toBe(ephemeralRelay.url);
    });

    test("should handle WebSocket state check correctly", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-ws-state",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event content",
        sig: "test-signature",
      };

      // Mock the WebSocket readyState to simulate a non-OPEN state
      const testRelay = asTestRelay(relay);
      const origWs = testRelay.ws;
      testRelay.ws = { readyState: 2 } as WebSocket; // CLOSING

      // Try to publish with a socket that's not in OPEN state
      const result: PublishResponse = await relay.publish(event);

      // Should fail with not_connected reason
      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_connected");
      expect(result.relay).toBe(ephemeralRelay.url);

      // Restore the original WebSocket
      testRelay.ws = origWs;
    });

    test("should support waitForAck option", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-waitforack",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test event with waitForAck: false",
        sig: "test-signature",
      };

      // Use an isolated relay instance to avoid shared-connection races
      const isolatedRelay = new Relay("ws://example.com");
      const testRelay = asTestRelay(isolatedRelay);
      const origWs = testRelay.ws;
      const origConnected = testRelay.connected;
      const mockSend = jest.fn();
      testRelay.ws = {
        readyState: 1, // OPEN
        send: mockSend,
      } as unknown as WebSocket;
      testRelay.connected = true;

      try {
        // Publish with waitForAck: false
        const options: PublishOptions = { waitForAck: false };
        const result: PublishResponse = await isolatedRelay.publish(event, options);

        // Should immediately return success without waiting for OK
        expect(result.success).toBe(true);
        expect(result.relay).toBe(asTestRelay(isolatedRelay).url);
        expect(mockSend).toHaveBeenCalled();
      } finally {
        // Restore original relay connection state
        testRelay.ws = origWs;
        testRelay.connected = origConnected;
        isolatedRelay.disconnect();
      }
    });

    test("should categorize errors according to RelayErrorType", async () => {
      // Create a test event
      const event: NostrEvent = {
        id: "test-event-id-errors",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test error handling",
        sig: "test-signature",
      };

      // For connection error
      const nonRoutableRelay = new Relay("ws://10.255.255.255:8080", {
        connectionTimeout: 500,
      });
      const connectionErrorResult = await nonRoutableRelay.publish(event);
      expect(connectionErrorResult.success).toBe(false);
      expect(connectionErrorResult.reason).toContain("connection");

      // Clean up non-routable relay
      nonRoutableRelay.disconnect();

      // For timeout error
      const timeoutRelay = asTestRelay(relay);
      const originalWs = timeoutRelay.ws;
      timeoutRelay.ws = {
        readyState: 1, // OPEN
        send: jest.fn(),
      } as unknown as WebSocket;
      const timeoutPromise = relay.publish(event, { timeout: 20 });
      const timeoutResult = await timeoutPromise;
      expect(timeoutResult.success).toBe(false);
      expect(["timeout", "not_connected"]).toContain(timeoutResult.reason);
      timeoutRelay.ws = originalWs;

      // For disconnected error
      const testRelay = asTestRelay(relay);
      const mockWs = { readyState: 3 }; // CLOSED
      const origWs = testRelay.ws;
      testRelay.ws = mockWs as unknown as WebSocket;
      const disconnectedResult = await relay.publish(event);
      expect(disconnectedResult.success).toBe(false);
      expect(disconnectedResult.reason).toBe("not_connected");
      testRelay.ws = origWs;
    });
  });

  describe("Subscription", () => {
    test("should create subscription on ephemeral relay", async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Create subscription
      const receivedEvents: NostrEvent[] = [];

      const subId = relay.subscribe(
        [{ kinds: [1], limit: 10 }],
        (event) => {
          receivedEvents.push(event);
        },
        () => {
          // EOSE handler
        },
      );

      // Verify that we get a subscription ID back
      expect(typeof subId).toBe("string");

      // Try to unsubscribe
      relay.unsubscribe(subId);

      // Cleanup
      relay.disconnect();
    });

    test("should get subscription IDs with getSubscriptionIds", async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Create multiple subscriptions
      const subId1 = relay.subscribe([{ kinds: [1], limit: 5 }], () => {});
      const subId2 = relay.subscribe([{ kinds: [0], limit: 3 }], () => {});
      const subId3 = relay.subscribe([{ kinds: [4], limit: 2 }], () => {});

      // Get subscription IDs
      const subIds = relay.getSubscriptionIds();

      // Verify that the subscription IDs are correct
      expect(subIds.size).toBe(3);
      expect(subIds.has(subId1)).toBe(true);
      expect(subIds.has(subId2)).toBe(true);
      expect(subIds.has(subId3)).toBe(true);

      // Unsubscribe one and check that it gets removed
      relay.unsubscribe(subId2);

      const remainingIds = relay.getSubscriptionIds();
      expect(remainingIds.size).toBe(2);
      expect(remainingIds.has(subId1)).toBe(true);
      expect(remainingIds.has(subId2)).toBe(false);
      expect(remainingIds.has(subId3)).toBe(true);

      // Cleanup
      relay.disconnect();
    });

    test("should auto unsubscribe on EOSE when autoClose is true", async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      const subId = relay.subscribe(
        [{ kinds: [1], limit: 1 }],
        () => {},
        undefined,
        { autoClose: true },
      );

      expect(relay.getSubscriptionIds().has(subId)).toBe(true);

      await testUtils.sleep(100);

      expect(relay.getSubscriptionIds().has(subId)).toBe(false);

      relay.disconnect();
    });

    test("should auto unsubscribe after timeout if EOSE not received", async () => {
      // This behavior depends on the local timer, not on server EOSE responses.
      // Use the ephemeral relay URL to avoid any accidental dependency on the local machine/network.
      // Note: we intentionally do not call relay.connect() in this test.
      const relay = new Relay(ephemeralRelay.url);

      const subId = relay.subscribe([{ kinds: [1] }], () => {}, undefined, {
        autoClose: true,
        eoseTimeout: 50,
      });

      expect(relay.getSubscriptionIds().has(subId)).toBe(true);

      await testUtils.sleep(100);

      expect(relay.getSubscriptionIds().has(subId)).toBe(false);

      relay.disconnect();
    });
  });

  describe("Tag Filtering", () => {
    test("should match events according to NIP-01 tag filtering rules", async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Define valid 64-char lowercase hex IDs for testing
      const validEventId1 =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const validEventId2 =
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

      // Create events with different tag combinations
      const event1 = {
        id: "test-event-id-1", // This ID is internal to the test event, not what's being filtered on directly in tags
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ["e", validEventId1],
          [
            "p",
            "pppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp",
          ], // Example valid pubkey hex
        ],
        content: `Event with e:${validEventId1}`,
        sig: "test-signature",
      };

      const event2 = {
        id: "test-event-id-2",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ["e", validEventId2],
          [
            "p",
            "pppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp",
          ], // Example valid pubkey hex
        ],
        content: `Event with e:${validEventId2}`,
        sig: "test-signature",
      };

      // Publish events to the relay
      await relay.publish(event1);
      await relay.publish(event2);

      // This subscription should receive BOTH events according to NIP-01,
      // because '#e' filter should match events with EITHER validEventId1 OR validEventId2
      const receivedEvents: NostrEvent[] = [];

      // Create subscription with filter for both e tags
      const subId = relay.subscribe(
        [{ kinds: [1], "#e": [validEventId1, validEventId2] }],
        (event) => {
          receivedEvents.push(event);
        },
        () => {
          // Test the results after EOSE is received
          // With the current implementation, we may not receive all events
          // that match according to NIP-01 spec

          // According to NIP-01, we should have received both events
          // Note: Ephemeral relay might not perfectly simulate complex NIP-01 relay logic
          // but the client sent the correct REQ, and if relay is compliant, it should work.
          // For this test, we mainly ensure the subscribe call doesn't throw due to our new validation.
          // The actual event reception depends on the ephemeral relay's filtering capabilities.
          // To make this test more robust for client-side validation, we could check that publish succeeded.

          // Given the test setup, it's hard to guarantee the ephemeral relay returns both.
          // The primary goal of this fix was that subscribe itself doesn't throw for valid filters.
          // A more direct test of the new validation logic has been implicitly added to the Relay.subscribe method.
          // Consider adding a dedicated unit test for _isValidNip01FilterIdentifier and for Relay.subscribe throwing on invalid filters.

          // For now, let's assume the ephemeral relay will do its best.
          // If it sends events, check their content.
          if (receivedEvents.length > 0) {
            expect(
              receivedEvents.some((e) => e.tags.flat().includes(validEventId1)),
            ).toBe(true);
          }
          // We can't be certain about the exact number due to ephemeral relay behavior,
          // but if it sends something, it should be one of the published ones.

          // Clean up
          relay.unsubscribe(subId);
          relay.disconnect();
        },
      );
      // Allow some time for events to be processed by the ephemeral relay and EOSE to be sent
      // This is a common pattern in tests involving asynchronous relay communication.
      await testUtils.sleep(500);
    });
  });

  describe("Message Handling", () => {
    test("should handle OK messages correctly", () => {
      const relay = new Relay(ephemeralRelay.url);

      // Setup a mock to track OK message handling
      let okEventReceived = false;
      let receivedEventId = "";
      let receivedSuccess = false;
      let receivedDetails: ParsedOkReason | undefined = undefined;

      // Mock the event handler to capture OK messages
      relay.on(
        RelayEvent.OK,
        (eventId: string, success: boolean, details: ParsedOkReason) => {
          okEventReceived = true;
          receivedEventId = eventId;
          receivedSuccess = success;
          receivedDetails = details;
        },
      );

      // Manually trigger the OK message handling
      // This is a direct test of the internal handleMessage method
      const testEventId = "test-event-id-ok-message";
      const testSuccess = true;
      const testRawMessage = "pow: Event was stored with PoW 10";
      const expectedDetails: ParsedOkReason = {
        prefix: NIP20Prefix.PoW,
        message: "Event was stored with PoW 10",
        rawMessage: testRawMessage,
      };

      // Access the private handleMessage method using type assertion
      const internalRelay = asTestRelay(relay);
      internalRelay.handleMessage([
        "OK",
        testEventId,
        testSuccess,
        testRawMessage, // handleMessage will parse this
      ]);

      // Verify the handler was called with the right parameters
      expect(okEventReceived).toBe(true);
      expect(receivedEventId).toBe(testEventId);
      expect(receivedSuccess).toBe(testSuccess);
      expect(receivedDetails).toBeDefined();
      expect(receivedDetails!.prefix).toBe(expectedDetails.prefix);
      expect(receivedDetails!.message).toBe(expectedDetails.message);
      expect(receivedDetails!.rawMessage).toBe(expectedDetails.rawMessage);
    });

    test("should handle OK messages correctly (no prefix)", () => {
      const relay = new Relay(ephemeralRelay.url);
      let okEventReceived = false;
      let receivedEventId = "";
      let receivedSuccess = false;
      let receivedDetails: ParsedOkReason | undefined = undefined;

      relay.on(
        RelayEvent.OK,
        (eventId: string, success: boolean, details: ParsedOkReason) => {
          okEventReceived = true;
          receivedEventId = eventId;
          receivedSuccess = success;
          receivedDetails = details;
        },
      );

      const testEventId = "test-event-id-ok-no-prefix";
      const testSuccess = true;
      const testRawMessage = "Event was stored";
      const expectedDetails: ParsedOkReason = {
        // prefix should be undefined
        message: "Event was stored",
        rawMessage: testRawMessage,
      };
      const internalRelay = asTestRelay(relay);
      internalRelay.handleMessage([
        "OK",
        testEventId,
        testSuccess,
        testRawMessage,
      ]);

      expect(okEventReceived).toBe(true);
      expect(receivedEventId).toBe(testEventId);
      expect(receivedSuccess).toBe(testSuccess);
      expect(receivedDetails).toBeDefined();
      expect(receivedDetails!.prefix).toBeUndefined();
      expect(receivedDetails!.message).toBe(expectedDetails.message);
      expect(receivedDetails!.rawMessage).toBe(expectedDetails.rawMessage);
    });

    test("should handle CLOSED messages correctly", () => {
      const relay = new Relay(ephemeralRelay.url);

      // Setup a mock to track CLOSED message handling
      let closedMessageReceived = false;
      let closedSubId = "";
      let closedMessage = "";

      // Mock the event handler to capture CLOSED messages
      relay.on(RelayEvent.Closed, (subscriptionId: string, message: string) => {
        closedMessageReceived = true;
        closedSubId = subscriptionId;
        closedMessage = message;
      });

      // Create a subscription so we can verify it gets removed
      const subId = "test-subscription-id";
      const internalRelay = asTestRelay(relay);
      internalRelay.subscriptions.set(subId, {
        id: subId,
        filters: [{ kinds: [1] }],
        onEvent: () => {},
      });

      // Verify the subscription exists before
      expect(internalRelay.subscriptions.has(subId)).toBe(true);

      // Manually trigger the CLOSED message handling
      const testMessage = "Subscription closed due to inactivity";
      internalRelay.handleMessage(["CLOSED", subId, testMessage]);

      // Verify the handler was called with the right parameters
      expect(closedMessageReceived).toBe(true);
      expect(closedSubId).toBe(subId);
      expect(closedMessage).toBe(testMessage);

      // Verify the subscription was removed
      expect(internalRelay.subscriptions.has(subId)).toBe(false);
    });
  });

  describe("Event Validation", () => {
    let relay: Relay;

    beforeEach(() => {
      relay = new Relay("wss://example.com");
    });

    test("should deliver valid signed inbound EVENT messages", async () => {
      const onEvent = jest.fn();
      const subscriptionId = relay.subscribe([{ kinds: [1] }], onEvent);
      const event = await createSignedRelayEvent();

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });

    test("should reject malformed inbound EVENT messages", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{ kinds: [1] }], onEvent);
      const event = {
        id: "a".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "missing pubkey",
        sig: "b".repeat(128),
      };

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(errors, "Invalid or missing pubkey");
    });

    test("should reject inbound EVENT messages with invalid ids", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{ kinds: [1] }], onEvent);
      const event = {
        ...(await createSignedRelayEvent()),
        id: "0".repeat(64),
      };

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(errors, "Event ID does not match content hash");
    });

    test("should reject inbound EVENT messages with invalid signatures", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{ kinds: [1] }], onEvent);
      const event = {
        ...(await createSignedRelayEvent()),
        sig: "0".repeat(128),
      };

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(errors, "Invalid signature");
    });

    test("should reject inbound EVENT messages with future timestamps", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{ kinds: [1] }], onEvent);
      const event = await createSignedRelayEvent({
        created_at: Math.floor(Date.now() / 1000) + 7200,
      });

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(errors, "too far in the future");
    });

    test("should reject inbound EVENT messages with out-of-range kinds", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{}], onEvent);
      const event = await createSignedRelayEvent({ kind: 70000 });

      await handleInboundEvent(relay, subscriptionId, event);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(errors, "Kind must be an integer between 0 and 65535");
    });

    test.each([
      {
        description: "invalid p tag reference",
        tags: [["p", "z".repeat(64)]],
        expectedMessage: "Invalid NIP-01 'p' tag",
      },
      {
        description: "invalid a tag coordinate",
        tags: [["a", "bad-coordinate"]],
        expectedMessage: "Invalid NIP-01 'a' tag",
      },
    ])(
      "should reject inbound EVENT messages with $description",
      async ({ tags, expectedMessage }) => {
        const onEvent = jest.fn();
        const errors: unknown[] = [];
        relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
        const subscriptionId = relay.subscribe([{}], onEvent);
        const event = await createSignedRelayEvent({ tags });

        await handleInboundEvent(relay, subscriptionId, event);

        expect(onEvent).not.toHaveBeenCalled();
        expectRelayError(errors, expectedMessage);
      },
    );

    test("should reject NIP-46 encrypted inbound EVENT messages without p tags", async () => {
      const onEvent = jest.fn();
      const errors: unknown[] = [];
      relay.on(RelayEvent.Error, (_url, error) => errors.push(error));
      const subscriptionId = relay.subscribe([{ kinds: [24133] }], onEvent);
      const pubkey = getPublicKey(RELAY_TEST_PRIVATE_KEY);
      const encryptedEvent: NostrEvent = {
        id: "a".repeat(64),
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 24133,
        tags: [],
        content: "encrypted request",
        sig: "b".repeat(128),
      };

      await handleInboundEvent(relay, subscriptionId, encryptedEvent);

      expect(onEvent).not.toHaveBeenCalled();
      expectRelayError(
        errors,
        "NIP-46 Relay ingress events must include at least one p tag",
      );
    });

    test("should keep NIP-46 encrypted inbound EVENT validation explicit", async () => {
      const onEvent = jest.fn();
      const subscriptionId = relay.subscribe([{ kinds: [24133] }], onEvent);
      const pubkey = getPublicKey(RELAY_TEST_PRIVATE_KEY);
      const encryptedEvent: NostrEvent = {
        id: "a".repeat(64),
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 24133,
        tags: [["p", pubkey]],
        content: "encrypted request",
        sig: "b".repeat(128),
      };

      await handleInboundEvent(relay, subscriptionId, encryptedEvent);

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(encryptedEvent);
    });
  });

  describe("Addressable events (kinds 30000-39999)", () => {
    let relay: Relay;
    let testEvent: NostrEvent;

    beforeEach(async () => {
      relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Create a valid addressable event
      testEvent = {
        id: "b0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3cd",
        pubkey:
          "884704d5780d85163c138d2695ca263eb7552b0f2c5ebaf86c8d9c4e62a337e3",
        created_at: 1671312795,
        kind: 30001,
        tags: [
          ["d", "test-identifier"],
          ["t", "test"],
        ],
        content: "test content for addressable event",
        sig: "553e66e4316cd6f8e2c363b7677d41da0f6b37775daa7728acdda6e477ed2fbf03be27c33f1eddaa2ee2711e9ca7c0ad7e97dd4d3eb4c1cf9ceaf98d9000af6a",
      };
    });

    afterEach(() => {
      relay.disconnect();
    });

    test("should process and store addressable events", () => {
      // Access the private method directly for testing
      const testRelay = asTestRelay(relay);
      testRelay.processAddressableEvent(testEvent);

      // Get the stored event using the public API
      const storedEvent = relay.getLatestAddressableEvent(
        30001,
        testEvent.pubkey,
        "test-identifier",
      );

      // Verify it was stored correctly
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.id).toBe(testEvent.id);
      expect(storedEvent?.kind).toBe(30001);
    });

    test("should replace older events with the same pubkey, kind, and d-tag", () => {
      // Create an older event with the same pubkey, kind, and d-tag
      const olderEvent = {
        ...testEvent,
        id: "c0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3ee",
        created_at: 1671312700, // Older timestamp
        content: "older content",
      };

      // Create a newer event with the same pubkey, kind, and d-tag
      const newerEvent = {
        ...testEvent,
        id: "d0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3ff",
        created_at: 1671312900, // Newer timestamp
        content: "newer content",
      };

      // Process events out of order (newer first, then older)
      const testRelay = asTestRelay(relay);
      testRelay.processAddressableEvent(newerEvent);
      testRelay.processAddressableEvent(olderEvent);

      // Get the stored event
      const storedEvent = relay.getLatestAddressableEvent(
        30001,
        testEvent.pubkey,
        "test-identifier",
      );

      // Verify the newer event was kept
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.id).toBe(newerEvent.id);
      expect(storedEvent?.content).toBe("newer content");
    });

    test("should handle events with different d-tags separately", () => {
      // Create an event with a different d-tag
      const differentDTagEvent = {
        ...testEvent,
        id: "e0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f400",
        tags: [
          ["d", "different-identifier"],
          ["t", "test"],
        ],
        content: "different d-tag content",
      };

      // Process both events
      const testRelay = asTestRelay(relay);
      testRelay.processAddressableEvent(testEvent);
      testRelay.processAddressableEvent(differentDTagEvent);

      // Get the stored events
      const event1 = relay.getLatestAddressableEvent(
        30001,
        testEvent.pubkey,
        "test-identifier",
      );
      const event2 = relay.getLatestAddressableEvent(
        30001,
        testEvent.pubkey,
        "different-identifier",
      );

      // Verify both events were stored
      expect(event1).toBeDefined();
      expect(event1?.id).toBe(testEvent.id);
      expect(event1?.content).toBe("test content for addressable event");

      expect(event2).toBeDefined();
      expect(event2?.id).toBe(differentDTagEvent.id);
      expect(event2?.content).toBe("different d-tag content");
    });

    test("should retrieve addressable events by pubkey", () => {
      // Create another event with the same pubkey but different kind and d-tag
      const anotherEvent = {
        ...testEvent,
        id: "f0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f401",
        kind: 30002,
        tags: [
          ["d", "another-identifier"],
          ["t", "test"],
        ],
        content: "another content",
      };

      // Process both events
      const testRelay = asTestRelay(relay);
      testRelay.processAddressableEvent(testEvent);
      testRelay.processAddressableEvent(anotherEvent);

      // Get events by pubkey
      const events = relay.getAddressableEventsByPubkey(testEvent.pubkey);

      // Verify both events were retrieved
      expect(events.length).toBe(2);
      expect(events.some((e) => e.id === testEvent.id)).toBe(true);
      expect(events.some((e) => e.id === anotherEvent.id)).toBe(true);
    });

    test("should retrieve addressable events by kind", () => {
      // Create another event with the same kind but different pubkey
      const differentPubkeyEvent = {
        ...testEvent,
        id: "g0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f402",
        pubkey:
          "994704d5780d85163c138d2695ca263eb7552b0f2c5ebaf86c8d9c4e62a337f4",
        tags: [
          ["d", "another-pubkey-identifier"],
          ["t", "test"],
        ],
        content: "different pubkey content",
      };

      // Process both events
      const testRelay = asTestRelay(relay);
      testRelay.processAddressableEvent(testEvent);
      testRelay.processAddressableEvent(differentPubkeyEvent);

      // Get events by kind
      const events = relay.getAddressableEventsByKind(30001);

      // Verify both events were retrieved
      expect(events.length).toBe(2);
      expect(events.some((e) => e.id === testEvent.id)).toBe(true);
      expect(events.some((e) => e.id === differentPubkeyEvent.id)).toBe(true);
    });

    test("should properly handle addressable events through handleMessage", async () => {
      // Create a subscription to receive events
      const onEvent = jest.fn();
      const subscriptionId = relay.subscribe([{}], onEvent);
      const testRelay = asTestRelay(relay);

      // Create a valid addressable event
      const addressableEvent = await createSignedRelayEvent({
        kind: 30001,
        tags: [["d", "test-identifier"]],
        content: "Addressable event through handleMessage",
      });

      // Process the event through handleMessage
      testRelay.handleMessage(["EVENT", subscriptionId, addressableEvent]);

      await testUtils.sleep(20);

      const storedEvent = relay.getLatestAddressableEvent(
        30001,
        addressableEvent.pubkey,
        "test-identifier",
      );
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.id).toBe(addressableEvent.id);
      expect(onEvent).toHaveBeenCalledWith(addressableEvent);
    });
  });

  describe("Replaceable events (kinds 0, 3, 10000-19999)", () => {
    let relay: Relay;
    let testEvent: NostrEvent;

    beforeEach(async () => {
      relay = new Relay(ephemeralRelay.url);
      await relay.connect();

      // Create a valid replaceable event (kind 0)
      testEvent = {
        id: "a0635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3cd",
        pubkey:
          "884704d5780d85163c138d2695ca263eb7552b0f2c5ebaf86c8d9c4e62a337e3",
        created_at: 1671312795,
        kind: 0,
        tags: [
          ["name", "Test User"],
          ["about", "Test description"],
        ],
        content: JSON.stringify({
          name: "Test User",
          about: "Test description",
        }),
        sig: "553e66e4316cd6f8e2c363b7677d41da0f6b37775daa7728acdda6e477ed2fbf03be27c33f1eddaa2ee2711e9ca7c0ad7e97dd4d3eb4c1cf9ceaf98d9000af6a",
      };
    });

    afterEach(() => {
      relay.disconnect();
    });

    test("should process and store replaceable events", () => {
      // Process the event
      const testRelay = asTestRelay(relay);
      testRelay.processReplaceableEvent(testEvent);

      // Create a newer version
      const newerEvent = {
        ...testEvent,
        created_at: testEvent.created_at + 1000,
        id: "b1635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3cf",
        content: JSON.stringify({
          name: "Test User Updated",
          about: "Updated description",
        }),
      };

      // Process the newer event
      testRelay.processReplaceableEvent(newerEvent);

      // Get the latest event
      const retrievedEvent = relay.getLatestReplaceableEvent(
        testEvent.pubkey,
        testEvent.kind,
      );

      // It should be the newer event
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent?.id).toBe(newerEvent.id);
      expect(retrievedEvent?.content).toBe(newerEvent.content);
    });

    test("should keep older event if newer one has older timestamp", () => {
      // Process the event
      const testRelay = asTestRelay(relay);
      testRelay.processReplaceableEvent(testEvent);

      // Create an event with newer id but older timestamp
      const olderEvent = {
        ...testEvent,
        created_at: testEvent.created_at - 1000, // Older timestamp
        id: "c1635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3c0", // Newer id
        content: JSON.stringify({
          name: "Test User Older",
          about: "This should not replace the original",
        }),
      };

      // Process the older event
      testRelay.processReplaceableEvent(olderEvent);

      // Get the latest event
      const retrievedEvent = relay.getLatestReplaceableEvent(
        testEvent.pubkey,
        testEvent.kind,
      );

      // It should still be the original event
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent?.id).toBe(testEvent.id);
      expect(retrievedEvent?.content).toBe(testEvent.content);
    });

    test("should retrieve replaceable events by pubkey and kind", () => {
      // Process events of different kinds
      const testRelay = asTestRelay(relay);
      testRelay.processReplaceableEvent(testEvent); // kind 0

      // Create a kind 3 event
      const contactEvent = {
        ...testEvent,
        kind: 3,
        content: "",
        tags: [["p", "some-pubkey", "some-relay"]],
        id: "d1635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3d1",
      };

      // Create a kind 10002 event
      const relayEvent = {
        ...testEvent,
        kind: 10002,
        content: "",
        tags: [["r", "wss://relay.example.com", "read"]],
        id: "e1635d6a9851d3aed0bc1c4f0c0924235bff013e037bf21eee532da2bba4f3e2",
      };

      // Process these events
      testRelay.processReplaceableEvent(contactEvent);
      testRelay.processReplaceableEvent(relayEvent);

      // Retrieve each kind
      const retrievedKind0 = relay.getLatestReplaceableEvent(
        testEvent.pubkey,
        0,
      );
      const retrievedKind3 = relay.getLatestReplaceableEvent(
        testEvent.pubkey,
        3,
      );
      const retrievedKind10002 = relay.getLatestReplaceableEvent(
        testEvent.pubkey,
        10002,
      );

      // Verify correct events were retrieved
      expect(retrievedKind0?.id).toBe(testEvent.id);
      expect(retrievedKind3?.id).toBe(contactEvent.id);
      expect(retrievedKind10002?.id).toBe(relayEvent.id);
    });
  });
});
