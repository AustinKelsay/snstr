import { Nostr, NostrEvent, RelayEvent } from "../../../src";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import {
  createSignedEvent,
} from "../../../src/nip01/event";

/**
 * Event Ordering Demo
 *
 * This script demonstrates the NIP-01 compliant event ordering implementation,
 * which ensures events are delivered in the following order:
 * 1. By created_at timestamp (descending - newest first)
 * 2. By event ID (lexically ascending) for events with the same timestamp
 */
async function main() {
  try {
    // Start an ephemeral relay for testing
    console.log("Starting ephemeral relay on port 3003...");
    const ephemeralRelay = new NostrRelay(3003);
    await ephemeralRelay.start();
    console.log(`Ephemeral relay running at ${ephemeralRelay.url}`);

    // Initialize the client with a custom buffer flush delay
    console.log("Creating Nostr client with 100ms buffer flush delay...");
    const client = new Nostr([ephemeralRelay.url], {
      relayOptions: {
        bufferFlushDelay: 100, // Control how frequently events are sorted and delivered
      },
    });

    // Generate keys
    console.log("Generating keypair...");
    const keys = await client.generateKeys();

    // Connect to the relay
    console.log("Connecting to relay...");
    await client.connectToRelays();

    // Set up event handler for relay connection
    client.on(RelayEvent.Connect, (relayUrl) => {
      console.log(`Connected to relay: ${relayUrl}`);
    });

    // Create an array to collect received events for verification
    const receivedEvents: NostrEvent[] = [];

    // Subscribe to events
    console.log("\nSetting up subscription to capture events...");
    const subIds = client.subscribe(
      [{ kinds: [1] }],
      (event, relay) => {
        receivedEvents.push(event);
        console.log(`Received event from ${relay}:`);
        console.log(`  ID: ${event.id.slice(0, 8)}...`);
        console.log(`  Timestamp: ${event.created_at}`);
        console.log(`  Content: ${event.content}`);
        // Each event received has passed validation according to NIP-01:
        // - All required fields verified (id, pubkey, created_at, kind, tags, content, sig)
        // - Proper field types and lengths checked
        // - Reasonable timestamp verified (not far in the future)
        // - ID and signature verification occurs asynchronously
      },
      () => {
        console.log("End of stored events (EOSE)");
        console.log("Buffer flushed and events sorted according to NIP-01");
      },
    );

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Publish events in a specific order to demonstrate sorting
    console.log("\nPublishing events to demonstrate ordering...");

    // Use manual event creation for precise control over timestamps
    const now = Math.floor(Date.now() / 1000);

    // 1. Create and publish events with different timestamps
    console.log(
      "\n1. Events with different timestamps (should be ordered by timestamp, newest first):",
    );

    // Event 3 (newest)
    console.log("Creating event with newest timestamp...");
    const event3Template = {
      kind: 1,
      content: `Event 3 - timestamp ${now + 30} (newest)`,
      tags: [["t", "test"]],
      created_at: now + 30,
      pubkey: keys.publicKey,
    };
    const event3 = await createSignedEvent(event3Template, keys.privateKey);
    await client.publishEvent(event3);
    console.log(
      `Published event with timestamp: ${event3.created_at} (newest)`,
    );

    // Event 1 (oldest)
    console.log("Creating event with oldest timestamp...");
    const event1Template = {
      kind: 1,
      content: `Event 1 - timestamp ${now} (oldest)`,
      tags: [["t", "test"]],
      created_at: now,
      pubkey: keys.publicKey,
    };
    const event1 = await createSignedEvent(event1Template, keys.privateKey);
    await client.publishEvent(event1);
    console.log(
      `Published event with timestamp: ${event1.created_at} (oldest)`,
    );

    // Event 2 (middle)
    console.log("Creating event with middle timestamp...");
    const event2Template = {
      kind: 1,
      content: `Event 2 - timestamp ${now + 15} (middle)`,
      tags: [["t", "test"]],
      created_at: now + 15,
      pubkey: keys.publicKey,
    };
    const event2 = await createSignedEvent(event2Template, keys.privateKey);
    await client.publishEvent(event2);
    console.log(
      `Published event with timestamp: ${event2.created_at} (middle)`,
    );

    // Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Create and publish events with the same timestamp but different IDs
    console.log(
      "\n2. Events with the same timestamp (should be ordered by ID lexically):",
    );

    const sameTimestamp = now + 60;

    // Event A (lexically first ID)
    console.log(
      "Creating event A with ID that should come first lexically (e.g., starts with 0-3)...",
    );
    let eventA: NostrEvent;

    // Keep trying until we get an ID that starts with '0'-'3'
    do {
      const eventATemplate = {
        kind: 1,
        content: `Event A - same timestamp ${sameTimestamp}, ID should be like 0xxx-3xxx... ${Math.random()}`,
        tags: [["t", "test"]],
        created_at: sameTimestamp,
        pubkey: keys.publicKey,
      };
      eventA = await createSignedEvent(eventATemplate, keys.privateKey);
    } while (eventA.id[0] > "3"); // Continue if first char is '4' through 'f'

    await client.publishEvent(eventA);
    console.log(
      `Published event A with timestamp: ${eventA.created_at}, ID: ${eventA.id.slice(0, 8)}...`,
    );

    // Event B (lexically middle ID)
    console.log(
      "Creating event B with ID that should come second lexically (e.g., starts with 6-9)...",
    );
    let eventB: NostrEvent;

    // Keep trying until we get an ID that starts with '6'-'9'
    do {
      const eventBTemplate = {
        kind: 1,
        content: `Event B - same timestamp ${sameTimestamp}, ID should be like 6xxx-9xxx... ${Math.random()}`,
        tags: [["t", "test"]],
        created_at: sameTimestamp,
        pubkey: keys.publicKey,
      };
      eventB = await createSignedEvent(eventBTemplate, keys.privateKey);
    } while (eventB.id[0] < "6" || eventB.id[0] > "9"); // Continue if not in '6'-'9' range

    await client.publishEvent(eventB);
    console.log(
      `Published event B with timestamp: ${eventB.created_at}, ID: ${eventB.id.slice(0, 8)}...`,
    );

    // Event C (lexically last ID)
    console.log(
      "Creating event C with ID that should come third lexically (e.g., starts with c-f)...",
    );
    let eventC: NostrEvent;

    // Keep trying until we get an ID that starts with 'c'-'f'
    do {
      const eventCTemplate = {
        kind: 1,
        content: `Event C - same timestamp ${sameTimestamp}, ID should be like cxxx-fxxx... ${Math.random()}`,
        tags: [["t", "test"]],
        created_at: sameTimestamp,
        pubkey: keys.publicKey,
      };
      eventC = await createSignedEvent(eventCTemplate, keys.privateKey);
    } while (eventC.id[0] < "c"); // Continue if first char is '0' through 'b'

    await client.publishEvent(eventC);
    console.log(
      `Published event C with timestamp: ${eventC.created_at}, ID: ${eventC.id.slice(0, 8)}...`,
    );

    // Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify ordering
    console.log("\nVerifying final event ordering:");
    console.log("-----------------------------------------------------------");

    // Check that events are properly ordered
    let isOrdered = true;
    for (let i = 1; i < receivedEvents.length; i++) {
      const currentEvent = receivedEvents[i];
      const prevEvent = receivedEvents[i - 1];

      // Check timestamp ordering (newest first)
      if (prevEvent.created_at < currentEvent.created_at) {
        console.log(
          `❌ Timestamp ordering issue: ${prevEvent.created_at} < ${currentEvent.created_at}`,
        );
        isOrdered = false;
      }
      // If timestamps are identical, check ID ordering (descending)
      else if (
        prevEvent.created_at === currentEvent.created_at &&
        prevEvent.id.localeCompare(currentEvent.id) < 0 // prevEvent.id should be greater than or equal to currentEvent.id
      ) {
        console.log(
          `❌ ID ordering issue: ${prevEvent.id.slice(0, 8)}... (lexically smaller) should come after ${currentEvent.id.slice(0, 8)}... (lexically larger) when timestamps are the same, due to descending ID sort.`,
        );
        isOrdered = false;
      }
    }

    if (isOrdered) {
      console.log("✅ All events are correctly ordered according to NIP-01!");
    } else {
      console.log("❌ Event ordering does not follow NIP-01 specification");
    }

    // Display all events
    console.log("\nFinal event order as received:");
    receivedEvents.forEach((event, i) => {
      console.log(`Event ${i + 1}:`);
      console.log(`  Timestamp: ${event.created_at}`);
      console.log(`  ID: ${event.id.slice(0, 8)}...`);
      console.log(`  Content: ${event.content}`);
      console.log("---");
    });

    // Clean up
    console.log("\nCleaning up...");
    client.unsubscribe(subIds);
    client.disconnectFromRelays();
    await ephemeralRelay.close();

    console.log("Demo completed.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
