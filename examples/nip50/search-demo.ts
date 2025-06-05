import { Nostr } from "../../src/nip01/nostr";
import { generateKeypair } from "../../src/utils/crypto";
import { createSignedEvent } from "../../src/nip01/event";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { createSearchFilter } from "../../src/nip50";

async function main() {
  const relay = new NostrRelay(4080);
  await relay.start();
  console.log(`Ephemeral relay running at ${relay.url}`);

  const client = new Nostr([relay.url]);
  await client.connectToRelays();

  const keys = await generateKeypair();
  client.setPrivateKey(keys.privateKey);

  const note1 = await createSignedEvent(
    {
      pubkey: keys.publicKey,
      kind: 1,
      content: "I love building nostr apps!",
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    },
    keys.privateKey,
  );

  const note2 = await createSignedEvent(
    {
      pubkey: keys.publicKey,
      kind: 1,
      content: "Another event about something else",
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    },
    keys.privateKey,
  );

  await client.publishEvent(note1);
  await client.publishEvent(note2);

  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log("Searching for 'nostr'");
  await new Promise<void>((resolve) => {
    const subId = client.subscribe(
      [createSearchFilter("nostr")],
      (event) => console.log("Found", event.content),
      () => {
        client.unsubscribe(subId);
        resolve();
      },
    );
  });

  client.disconnectFromRelays();
  await relay.close();
}

main().catch((e) => console.error(e));
