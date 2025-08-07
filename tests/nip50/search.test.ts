import { Nostr } from "../../src/nip01/nostr";
import { createSignedEvent } from "../../src/nip01/event";
import { generateKeypair } from "../../src/utils/crypto";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { createSearchFilter } from "../../src/nip50";
import { Filter, NostrEvent } from "../../src/types/nostr";

describe("NIP-50 Search Filter", () => {
  let relay: NostrRelay;
  let client: Nostr;
  let keys: { privateKey: string; publicKey: string };

  beforeAll(async () => {
    relay = new NostrRelay(0);
    await relay.start();

    client = new Nostr([relay.url]);
    await client.connectToRelays();

    keys = await generateKeypair();
    client.setPrivateKey(keys.privateKey);
  });

  afterAll(async () => {
    client.disconnectFromRelays();
    await relay.close();
  });

  test("search field should be usable in Filter type", () => {
    const filter: Filter = { search: "nostr" };
    expect(filter.search).toBe("nostr");
  });

  test("should return events matching search query", async () => {
    const event1 = await createSignedEvent(
      {
        pubkey: keys.publicKey,
        kind: 1,
        content: "hello nostr world",
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      },
      keys.privateKey,
    );

    const event2 = await createSignedEvent(
      {
        pubkey: keys.publicKey,
        kind: 1,
        content: "another note",
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      },
      keys.privateKey,
    );

    await client.publishEvent(event1);
    await client.publishEvent(event2);

    await new Promise((r) => setTimeout(r, 20));

    const events: NostrEvent[] = [];
    await new Promise<void>((resolve) => {
      const subId = client.subscribe(
        [createSearchFilter("nostr")],
        (ev) => events.push(ev),
        () => {
          client.unsubscribe(subId);
          resolve();
        },
      );
    });

    expect(events.length).toBe(1);
    expect(events[0].id).toBe(event1.id);
  });

  test("search should be case insensitive", async () => {
    const event = await createSignedEvent(
      {
        pubkey: keys.publicKey,
        kind: 1,
        content: "Case Insensitive Search", // Contains 'search'
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      },
      keys.privateKey,
    );

    await client.publishEvent(event);
    await new Promise((r) => setTimeout(r, 20));

    const events: NostrEvent[] = [];
    await new Promise<void>((resolve) => {
      const subId = client.subscribe(
        [createSearchFilter("search")],
        (ev) => events.push(ev),
        () => {
          client.unsubscribe(subId);
          resolve();
        },
      );
    });

    expect(events.some((e) => e.id === event.id)).toBe(true);
  });
});
