/**
 * Relay Reconnection Example
 *
 * This example demonstrates how to configure and use the automatic
 * reconnection features of the Relay class.
 *
 * Key concepts:
 * - Configuring reconnection parameters
 * - Handling reconnection events
 * - Managing reconnection behavior
 *
 * How to run:
 * npm run example:relay-reconnect
 */

import { Relay, RelayEvent } from "../../../src/index";

// Configure logging based on environment variables
const verbose = process.env.VERBOSE === "1";
const debug = process.env.DEBUG === "1";

// Create a relay with custom reconnection settings
const relay = new Relay("wss://relay.damus.io", {
  autoReconnect: true,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 15000,
});

// Set up event handlers to monitor connection status
relay.on(RelayEvent.Connect, (url: string) => {
  console.log(`✅ Connected to ${url}`);
});

relay.on(RelayEvent.Disconnect, (url: string) => {
  console.log(
    `❌ Disconnected from ${url}, will attempt to reconnect automatically`,
  );
});

relay.on(RelayEvent.Error, (url: string, error: Error) => {
  console.error(`⚠️ Error with ${url}:`, error);
});

// Connect to relay
console.log("Connecting to relay...");
relay
  .connect()
  .then((success) => {
    if (success) {
      console.log("Successfully established initial connection");

      // Demonstrate subscribing to events
      const subId = relay.subscribe(
        [{ kinds: [1], limit: 5 }],
        (event) => {
          if (verbose || debug) {
            console.log(
              `Received event: ${event.kind} from ${event.pubkey.slice(0, 8)}...`,
            );
          } else {
            process.stdout.write(".");
          }
        },
        () => {
          console.log("\nReceived EOSE (End of Stored Events)");
        },
      );

      console.log(`Created subscription with ID: ${subId}`);

      // Simulate a disconnection after 5 seconds to demonstrate reconnection
      setTimeout(() => {
        console.log("\nSimulating network interruption...");
        // This is just for demonstration purposes - normally you wouldn't force close
        // the WebSocket directly. In real usage, network interruptions would trigger this.
        if (relay["ws"]) {
          console.log("Forcing WebSocket to close to demonstrate reconnection");
          relay["ws"].close();
        }
      }, 5000);

      // After 20 seconds, disconnect and exit
      setTimeout(() => {
        console.log("\nDemo complete, disconnecting...");
        relay.disconnect();
        console.log("Disconnected. Example finished.");

        // In a real application you might keep the connection open until the app exits
      }, 20000);
    } else {
      console.error("Failed to connect to relay");
    }
  })
  .catch((error) => {
    console.error("Error connecting to relay:", error);
  });

// Also demonstrate how to control reconnection programmatically
console.log("\nReconnection control methods:");
console.log("- relay.setAutoReconnect(false) - Disable automatic reconnection");
console.log("- relay.setAutoReconnect(true) - Enable automatic reconnection");
console.log(
  "- relay.setMaxReconnectAttempts(10) - Set maximum reconnection attempts",
);
console.log(
  "- relay.setMaxReconnectDelay(30000) - Set maximum delay between attempts (ms)",
);
