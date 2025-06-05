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
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORT = 3337;

// Configure logging based on environment variables
const verbose = process.env.VERBOSE === "1";
const debug = process.env.DEBUG === "1";

async function main() {
  let relay: Relay;
  let ephemeralRelay: NostrRelay | null = null;

  if (USE_EPHEMERAL) {
    console.log("Starting ephemeral relay...");
    ephemeralRelay = new NostrRelay(RELAY_PORT);
    await ephemeralRelay.start();
    console.log(`Ephemeral relay started at ${ephemeralRelay.url}`);
    relay = new Relay(ephemeralRelay.url, {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 15000,
    });
  } else {
    relay = new Relay("wss://relay.damus.io", {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 15000,
    });
  }

  // Set up event handlers to monitor connection status
  relay.on(RelayEvent.Connect, (url: string) => {
    console.log(`✅ Connected to ${url}`);
  });

  relay.on(RelayEvent.Disconnect, (url: string) => {
    console.log(
      `❌ Disconnected from ${url}, will attempt to reconnect automatically`,
    );
  });

  relay.on(RelayEvent.Error, (url: string, error: unknown) => {
    console.error(`⚠️ Error with ${url}:`, error);
  });

  console.log("Connecting to relay...");
  try {
    const success = await relay.connect();
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
        if (relay["ws"]) {
          console.log("Forcing WebSocket to close to demonstrate reconnection");
          relay["ws"].close();
        }
      }, 5000);

      // After 20 seconds, disconnect and exit
      setTimeout(async () => {
        console.log("\nDemo complete, disconnecting...");
        relay.disconnect();
        if (ephemeralRelay) {
          await ephemeralRelay.close();
        }
        console.log("Disconnected. Example finished.");
      }, 20000);
    } else {
      console.error("Failed to connect to relay");
    }
  } catch (error) {
    console.error("Error connecting to relay:", error);
  }

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
}

main().catch((err) => {
  console.error(err);
});
