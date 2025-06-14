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

  console.log("\nDemonstrating error handling with mixed relay availability...");
  const receivedWithErrors: Record<string, NostrEvent[]> = {};
  let eoseWithErrorsReceived = false;

  // Create a promise that resolves when EOSE callback fires
  let eoseCallbackResolver: (() => void) | null = null;
  const eoseCallbackPromise = new Promise<void>((resolve) => {
    eoseCallbackResolver = resolve;
  });

  // Add a non-existent relay to test error handling
  const mixedRelays = [...relayUrls, "ws://localhost:9999"];
  
  const errorSub = await pool.subscribe(
    mixedRelays,
    [{ kinds: [1], since: event.created_at - 60 }],
    (ev, relay) => {
      receivedWithErrors[relay] = receivedWithErrors[relay] || [];
      receivedWithErrors[relay].push(ev);
      console.log(`Received from ${relay}: ${ev.content}`);
    },
    () => {
      eoseWithErrorsReceived = true;
      console.log("EOSE from available relays (some relays failed)");
      // Resolve the promise to signal EOSE callback completion
      if (eoseCallbackResolver) {
        eoseCallbackResolver();
      }
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 500));
  
  console.log("Testing immediate close capability...");
  const immediateCloseStart = Date.now();
  errorSub.close();
  const immediateCloseTime = Date.now() - immediateCloseStart;
  console.log(`Subscription closed immediately in ${immediateCloseTime}ms`);

  // Wait for EOSE callback to complete before reading the flag
  await Promise.race([
    eoseCallbackPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 100)) // Timeout fallback
  ]);

  // Demonstrate that the subscription continues to work despite some relay failures
  if (eoseWithErrorsReceived) {
    const workingRelayCount = Object.keys(receivedWithErrors).length;
    console.log(`Successfully subscribed to ${workingRelayCount} out of ${mixedRelays.length} relays`);
  } else {
    console.log("EOSE callback did not complete within timeout");
  }

  console.log("\nDemonstrating querySync - fetching recent events...");
  const recentEvents = await pool.querySync(
    relayUrls,
    { kinds: [1], since: Math.floor(Date.now() / 1000) - 300 }, // Last 5 minutes
    { timeout: 2000 }
  );
  console.log(`Found ${recentEvents.length} recent events via querySync`);

  console.log("\nDemonstrating get - fetching most recent event...");
  const latestEvent = await pool.get(
    relayUrls,
    { kinds: [1] },
    { timeout: 2000 }
  );
  if (latestEvent) {
    console.log(`Most recent event: "${latestEvent.content}" (${new Date(latestEvent.created_at * 1000).toISOString()})`);
  } else {
    console.log("No events found");
  }

  // Close relay pool connections before shutting down ephemeral relays
  console.log("\nClosing relay pool connections...");
  pool.close();

  if (USE_EPHEMERAL) {
    // Give a moment for connections to close gracefully
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("Shutting down ephemeral relays...");
    ephemeralRelays.forEach((r) => r.close());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
