/**
 * Relay Pool Example
 *
 * This example demonstrates managing multiple relay connections using the
 * RelayPool class. The pool simplifies publishing events to many relays and
 * subscribing across them.
 *
 * Key concepts:
 * - Creating a RelayPool with multiple relays
 * - Publishing an event to all relays
 * - Subscribing to events from every relay in the pool
 *
 * How to run:
 * npm run example:nip01:relay:pool
 */

import { RelayPool } from "../../../src";
import { createTextNote, createSignedEvent } from "../../../src/nip01/event";
import { generateKeypair } from "../../../src/utils/crypto";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import type { NostrEvent } from "../../../src/types/nostr";

const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORTS = [3351, 3352];

async function main() {
  const relayUrls: string[] = [];
  const ephemeralRelays: NostrRelay[] = [];

  if (USE_EPHEMERAL) {
    for (const port of RELAY_PORTS) {
      const relay = new NostrRelay(port);
      await relay.start();
      ephemeralRelays.push(relay);
      relayUrls.push(relay.url);
    }
    console.log(`Ephemeral relays running at ${relayUrls.join(", ")}`);
  } else {
    relayUrls.push("wss://relay.primal.net", "wss://relay.nostr.band");
  }

  const pool = new RelayPool(relayUrls);
  const keys = await generateKeypair();
  const unsigned = createTextNote("Hello from RelayPool", keys.privateKey);
  const event = await createSignedEvent(unsigned, keys.privateKey);

  console.log("Publishing event to relays...");
  await Promise.all(pool.publish(relayUrls, event));

  console.log("Subscribing for recent text notes...");
  const received: Record<string, NostrEvent[]> = {};

  const sub = await pool.subscribe(
    relayUrls,
    [{ kinds: [1], since: event.created_at - 60 }],
    (ev, relay) => {
      received[relay] = received[relay] || [];
      received[relay].push(ev);
      console.log(`Received from ${relay}: ${ev.content}`);
    },
    () => {
      console.log("EOSE from all relays");
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));
  sub.close();

  if (USE_EPHEMERAL) {
    ephemeralRelays.forEach((r) => r.close());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
