import { Nostr } from "../../../src/nip01/nostr";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

/**
 * Relay Query Example
 *
 * Demonstrates use of fetchMany and fetchOne helper methods to
 * retrieve events across multiple relays.
 *
 * Key concepts:
 * - fetchMany collects all matching events
 * - fetchOne returns the newest event
 *
 * How to run:
 * npm run example:nip01:relay:query
 */
async function main() {
  const relayA = new NostrRelay(3801);
  const relayB = new NostrRelay(3802);
  await relayA.start();
  await relayB.start();

  const client = new Nostr([relayA.url, relayB.url]);
  await client.generateKeys();
  await client.connectToRelays();

  console.log("Publishing sample events...");
  await client.publishTextNote("first note");
  await new Promise((r) => setTimeout(r, 1000));
  await client.publishTextNote("second note");

  // wait for relays to store events
  await new Promise((r) => setTimeout(r, 200));

  console.log("Fetching all events using fetchMany...");
  const events = await client.fetchMany([{ kinds: [1] }], { maxWait: 500 });
  console.log(`Received ${events.length} events`);

  console.log("Fetching newest event using fetchOne...");
  const latest = await client.fetchOne([{ kinds: [1] }], { maxWait: 500 });
  if (latest) {
    console.log(`Latest note: ${latest.content}`);
  }

  client.disconnectFromRelays();
  await relayA.close();
  await relayB.close();
}

main().catch((err) => {
  console.error(err);
});
