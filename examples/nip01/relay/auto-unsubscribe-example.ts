/**
 * Subscription Auto Close Example
 *
 * This example demonstrates how to automatically unsubscribe from a relay
 * when the relay signals End Of Stored Events (EOSE) or after a timeout.
 *
 * Key concepts:
 * - Using the `autoClose` option when creating a subscription
 * - Configuring an optional `eoseTimeout` to avoid hanging subscriptions
 *
 * How to run:
 * npm run example:nip01:relay:auto-close
 */

import { Relay } from "../../../src/nip01/relay";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import type { NostrEvent } from "../../../src/types/nostr";

async function main() {
  // Use port 0 to let the OS assign an available ephemeral port
  const ephemeralRelay = new NostrRelay(0);
  await ephemeralRelay.start();
  console.log(`Ephemeral relay running at ${ephemeralRelay.url}`);

  const relay = new Relay(ephemeralRelay.url);
  await relay.connect();

  const subId = relay.subscribe(
    [{ kinds: [1], limit: 1 }],
    (event: NostrEvent) => {
      console.log("Received event", event.id);
    },
    () => {
      console.log("EOSE received, subscription will close");
    },
    { autoClose: true, eoseTimeout: 5000 }
  );

  console.log(`Subscription created with id ${subId}`);

  // publish a simple event so the relay sends EOSE
  await relay.publish({
    id: "0".repeat(64),
    pubkey: "0".repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: "test",
    sig: "0".repeat(128),
  });

  // Wait longer than eoseTimeout (5000ms) to ensure auto-close has triggered
  // if EOSE was not emitted. This demonstrates the timeout fallback behavior.
  await new Promise((r) => setTimeout(r, 5500));

  console.log(
    `Subscription active: ${relay.getSubscriptionIds().has(subId)}`
  );
  
  // The subscription should be closed at this point either due to:
  // 1. EOSE being received (immediate closure), or 
  // 2. eoseTimeout expiring after 5000ms (fallback closure)

  // Ensure relay fully disconnects before closing ephemeral relay to prevent race conditions
  await relay.disconnect();
  await ephemeralRelay.close();
}

main().catch((err) => {
  console.error("Example failed", err);
  process.exit(1);
});
