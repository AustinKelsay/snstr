/**
 * NIP-01 Validation Flow Example
 * 
 * This example demonstrates the strict NIP-01 compliant event validation flow
 * where events are only propagated after full validation including signature verification.
 */

import { Nostr, Relay, RelayEvent, NostrEvent } from '../../src';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

async function main() {
  // Use an ephemeral relay to demonstrate validation
  const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== 'false';
  const debug = process.env.DEBUG?.includes("nostr:*") || false;
  let relay: Relay;
  let ephemeralRelay: NostrRelay | undefined;

  console.log("🔒 NIP-01 Event Validation Flow Example");
  console.log("=====================================");
  console.log("Demonstrates how SNSTR fully complies with NIP-01 §7:");
  console.log("\"Relays MUST NOT accept an EVENT message that does not validate.\"");
  console.log();

  // Setup relay 
  if (USE_EPHEMERAL) {
    console.log("🌐 Setting up ephemeral relay...");
    // Use a random port to avoid conflicts
    const port = Math.floor(Math.random() * 10000) + 10000; // Random port between 10000-20000
    ephemeralRelay = new NostrRelay(port);
    await ephemeralRelay.start();
    relay = new Relay(ephemeralRelay.url, {
      // Disable auto-reconnect for this example to avoid reconnection attempts
      // after we deliberately close connections
      autoReconnect: false
    });
    console.log(`Connected to ephemeral relay at ${ephemeralRelay.url}`);
  } else {
    console.log("🌐 Connecting to public relay...");
    const relayUrl = 'wss://relay.damus.io';
    relay = new Relay(relayUrl, {
      // Disable auto-reconnect for this example
      autoReconnect: false
    });
    console.log(`Connecting to public relay at ${relayUrl}`);
  }

  // Set up event handlers
  relay.on(RelayEvent.Connect, (url) => console.log(`Connected to ${url}`));
  relay.on(RelayEvent.Disconnect, (url) => console.log(`Disconnected from ${url}`));
  relay.on(RelayEvent.Error, (url, error) => console.log(`Error from ${url}:`, error));

  // Connect to relay
  try {
    await relay.connect();
  } catch (error) {
    console.error('Failed to connect to relay:', error);
    return;
  }

  // Create client for simplified API usage
  // Note: We don't need to explicitly set autoReconnect here since
  // we're already disabling it on the relay instances directly
  const client = ephemeralRelay 
    ? new Nostr([ephemeralRelay.url])
    : new Nostr(['wss://relay.damus.io']);
  await client.generateKeys();
  console.log(`Using public key: ${client.getPublicKey()!.slice(0, 8)}...`);

  // Set up subscription to see events
  console.log("\n📡 Setting up subscription to observe event processing...");
  const subscriptionId = client.subscribe(
    [{ kinds: [1], limit: 5 }],
    (event, relayUrl) => {
      console.log(`✓ Received fully validated event ${event.id.slice(0, 8)}... from ${relayUrl}`);
    }
  );

  console.log("\n🧪 Testing various events through the validation pipeline:");
  
  // 1. Publish a valid event
  console.log("\n1. 🟢 Publishing valid event:");
  try {
    const validEvent = await client.publishTextNote("This is a valid event from the validation example");
    console.log(`Published valid event with ID: ${validEvent?.id.slice(0, 8)}...`);
  } catch (error) {
    console.error("Error publishing valid event:", error);
  }

  // 2. Attempt to inject invalid event directly
  console.log("\n2. 🔴 Attempting to inject invalid event (missing signature):");
  
  // Create invalid event - well-formed but missing signature
  const invalidEvent = {
    id: "a".repeat(64),
    pubkey: client.getPublicKey()!,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [["t", "test"]],
    content: "This event has no valid signature!"
    // No signature
  };

  // Show the validation flow happening internally
  console.log("Internal validation process:");
  
  // 1. Basic validation (manually demonstrate)
  let validationPassed;
  try {
    validationPassed = (relay as any).performBasicValidation(invalidEvent);
    console.log(`  1. Basic Validation: ${validationPassed ? '✅ Passed' : '❌ Failed'}`);
  } catch (error) {
    console.log(`  1. Basic Validation: ❌ Failed with error: ${error}`);
    validationPassed = false;
  }

  // 2. Attempt to process event manually to demonstrate flow
  if (validationPassed) {
    console.log("  2. Event would proceed to async validation (signature/hash verification)");
    
    // This would normally be handled by the relay
    try {
      const asyncResult = await (relay as any).validateEventAsync(invalidEvent as NostrEvent);
      console.log(`  3. Async Validation: ${asyncResult ? '✅ Passed' : '❌ Failed'}`);
    } catch (error) {
      console.log(`  3. Async Validation: ❌ Failed with error: ${error}`);
    }
  }

  console.log("\n3. 🔄 Injecting event directly into relay's handleMessage:", debug ? "[DEBUG MODE]" : "");
  
  if (debug) {
    // Only in debug mode - this will show what happens inside the relay
    try {
      (relay as any).handleMessage(["EVENT", subscriptionId[0], invalidEvent]);
      console.log("→ Event sent to validation pipeline");
      console.log("→ Check your debug logs to see full validation flow");
    } catch (error) {
      console.error("Error injecting event:", error);
    }
  } else {
    console.log("→ Enable DEBUG=nostr:* environment variable to see full validation details");
    console.log("→ Events failing validation won't be propagated to subscribers");
  }

  // Wait a moment to see events
  console.log("\n⏱️ Waiting 3 seconds to see events...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 3. Publish valid event with signed event helper
  console.log("\n4. 🟢 Publishing properly signed event:");
  try {
    const validEvent = await client.publishTextNote("This is another valid event that should pass validation");
    console.log(`Published valid event with ID: ${validEvent?.id.slice(0, 8)}...`);
  } catch (error) {
    console.error("Error publishing valid event:", error);
  }

  // Wait a moment more
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Clean up
  console.log("\n🧹 Cleaning up...");
  client.unsubscribe(subscriptionId);
  relay.disconnect();
  
  if (ephemeralRelay) {
    await ephemeralRelay.close();
  }

  console.log("\n✅ Example completed - Events must pass BOTH basic and cryptographic validation");
  console.log("This ensures full compliance with NIP-01 §7 specification.");
  
  // Exit the process cleanly to prevent reconnection attempts
  process.exit(0);
}

main().catch(error => {
  console.error("Unhandled error:", error);
}); 