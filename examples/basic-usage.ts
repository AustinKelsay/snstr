import { Nostr, NostrEvent, Filter, RelayEvent } from "../src";
import { NostrRelay } from "../src/utils/ephemeral-relay";
import {
  createEvent,
  createSignedEvent,
  getEventHash,
  createTextNote,
  createDirectMessage,
} from "../src/nip01/event";
import { signEvent } from "../src/utils/crypto";

// Set this to false to use external relays instead of ephemeral relay
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== "false";

async function main() {
  try {
    let client: Nostr;
    let ephemeralRelay: NostrRelay | undefined;

    if (USE_EPHEMERAL) {
      // Use an ephemeral relay for testing
      console.log("Starting ephemeral relay on port 3001...");
      ephemeralRelay = new NostrRelay(3001);
      await ephemeralRelay.start();
      console.log(`Ephemeral relay running at ${ephemeralRelay.url}`);

      client = new Nostr([ephemeralRelay.url], {
        relayOptions: {
          connectionTimeout: 5000, // 5 second connection timeout
          bufferFlushDelay: 50, // 50ms buffer flush delay for event ordering
        },
      });
    } else {
      // Initialize Nostr client with public relays
      console.log("Using public relays: wss://relay.primal.net");
      client = new Nostr(["wss://relay.primal.net"], {
        relayOptions: {
          connectionTimeout: 5000, // 5 second connection timeout
          bufferFlushDelay: 50, // 50ms buffer flush delay for event ordering
        },
      });
      console.log("Connection timeout set to 5000ms");
      console.log("Event ordering buffer flush delay set to 50ms");
    }

    // Generate or set keys
    console.log("Generating keypair...");
    const keys = await client.generateKeys();
    console.log("Public key:", keys.publicKey);

    // Connect to relays
    console.log("Connecting to relays...");
    await client.connectToRelays();

    // Setup event handlers
    client.on(RelayEvent.Connect, (relayUrl) => {
      console.log(`Connected to relay: ${relayUrl}`);
    });

    client.on(RelayEvent.Disconnect, (relayUrl) => {
      console.log(`Disconnected from relay: ${relayUrl}`);
    });

    client.on(RelayEvent.Error, (relayUrl, error) => {
      console.error(`Error from relay ${relayUrl}:`, error);
    });

    client.on(RelayEvent.Notice, (relayUrl, notice) => {
      console.log(`Notice from relay ${relayUrl}: ${notice}`);
    });

    // New handler for OK messages from relays
    client.on(RelayEvent.OK, (eventId, success, message) => {
      if (success) {
        console.log(
          `Event ${eventId.slice(0, 8)}... was accepted by relay${message ? ": " + message : ""}`,
        );
      } else {
        console.warn(
          `Event ${eventId.slice(0, 8)}... was rejected by relay: ${message}`,
        );
      }
    });

    // New handler for CLOSED messages from relays
    client.on(RelayEvent.Closed, (subscriptionId, message) => {
      console.log(
        `Subscription ${subscriptionId} was closed by relay: ${message}`,
      );
    });

    // Subscribe to events
    console.log("Subscribing to events...");
    console.log(
      "Events will be ordered according to NIP-01: newest first, then by ID if timestamps match",
    );
    const filters: Filter[] = [
      {
        kinds: [1], // Text notes
        limit: 5,
      },
    ];

    const subscriptionIds = client.subscribe(
      filters,
      (event: NostrEvent, relayUrl: string) => {
        console.log(`Received event from ${relayUrl}:`);
        console.log(`  ID: ${event.id.slice(0, 8)}...`);
        console.log(`  Author: ${event.pubkey.slice(0, 8)}...`);
        console.log(
          `  Timestamp: ${new Date(event.created_at * 1000).toISOString()}`,
        );
        console.log(
          `  Content: ${event.content.length > 50 ? event.content.slice(0, 50) + "..." : event.content}`,
        );
        console.log("---");
      },
      () => {
        console.log(
          "End of stored events (EOSE) - buffer flushed and events sorted",
        );
      },
    );

    // Message content depends on which relay we're using
    const messageContent = USE_EPHEMERAL
      ? "Hello from SNSTR with ephemeral relay!"
      : "Hello from SNSTR with primal.net relay!";

    // Publish several notes with different timestamps to demonstrate ordering
    console.log("Publishing three notes to demonstrate event ordering...");

    // First note - with current timestamp
    const note1 = await client.publishTextNote(messageContent + " (1)");
    console.log(`Published note 1 with ID: ${note1?.id}`);

    // Short delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Second note - with current timestamp (newer)
    const note2 = await client.publishTextNote(messageContent + " (2)");
    console.log(`Published note 2 with ID: ${note2?.id}`);

    // Short delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Third note - with current timestamp (newest)
    const note3 = await client.publishTextNote(messageContent + " (3)");
    console.log(`Published note 3 with ID: ${note3?.id}`);

    console.log(
      "Notes should appear in reverse chronological order (3, 2, 1) due to proper event ordering",
    );

    // ---- Demonstrate the improved event serialization ----
    console.log("\n--- Demonstrating Secure Event Serialization ---");

    // Demo 1: Create events with special characters
    try {
      console.log("Creating event with special characters...");
      const specialContent =
        'Special chars: "quotes", \\backslashes\\, \nnewlines and emoji 🔥';
      const specialEvent = createEvent(
        { kind: 1, content: specialContent, tags: [["t", "test"]] },
        keys.publicKey,
      );

      const hash = await getEventHash(specialEvent);
      console.log(`Event hash: ${hash}`);

      const signedEvent = await createSignedEvent(
        specialEvent,
        keys.privateKey,
      );
      console.log(
        "Event successfully created and signed with special characters",
      );

      // Publish the event with special characters
      console.log("Publishing event with special characters...");
      const publishResult = await client.publishEvent(signedEvent);
      console.log(
        `Published special character event: ${publishResult.success ? "Success" : "Failed"}`,
      );
    } catch (error) {
      console.error("Error handling special characters:", error);
    }

    // Demo 2: Demonstrate deterministic hashing regardless of property order
    try {
      console.log("\nDemonstrating deterministic hashing...");

      // Create two events with the same data but different property ordering
      const timestamp = Math.floor(Date.now() / 1000);

      // Event 1: Standard property order
      const event1 = {
        pubkey: keys.publicKey,
        created_at: timestamp,
        kind: 1,
        tags: [["t", "deterministic"]],
        content: "Testing deterministic serialization",
      };

      // Event 2: Different property order
      const event2 = {
        content: "Testing deterministic serialization",
        kind: 1,
        pubkey: keys.publicKey,
        tags: [["t", "deterministic"]],
        created_at: timestamp,
      };

      // Hash both events
      const hash1 = await getEventHash(event1);
      const hash2 = await getEventHash(event2);

      console.log(`Hash 1: ${hash1}`);
      console.log(`Hash 2: ${hash2}`);
      console.log(`Hashes match: ${hash1 === hash2 ? "Yes ✅" : "No ❌"}`);

      if (hash1 === hash2) {
        console.log(
          "Event serialization is deterministic regardless of property order",
        );
      }
    } catch (error) {
      console.error("Error in deterministic hashing demo:", error);
    }

    // Demo 3: Demonstrate validation with intentionally malformed events
    console.log("\nDemonstrating event validation...");

    try {
      // Attempt to create an event with missing pubkey
      const invalidEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "This event is missing a pubkey",
      };

      // This should throw an error
      await getEventHash(invalidEvent as any);
      console.log("❌ Validation failed - should have rejected missing pubkey");
    } catch (error) {
      // This is expected
      console.log(
        `✅ Correctly rejected invalid event: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    try {
      // Attempt to create an event with invalid tags
      const invalidTagsEvent = {
        pubkey: keys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: "not-an-array",
        content: "This event has invalid tags",
      };

      // This should throw an error
      await getEventHash(invalidTagsEvent as any);
      console.log("❌ Validation failed - should have rejected invalid tags");
    } catch (error) {
      // This is expected
      console.log(
        `✅ Correctly rejected invalid tags: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    // NEW: Enhanced validation examples for comprehensive validation
    console.log("\nTesting NIP-01 compliant event validation:");

    // Test future timestamp validation
    try {
      const futureEvent = {
        pubkey: keys.publicKey,
        created_at: Math.floor(Date.now() / 1000) + 7200, // 2 hours in future
        kind: 1,
        tags: [],
        content: "This event has a future timestamp",
      };

      console.log(
        "Publishing event with future timestamp (should be rejected)...",
      );
      const publishResult = await client.publishEvent({
        ...futureEvent,
        id: "a".repeat(64), // Dummy ID
        sig: "b".repeat(128), // Dummy signature
      });

      if (!publishResult.success) {
        console.log(
          `✅ Correctly rejected event with future timestamp: ${
            publishResult.relayResults.size > 0
              ? Array.from(publishResult.relayResults.values())[0].reason
              : "validation failed"
          }`,
        );
      } else {
        console.log("❌ Event with future timestamp was unexpectedly accepted");
      }
    } catch (error) {
      console.log(
        `✅ Caught error for event with future timestamp: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    // Test incorrect ID validation
    try {
      // Create a valid event template
      const eventTemplate = {
        pubkey: keys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [["t", "validation"]],
        content: "This event will have an incorrect ID",
      };

      // Calculate the correct hash
      const correctId = await getEventHash(eventTemplate);

      // Create an event with a wrong ID
      const wrongIdEvent = {
        ...eventTemplate,
        id: "f".repeat(64), // Incorrect ID
      };

      // Sign the event with the wrong ID
      const signature = await signEvent(wrongIdEvent.id, keys.privateKey);
      const signedEvent = {
        ...wrongIdEvent,
        sig: signature,
      };

      console.log(
        "Publishing event with incorrect ID (should be rejected during async validation)...",
      );
      console.log(`Correct ID: ${correctId}`);
      console.log(`Wrong ID: ${signedEvent.id}`);

      const publishResult = await client.publishEvent(signedEvent);
      console.log(
        `Event was ${publishResult.success ? "accepted (initial validation only)" : "rejected"}`,
      );

      // Note: The event might be accepted initially because ID validation happens asynchronously
      console.log(
        "Note: ID validation happens asynchronously to improve performance",
      );
      console.log(
        "      Events with invalid IDs will be rejected during async validation",
      );
    } catch (error) {
      console.log(
        `Error during ID validation test: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    // Inform about validation security benefits
    console.log("\nSecurity benefits of NIP-01 compliant validation:");
    console.log("✓ Prevents malformed event injection");
    console.log("✓ Ensures event integrity (ID matches content)");
    console.log("✓ Verifies event authenticity (signature validation)");
    console.log("✓ Rejects events with unreasonable timestamps");
    console.log("✓ Provides defense against various attack vectors");

    // Demo 4: Demonstrate the improved helper functions
    console.log("\nDemonstrating improved helper functions:");

    // Create a text note with automatic pubkey derivation
    const directTextNote = createTextNote(
      "This text note has pubkey automatically set",
      keys.privateKey,
    );
    console.log(`Text note pubkey: ${directTextNote.pubkey.slice(0, 8)}...`);

    // Create a direct message with automatic pubkey derivation
    const recipient = keys.publicKey; // Just using the same key for demo
    const directMessage = await createDirectMessage(
      "This is an encrypted message",
      recipient,
      keys.privateKey,
    );
    console.log(
      `Direct message pubkey: ${directMessage.pubkey.slice(0, 8)}...`,
    );

    // Wait a bit then clean up
    console.log("\nWaiting for 10 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Unsubscribe and disconnect
    console.log("Cleaning up...");
    client.unsubscribe(subscriptionIds);
    client.disconnectFromRelays();

    // Shut down the ephemeral relay if we used one
    if (ephemeralRelay) {
      console.log("Shutting down ephemeral relay...");
      ephemeralRelay.close();
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
