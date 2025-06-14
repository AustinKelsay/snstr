import { Relay } from "../../../src/nip01/relay";
import { RelayEvent, NostrEvent } from "../../../src/types/nostr";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORT = 3336;

/**
 * This example demonstrates the improved connection handling in SNSTR
 * Including timeout handling, error management, race condition fixes,
 * the event ordering system, and the enhanced event validation.
 */
async function main() {
  let relay: Relay;
  let ephemeralRelay: NostrRelay | null = null;

  if (USE_EPHEMERAL) {
    console.log("Starting ephemeral relay...");
    ephemeralRelay = new NostrRelay(RELAY_PORT);
    await ephemeralRelay.start();
    relay = new Relay(ephemeralRelay.url, {
      connectionTimeout: 5000,
      bufferFlushDelay: 50,
    });
    console.log(`Ephemeral relay running at ${ephemeralRelay.url}`);
  } else {
    relay = new Relay("wss://relay.nostr.band", {
      connectionTimeout: 5000,
      bufferFlushDelay: 50,
    });
  }

  console.log(
    `Created relay with connection timeout: ${relay.getConnectionTimeout()}ms`,
  );
  console.log(
    `Event ordering buffer flush delay: ${relay.getBufferFlushDelay()}ms`,
  );

  // Setup event handlers before connecting
  relay.on(RelayEvent.Connect, (relayUrl) => {
    console.log(`✅ Connected to relay: ${relayUrl}`);
  });

  relay.on(RelayEvent.Disconnect, (relayUrl) => {
    console.log(`❌ Disconnected from relay: ${relayUrl}`);
  });

  relay.on(RelayEvent.Error, (relayUrl, error) => {
    console.error(`⚠️ Error from relay ${relayUrl}:`, error);
  });

  // Attempt to connect with proper error handling
  console.log("Connecting to relay...");
  try {
    const connected = await relay.connect();
    if (connected) {
      console.log("Successfully connected to relay");

      // Set up a subscription to see event ordering in action
      console.log("\nSetting up subscription to demonstrate event ordering...");
      const subscription = relay.subscribe(
        [{ kinds: [1], limit: 5 }],
        (event) => {
          console.log(
            `Received event ${event.id.slice(0, 8)}... from ${new Date(event.created_at * 1000).toISOString()}`,
          );
          console.log(
            `  Content: ${event.content.length > 50 ? event.content.slice(0, 50) + "..." : event.content}`,
          );
        },
        () => {
          console.log(
            "EOSE received - events buffer flushed and delivered in sorted order",
          );
        },
      );

      // Wait a moment to see some events
      console.log("Waiting for events...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Unsubscribe
      console.log("\nUnsubscribing...");
      relay.unsubscribe(subscription);

      // ---------- NEW: Demonstrate event validation ----------
      console.log("\n--- Demonstrating NIP-01 Event Validation ---");

      // Create a validation test subscription
      console.log("Setting up subscription for validation testing...");
      const _validationSubscription = relay.subscribe(
        [{ kinds: [1], limit: 2 }],
        (event) => {
          console.log(`✅ Valid event received: ${event.id.slice(0, 8)}...`);
        },
        () => {
          console.log("EOSE received for validation subscription");
        },
      );

      // Test the relay's validation by attempting to process invalid events
      console.log("\nTesting event validation with various invalid events...");

      // Direct access to basic validation for testing purposes
      const testValidation = (
        event: Partial<NostrEvent>,
        description: string,
      ) => {
        // Get access to private validation method for demonstration purposes
        // Using index signature to access private method for demo purposes
        const validationResult = (
          relay as unknown as {
            performBasicValidation(event: Partial<NostrEvent>): boolean;
          }
        ).performBasicValidation(event);
        console.log(
          `${validationResult ? "✅" : "❌"} ${description}: ${validationResult ? "PASSED basic validation" : "REJECTED in basic validation"}`,
        );
        return validationResult;
      };

      // Test 1: Valid event (should pass basic validation)
      const validEvent: NostrEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [["t", "test"]],
        content: "This is a valid event",
        sig: "c".repeat(128),
      };
      testValidation(validEvent, "Well-formed event");

      // Test 2: Event with future timestamp (should fail)
      const futureEvent = {
        ...validEvent,
        created_at: Math.floor(Date.now() / 1000) + 7200, // 2 hours in the future
      };
      testValidation(futureEvent, "Event with future timestamp");

      // Test 3: Event with missing field
      const missingFieldEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        // missing created_at
        kind: 1,
        tags: [],
        content: "Missing created_at",
        sig: "c".repeat(128),
      };
      testValidation(missingFieldEvent, "Event missing required field");

      // Test 4: Event with invalid field type
      const invalidFieldTypeEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: "not a number" as unknown as number, // wrong type
        kind: 1,
        tags: [],
        content: "Invalid created_at type",
        sig: "c".repeat(128),
      };
      testValidation(invalidFieldTypeEvent, "Event with invalid field type");

      // Test 5: Event with invalid tag structure
      const invalidTagsEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: ["not an array of arrays"] as unknown as string[][], // invalid tag structure
        content: "Invalid tags",
        sig: "c".repeat(128),
      };
      testValidation(invalidTagsEvent, "Event with invalid tag structure");

      // Test 6: Event with too short ID
      const invalidIdEvent = {
        id: "a".repeat(60), // too short
        pubkey: "b".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "ID too short",
        sig: "c".repeat(128),
      };
      testValidation(invalidIdEvent, "Event with invalid ID length");

      console.log("\nImproved Validation Process (NIP-01 §7 Compliant):");
      console.log(
        "1. 🔍 Basic Validation: Synchronous checks for required fields and formats",
      );
      console.log("   - Performed immediately upon receipt of an event");
      console.log(
        "   - Rejects obviously invalid events without further processing",
      );
      console.log(
        "\n2. 🔐 Cryptographic Validation: Asynchronous verification of:",
      );
      console.log("   - Event ID matches the SHA-256 hash of event data");
      console.log("   - Signature is valid for the event ID and pubkey");
      console.log("\n3. ⏱️ Process Flow:");
      console.log(
        "   - Events are held in a pending state until async validation completes",
      );
      console.log(
        "   - Only events that pass BOTH validation stages are processed",
      );
      console.log(
        "   - Invalid events are rejected with appropriate error messages",
      );
      console.log("\n✅ This fully complies with NIP-01 §7:");
      console.log(
        '   "Relays MUST NOT accept an EVENT message that does not validate."',
      );
      console.log(
        "\n💡 Key Improvement: Unlike previous implementation, events are now",
      );
      console.log(
        "   never propagated to subscribers until full validation completes.",
      );

      // ---------- NEW: Demonstrate proper unsubscribeAll implementation ----------
      console.log(
        "\n--- Demonstrating Protocol-Compliant unsubscribeAll() ---",
      );

      // Use the same relay URL as above so unsubscribeAll works in either mode
      const testRelayUrl = USE_EPHEMERAL && ephemeralRelay
        ? ephemeralRelay.url
        : "wss://relay.nostr.band";

      // Create a Nostr client instance for this part of the test
      console.log(
        `\nCreating Nostr client with relay ${testRelayUrl} to demonstrate unsubscribeAll...`,
      );
      const { Nostr } = await import("../../../src/nip01/nostr"); // Ensure Nostr is imported if not already
      const nostrClientForUnsubscribeTest = new Nostr([testRelayUrl]);
      await nostrClientForUnsubscribeTest.connectToRelays(); // Connect the client

      // Get the specific Relay instance from the client to check its subscriptions later
      const targetRelayInstance =
        nostrClientForUnsubscribeTest.getRelay(testRelayUrl);

      if (!targetRelayInstance) {
        console.error(
          `Could not get relay instance for ${testRelayUrl} from client.`,
        );
        return; // Cannot proceed with this test
      }

      // Create multiple subscriptions via the Nostr client
      console.log("Creating multiple subscriptions via Nostr client...");
      const _clientSubIds1 = nostrClientForUnsubscribeTest.subscribe(
        [{ kinds: [1], limit: 1 }],
        () => {
          console.log("Client Subscription 1 received an event");
        },
      );
      const _clientSubIds2 = nostrClientForUnsubscribeTest.subscribe(
        [{ kinds: [0], limit: 1 }],
        () => {
          console.log("Client Subscription 2 received an event");
        },
      );
      const _clientSubIds3 = nostrClientForUnsubscribeTest.subscribe(
        [{ kinds: [4], limit: 1 }],
        () => {
          console.log("Client Subscription 3 received an event");
        },
      );

      // Show how many active subscriptions the specific Relay instance has
      console.log(
        `Active subscriptions on Relay instance before unsubscribeAll: ${targetRelayInstance.getSubscriptionIds().size}`,
      );
      console.log(
        "Subscription IDs on Relay instance:",
        Array.from(targetRelayInstance.getSubscriptionIds()),
      );

      // Demonstrate protocol-compliant unsubscribeAll
      console.log("\nCalling client.unsubscribeAll()...");
      nostrClientForUnsubscribeTest.unsubscribeAll();

      // Allow some time for CLOSE messages to be processed by the relay and client
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if all client subscriptions were correctly closed on the Relay instance
      console.log(
        `Relay subscription count after unsubscribeAll: ${targetRelayInstance.getSubscriptionIds().size}`,
      );
      console.log(
        `Remaining subscription IDs on Relay instance: [ ${Array.from(targetRelayInstance.getSubscriptionIds()).join(", ")} ]`,
      );

      // Disconnect the test client
      nostrClientForUnsubscribeTest.disconnectFromRelays();
    } else {
      console.error("Failed to connect to relay");
      // Demonstrate changing timeout and retrying
      console.log("Changing timeout and retrying...");
      relay.setConnectionTimeout(10000); // Increase timeout to 10 seconds
      console.log(`New connection timeout: ${relay.getConnectionTimeout()}ms`);

      const retryConnected = await relay.connect();
      if (retryConnected) {
        console.log("Successfully connected on retry");
      } else {
        console.error("Failed to connect on retry");
        return; // Exit if we still can't connect
      }
    }
  } catch (error) {
    console.error("Connection error:", error);
    return; // Exit if connection errors out
  }

  // Demonstrate timeout behavior with an invalid relay
  console.log("\nDemonstrating timeout with an invalid relay...");
  const invalidRelay = new Relay("wss://invalid.relay.example", {
    connectionTimeout: 3000,
    bufferFlushDelay: 50,
    autoReconnect: false, // Disable automatic reconnection attempts
  });

  invalidRelay.on(RelayEvent.Error, (relayUrl, error) => {
    console.error(`⚠️ Error from invalid relay ${relayUrl}:`, error);
  });

  console.log(
    `Invalid relay connection timeout: ${invalidRelay.getConnectionTimeout()}ms`,
  );
  console.log(
    `Invalid relay buffer flush delay: ${invalidRelay.getBufferFlushDelay()}ms`,
  );
  console.log("Attempting to connect to invalid relay (should time out)...");

  const invalidConnected = await invalidRelay.connect();
  if (!invalidConnected) {
    console.log("✅ Correctly failed to connect to invalid relay");
  } else {
    console.error("❌ Unexpectedly connected to invalid relay");
  }

  // Only check for the 10000ms timeout if we had to retry the connection
  const connectionTimeoutChanged = relay.getConnectionTimeout() === 10000;
  if (connectionTimeoutChanged && relay.getConnectionTimeout() !== 10000) {
    console.error("Expected connection timeout to be 10000ms");
  } else if (
    !connectionTimeoutChanged &&
    relay.getConnectionTimeout() !== 5000
  ) {
    console.error(
      `Expected connection timeout to be 5000ms, but got ${relay.getConnectionTimeout()}ms`,
    );
  }

  // Make sure to disconnect the invalid relay
  invalidRelay.disconnect();

  // Disconnect from relay
  console.log("\nDisconnecting from relay...");
  relay.disconnect();

  // Wait a moment to see the disconnect message
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (ephemeralRelay) {
    await ephemeralRelay.close();
  }

  console.log("Example completed.");
}

// Execute the main function
main().catch((error) => {
  console.error("Unhandled error in main:", error);
  process.exit(1); // Ensure the process exits on unhandled errors
});
