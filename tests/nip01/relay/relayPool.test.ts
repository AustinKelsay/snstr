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

    const results = await Promise.all(pool.publish([relay1.url, relay2.url], event));
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.success).toBe(true));
  });

  test("should subscribe and receive events from all relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    const received: Record<string, NostrEvent[]> = {
      [relay1.url]: [],
      [relay2.url]: [],
    };

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
  });

  test("should query events synchronously from multiple relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

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
  });

  test("should get the most recent event from relays", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

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
  });

  test("should handle timeout in querySync", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    
    // Query with very short timeout
    const events = await pool.querySync(
      [relay1.url, relay2.url],
      { kinds: [1], limit: 10 },
      { timeout: 1 } // 1ms timeout
    );

    // Should complete quickly due to timeout
    expect(Array.isArray(events)).toBe(true);
  });

  test("should return null when no events found in get", async () => {
    const pool = new RelayPool([relay1.url, relay2.url]);
    const keys = await generateKeypair();

    const event = await pool.get(
      [relay1.url, relay2.url],
      { kinds: [1], authors: [keys.publicKey], since: Math.floor(Date.now() / 1000) + 3600 }, // Future timestamp
      { timeout: 1000 }
    );

    expect(event).toBeNull();
  });
});
