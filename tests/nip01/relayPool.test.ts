import { RelayPool, NostrEvent } from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../src/utils/crypto";
import { createTextNote, createSignedEvent } from "../../src/nip01/event";

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
});
