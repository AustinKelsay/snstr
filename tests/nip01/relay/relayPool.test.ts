import { RelayPool, NostrEvent } from "../../../src";
import { testUtils } from "../../types";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../../src/utils/crypto";
import { createTextNote, createSignedEvent } from "../../../src/nip01/event";

const PORT1 = 0;
const PORT2 = 0;

describe("RelayPool", () => {
  let relay1: NostrRelay;
  let relay2: NostrRelay;

  beforeAll(async () => {
    relay1 = new NostrRelay(PORT1);
    relay2 = new NostrRelay(PORT2);
    await relay1.start();
    await relay2.start();
  });

  afterAll(() => {
    relay1.close();
    relay2.close();
  });

  test("should publish events to multiple relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();
    const unsigned = createTextNote("pool publish", keys.privateKey);
    const event = await createSignedEvent(unsigned, keys.privateKey);

    try {
      const results = await Promise.all(
        pool.publish([relay1.url, relay2.url], event),
      );
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.success).toBe(true));
    } finally {
      await pool.close();
    }
  });

  test("should subscribe and receive events from all relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    const received: Record<string, NostrEvent[]> = {
      [relay1.url]: [],
      [relay2.url]: [],
    };

    try {
      // Helper: wait until at least one event has been received from both relays
      const waitForBoth = async () =>
        testUtils.waitFor(
          () =>
            received[relay1.url].length > 0 && received[relay2.url].length > 0,
          2000,
          10,
        );

      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1] }],
        (event, relay) => {
          received[relay].push(event);
        },
      );

      const ev1 = await createSignedEvent(
        createTextNote("from1", keys.privateKey),
        keys.privateKey,
      );
      const ev2 = await createSignedEvent(
        createTextNote("from2", keys.privateKey),
        keys.privateKey,
      );

      await Promise.all(pool.publish([relay1.url], ev1));
      await Promise.all(pool.publish([relay2.url], ev2));

      // Wait for events to be received from both relays
      await waitForBoth();
      sub.close();

      expect(received[relay1.url].length).toBeGreaterThan(0);
      expect(received[relay2.url].length).toBeGreaterThan(0);
    } finally {
      await pool.close();
    }
  });

  test("should query events synchronously from multiple relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      // Publish some test events
      const event1 = await createSignedEvent(
        createTextNote("query test 1", keys.privateKey),
        keys.privateKey,
      );
      const event2 = await createSignedEvent(
        createTextNote("query test 2", keys.privateKey),
        keys.privateKey,
      );

      const publishResults = await Promise.all([
        ...pool.publish([relay1.url], event1),
        ...pool.publish([relay2.url], event2),
      ]);

      // Verify all publishes succeeded before querying
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Query events - querySync waits for EOSE internally
      const events = await pool.querySync(
        [relay1.url, relay2.url],
        { kinds: [1], authors: [keys.publicKey] },
        { timeout: 2000 },
      );

      expect(events.length).toBeGreaterThan(0);
      expect(
        events.some(
          (e) => e.content === "query test 1" || e.content === "query test 2",
        ),
      ).toBe(true);
    } finally {
      await pool.close();
    }
  });

  test("should get the most recent event from relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      // Publish a test event
      const testEvent = await createSignedEvent(
        createTextNote("get test", keys.privateKey),
        keys.privateKey,
      );
      const publishResults = await Promise.all(
        pool.publish([relay1.url, relay2.url], testEvent),
      );

      // Verify all publishes succeeded
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Get the most recent event - pool.get internally uses querySync which waits for EOSE
      const event = await pool.get(
        [relay1.url, relay2.url],
        { kinds: [1], authors: [keys.publicKey] },
        { timeout: 2000 },
      );

      expect(event).not.toBeNull();
      expect(event?.content).toBe("get test");
      expect(event?.pubkey).toBe(keys.publicKey);
    } finally {
      await pool.close();
    }
  });

  test("should handle timeout in querySync", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);

    try {
      // Query with very short timeout
      const events = await pool.querySync(
        [relay1.url, relay2.url],
        { kinds: [1], limit: 10 },
        { timeout: 1 }, // 1ms timeout
      );

      // Should complete quickly due to timeout
      expect(Array.isArray(events)).toBe(true);
    } finally {
      await pool.close();
    }
  });

  test("should return null when no events found in get", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      const event = await pool.get(
        [relay1.url, relay2.url],
        {
          kinds: [1],
          authors: [keys.publicKey],
          since: Math.floor(Date.now() / 1000) + 3600,
        }, // Future timestamp
        { timeout: 1000 },
      );

      expect(event).toBeNull();
    } finally {
      await pool.close();
    }
  });

  test("should handle partial relay failures gracefully", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    // Subscribe to mix of working and non-working relays
    const badRelayUrl = "ws://localhost:9999"; // Non-existent relay
    const received: NostrEvent[] = [];

    // Use a more recent timestamp to avoid picking up events from previous tests
    const testTimestamp = Math.floor(Date.now() / 1000);

    try {
      const sub = await pool.subscribe(
        [relay1.url, badRelayUrl, relay2.url],
        [{ kinds: [1], since: testTimestamp, authors: [keys.publicKey] }],
        (event) => {
          received.push(event);
        },
      );

      // Update the subscription callback to check for our event
      const originalCallback = (event: NostrEvent) => {
        received.push(event);
      };

      // Re-create subscription with updated callback
      sub.close();
      const newSub = await pool.subscribe(
        [relay1.url, badRelayUrl, relay2.url],
        [{ kinds: [1], since: testTimestamp, authors: [keys.publicKey] }],
        originalCallback,
      );

      // Publish events to working relays
      const testEvent = await createSignedEvent(
        createTextNote("partial failure test", keys.privateKey),
        keys.privateKey,
      );
      const publishResults = await Promise.all(
        pool.publish([relay1.url, relay2.url], testEvent),
      );

      // Verify publishes succeeded
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Wait for the specific event to be received from at least one relay
      await testUtils.waitFor(
        () => received.some((e) => e.content === "partial failure test"),
        2000,
        10,
      );

      newSub.close();

      // Should still receive events from working relays despite one relay failing
      expect(received.length).toBeGreaterThan(0);
      expect(received.some((e) => e.content === "partial failure test")).toBe(
        true,
      );
    } finally {
      await pool.close();
    }
  });

  test("should immediately close subscriptions without waiting", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    const received: NostrEvent[] = [];

    try {
      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1] }],
        (event) => {
          received.push(event);
        },
      );

      // Close immediately after subscribing
      const startTime = Date.now();
      sub.close();
      const closeTime = Date.now() - startTime;

      // Close should be immediate (< 50ms)
      expect(closeTime).toBeLessThan(50);

      // Verify no events are processed after close
      const testEvent = await createSignedEvent(
        createTextNote("after close test", keys.privateKey),
        keys.privateKey,
      );
      const publishResults = await Promise.all(
        pool.publish([relay1.url, relay2.url], testEvent),
      );

      // Verify publishes succeeded (but events should not be received due to closed subscription)
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Give a small amount of time to ensure no events leak through
      // This is testing that events DON'T arrive, so we need a small delay
      await testUtils.sleep(100);

      // Should not receive the event published after close
      const afterCloseEvents = received.filter(
        (e) => e.content === "after close test",
      );
      expect(afterCloseEvents).toHaveLength(0);
    } finally {
      await pool.close();
    }
  });

  test("should handle event processing errors gracefully", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    const received: NostrEvent[] = [];
    const errors: Error[] = [];

    // Use a timestamp to filter only our test events
    const testTimestamp = Math.floor(Date.now() / 1000);

    // Mock console.warn to capture error logs
    const originalWarn = console.warn;

    try {
      console.warn = (...args: unknown[]) => {
        // Call original to preserve output
        originalWarn(...args);

        if (
          args[0] &&
          typeof args[0] === "string" &&
          args[0].includes("Error processing event from")
        ) {
          errors.push(new Error(args[0]));
        }
      };

      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1], since: testTimestamp, authors: [keys.publicKey] }],
        (event) => {
          // Only process events from our test
          if (
            event.pubkey === keys.publicKey &&
            (event.content === "normal event" ||
              event.content === "error event")
          ) {
            received.push(event);
            // Throw error on specific event to test error handling
            if (event.content === "error event") {
              throw new Error("Test event processing error");
            }
          }
        },
      );

      // Publish normal event and error-triggering event
      const normalEvent = await createSignedEvent(
        createTextNote("normal event", keys.privateKey),
        keys.privateKey,
      );
      const errorEvent = await createSignedEvent(
        createTextNote("error event", keys.privateKey),
        keys.privateKey,
      );

      // Update the check function whenever an event is received
      const originalOnEvent = (event: NostrEvent) => {
        // Only process our test events
        if (
          event.pubkey === keys.publicKey &&
          (event.content === "normal event" || event.content === "error event")
        ) {
          received.push(event);

          // Throw error after recording - don't catch it here so RelayPool can handle it
          if (event.content === "error event") {
            throw new Error("Test event processing error");
          }
        }
      };

      // Re-create subscription with the callback that checks for completion
      sub.close();
      const newSub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1], since: testTimestamp, authors: [keys.publicKey] }],
        originalOnEvent,
      );

      const publishResults = await Promise.all([
        ...pool.publish([relay1.url], normalEvent),
        ...pool.publish([relay2.url], errorEvent),
      ]);

      // Verify publishes succeeded
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Wait until both events have been received
      await testUtils.waitFor(
        () =>
          received.some((e) => e.content === "normal event") &&
          received.some((e) => e.content === "error event"),
        2000,
        10,
      );

      // Give a little extra time for error logging
      await testUtils.sleep(100);

      newSub.close();

      // Should have received both events even though one caused an error
      expect(received.length).toBe(2);
      expect(received.some((e) => e.content === "normal event")).toBe(true);
      expect(received.some((e) => e.content === "error event")).toBe(true);

      // Should have logged the error
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      // Restore console.warn
      console.warn = originalWarn;
      await pool.close();
    }
  });

  test("should handle multiple close calls safely", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);

    try {
      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1] }],
        () => {},
      );

      // Multiple close calls should not cause errors
      expect(() => {
        sub.close();
        sub.close();
        sub.close();
      }).not.toThrow();
    } finally {
      await pool.close();
    }
  });

  test("should work with only invalid relays", async () => {
    const pool = new RelayPool();

    try {
      // Subscribe to only non-existent relays
      const sub = await pool.subscribe(
        ["ws://localhost:9999", "ws://localhost:9998"],
        [{ kinds: [1] }],
        () => {},
        () => {
          // EOSE should not be called since no relays succeeded
        },
      );

      // Give the subscription a moment to attempt connections to invalid relays
      // This ensures any connection errors would have been thrown by now
      await testUtils.sleep(100);

      // Should be able to close without throwing errors
      expect(() => sub.close()).not.toThrow();
    } finally {
      await pool.close();
    }
  });

  test("should handle async pool close properly", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      // Create a subscription to ensure relays are connected
      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1] }],
        () => {},
      );

      // Publish an event to ensure connections are active
      const testEvent = await createSignedEvent(
        createTextNote("close test", keys.privateKey),
        keys.privateKey,
      );
      await Promise.all(pool.publish([relay1.url, relay2.url], testEvent));

      // Close the subscription first
      sub.close();

      // Test that pool.close() is async and completes properly
      await pool.close();

      // Verify that calling close again doesn't throw errors
      await expect(pool.close()).resolves.toBeUndefined();
    } catch (error) {
      // If something goes wrong in the try block, still attempt cleanup
      await pool.close();
      throw error;
    }
  });

  test("should prevent duplicate onEOSE calls", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();
    let eoseCallCount = 0;

    try {
      // First publish an event so the relays have something to send
      const testEvent = await createSignedEvent(
        createTextNote("eose test", keys.privateKey),
        keys.privateKey,
      );
      const publishResults = await Promise.all(
        pool.publish([relay1.url, relay2.url], testEvent),
      );

      // Verify publishes succeeded
      publishResults.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Create promise that resolves when EOSE is called
      let resolveEose: () => void;
      const eoseReceived = new Promise<void>((resolve) => {
        resolveEose = resolve;
      });

      // Create a subscription that should trigger EOSE after processing events
      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1], authors: [keys.publicKey] }],
        () => {},
        () => {
          eoseCallCount++;
          if (eoseCallCount === 1) {
            resolveEose();
          }
        },
      );

      // Wait for EOSE to be called
      await eoseReceived;

      // Close the subscription
      sub.close();

      // Give a small delay to ensure no duplicate EOSE calls
      await testUtils.sleep(100);

      // Verify that onEOSE was called exactly once, not multiple times
      // The eoseSent flag should prevent any duplicate calls
      expect(eoseCallCount).toBe(1);
    } finally {
      await pool.close();
    }
  });
});
