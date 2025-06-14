import { RelayPool, NostrEvent } from "../../../src";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../../src/utils/crypto";
import { createTextNote, createSignedEvent } from "../../../src/nip01/event";

const PORT1 = 4501;
const PORT2 = 4502;

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
      const results = await Promise.all(pool.publish([relay1.url, relay2.url], event));
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.success).toBe(true));
    } finally {
      pool.close();
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
      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1] }],
        (event, relay) => {
          received[relay].push(event);
        },
      );

      const ev1 = await createSignedEvent(createTextNote("from1", keys.privateKey), keys.privateKey);
      const ev2 = await createSignedEvent(createTextNote("from2", keys.privateKey), keys.privateKey);

      await Promise.all(pool.publish([relay1.url], ev1));
      await Promise.all(pool.publish([relay2.url], ev2));

      await new Promise((resolve) => setTimeout(resolve, 100));
      sub.close();

      expect(received[relay1.url].length).toBeGreaterThan(0);
      expect(received[relay2.url].length).toBeGreaterThan(0);
    } finally {
      pool.close();
    }
  });

  test("should query events synchronously from multiple relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      // Publish some test events
      const event1 = await createSignedEvent(createTextNote("query test 1", keys.privateKey), keys.privateKey);
      const event2 = await createSignedEvent(createTextNote("query test 2", keys.privateKey), keys.privateKey);

      await Promise.all(pool.publish([relay1.url], event1));
      await Promise.all(pool.publish([relay2.url], event2));

      // Wait for events to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Query events
      const events = await pool.querySync(
        [relay1.url, relay2.url],
        { kinds: [1], authors: [keys.publicKey] },
        { timeout: 2000 }
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.content === "query test 1" || e.content === "query test 2")).toBe(true);
    } finally {
      pool.close();
    }
  });

  test("should get the most recent event from relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      // Publish a test event
      const testEvent = await createSignedEvent(createTextNote("get test", keys.privateKey), keys.privateKey);
      await Promise.all(pool.publish([relay1.url, relay2.url], testEvent));

      // Wait for event to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the most recent event
      const event = await pool.get(
        [relay1.url, relay2.url],
        { kinds: [1], authors: [keys.publicKey] },
        { timeout: 2000 }
      );

      expect(event).not.toBeNull();
      expect(event?.content).toBe("get test");
      expect(event?.pubkey).toBe(keys.publicKey);
    } finally {
      pool.close();
    }
  });

  test("should handle timeout in querySync", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    
    try {
      // Query with very short timeout
      const events = await pool.querySync(
        [relay1.url, relay2.url],
        { kinds: [1], limit: 10 },
        { timeout: 1 } // 1ms timeout
      );

      // Should complete quickly due to timeout
      expect(Array.isArray(events)).toBe(true);
    } finally {
      pool.close();
    }
  });

  test("should return null when no events found in get", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    try {
      const event = await pool.get(
        [relay1.url, relay2.url],
        { kinds: [1], authors: [keys.publicKey], since: Math.floor(Date.now() / 1000) + 3600 }, // Future timestamp
        { timeout: 1000 }
      );

      expect(event).toBeNull();
    } finally {
      pool.close();
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

      // Wait a bit for subscription to establish and handle failures
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Publish events to working relays
      const testEvent = await createSignedEvent(createTextNote("partial failure test", keys.privateKey), keys.privateKey);
      await Promise.all(pool.publish([relay1.url, relay2.url], testEvent));

      // Wait for events to be received
      await new Promise((resolve) => setTimeout(resolve, 300));
      sub.close();

      // Should still receive events from working relays despite one relay failing
      expect(received.length).toBeGreaterThan(0);
      expect(received.some(e => e.content === "partial failure test")).toBe(true);
    } finally {
      pool.close();
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
      const testEvent = await createSignedEvent(createTextNote("after close test", keys.privateKey), keys.privateKey);
      await Promise.all(pool.publish([relay1.url, relay2.url], testEvent));
      
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Should not receive the event published after close
      const afterCloseEvents = received.filter(e => e.content === "after close test");
      expect(afterCloseEvents).toHaveLength(0);
    } finally {
      pool.close();
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
        if (args[0] && typeof args[0] === 'string' && args[0].includes('Error processing event')) {
          errors.push(new Error(args[0]));
        }
      };

      const sub = await pool.subscribe(
        [relay1.url, relay2.url],
        [{ kinds: [1], since: testTimestamp, authors: [keys.publicKey] }],
        (event) => {
          // Only process events from our test
          if (event.pubkey === keys.publicKey && 
              (event.content === "normal event" || event.content === "error event")) {
            received.push(event);
            // Throw error on specific event to test error handling
            if (event.content === "error event") {
              throw new Error("Test event processing error");
            }
          }
        },
      );

      // Publish normal event and error-triggering event
      const normalEvent = await createSignedEvent(createTextNote("normal event", keys.privateKey), keys.privateKey);
      const errorEvent = await createSignedEvent(createTextNote("error event", keys.privateKey), keys.privateKey);

      await Promise.all(pool.publish([relay1.url], normalEvent));
      await Promise.all(pool.publish([relay2.url], errorEvent));

      await new Promise((resolve) => setTimeout(resolve, 200));
      sub.close();

      // Should have received both events even though one caused an error
      expect(received.length).toBe(2);
      expect(received.some(e => e.content === "normal event")).toBe(true);
      expect(received.some(e => e.content === "error event")).toBe(true);
      
      // Should have logged the error
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      // Restore console.warn
      console.warn = originalWarn;
      pool.close();
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
      pool.close();
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

      // Should complete without throwing errors
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      expect(() => sub.close()).not.toThrow();
    } finally {
      pool.close();
    }
  });


});
