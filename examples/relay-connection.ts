import { Relay, RelayEvent, NostrEvent } from "../src";

/**
 * This example demonstrates the improved connection handling in SNSTR
 * Including timeout handling, error management, race condition fixes,
 * the event ordering system, and the enhanced event validation.
 */
async function main() {
  // Create a relay with a specific connection timeout (5 seconds) and buffer flush delay
  const relay = new Relay("wss://relay.nostr.band", {
    connectionTimeout: 5000,
    bufferFlushDelay: 50, // Control event ordering buffer flush frequency
  });
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
      const validationSubscription = relay.subscribe(
        [{ kinds: [1], limit: 2 }],
        (event) => {
          console.log(`✅ Valid event received: ${event.id.slice(0, 8)}...`);
        },
        () => {
          console.log("EOSE received for validation subscription");
        }
      );
      
      // Test the relay's validation by attempting to process invalid events
      console.log("\nTesting event validation with various invalid events...");
      
      // Direct access to handleMessage for testing purposes
      const testValidation = (event: any, description: string) => {
        // Get access to private validateEvent method for demonstration purposes
        const validationResult = (relay as any).validateEvent(event);
        console.log(`${validationResult ? '✅' : '❌'} ${description}: ${validationResult ? 'ACCEPTED' : 'REJECTED'}`);
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
        sig: "c".repeat(128)
      };
      testValidation(validEvent, "Well-formed event");
      
      // Test 2: Event with future timestamp (should fail)
      const futureEvent = {
        ...validEvent,
        created_at: Math.floor(Date.now() / 1000) + 7200 // 2 hours in the future
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
        sig: "c".repeat(128)
      };
      testValidation(missingFieldEvent, "Event missing required field");
      
      // Test 4: Event with invalid field type
      const invalidFieldTypeEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: "not a number", // wrong type
        kind: 1,
        tags: [],
        content: "Invalid created_at type",
        sig: "c".repeat(128)
      };
      testValidation(invalidFieldTypeEvent, "Event with invalid field type");
      
      // Test 5: Event with invalid tag structure
      const invalidTagsEvent = {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: ["not an array of arrays"], // invalid tag structure
        content: "Invalid tags",
        sig: "c".repeat(128)
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
        sig: "c".repeat(128)
      };
      testValidation(invalidIdEvent, "Event with invalid ID length");
      
      console.log("\nNote: In addition to these basic validations, the system also performs:");
      console.log("- Asynchronous verification of event ID hash against event content");
      console.log("- Asynchronous verification of event signature validity");
      console.log("These checks happen in the background for performance reasons.\n");
      
      // Unsubscribe from validation test
      relay.unsubscribe(validationSubscription);
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

  // Demonstrate proper cleanup
  if (relay.getConnectionTimeout() !== 10000) {
    console.error("Expected connection timeout to be 10000ms");
  }

  // Disconnect from relay
  console.log("\nDisconnecting from relay...");
  relay.disconnect();

  // Wait a moment to see the disconnect message
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("Example completed.");
}

// Execute the main function
main().catch((error) => {
  console.error("Unhandled error in main:", error);
});
