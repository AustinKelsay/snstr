import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../src";
import { LogLevel } from "../../src/nip46/utils/logger";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

/**
 * This minimal example demonstrates NIP-46 remote signing functionality.
 * It creates a bunker (signer) and client, establishes a connection,
 * and performs basic operations like signing an event.
 * 
 * Key NIP-46 concepts demonstrated:
 * - remote-signer-pubkey: Used in connection string for communication
 * - user-pubkey: Retrieved via get_public_key after connection
 * - Two-step connection: connect() then get_public_key()
 */
async function run() {
  // Create a local ephemeral relay for testing
  const relay = new NostrRelay(4000);
  const relays = [relay.url];

  try {
    console.log("=== NIP-46 Minimal Example ===");

    // 1. Start the relay
    await relay.start();
    console.log(`Using local ephemeral relay: ${relay.url}`);

    // 2. Generate test keypairs
    console.log("\nGenerating keypairs...");
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair(); // Separate keypair for communication
    
    console.log(`User public key (for signing): ${userKeypair.publicKey}`);
    console.log(`Remote signer public key (for communication): ${signerKeypair.publicKey}`);

    // 3. Create and start bunker with more verbose logging
    console.log("\nStarting bunker...");
    const bunker = new SimpleNIP46Bunker(
      relays, 
      userKeypair.publicKey,
      signerKeypair.publicKey
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    bunker.setLogLevel(LogLevel.DEBUG);

    // Set permissions for signing events
    bunker.setDefaultPermissions(["sign_event:1", "get_public_key", "ping"]);

    await bunker.start();

    // 4. Get connection string
    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);
    console.log(`(Contains remote-signer-pubkey: ${signerKeypair.publicKey})`);

    // 5. Create and connect client with more verbose logging
    console.log("\nConnecting client...");
    const client = new SimpleNIP46Client(relays, {
      timeout: 5000,
      logLevel: LogLevel.DEBUG,
    });
    
    // Connect establishes the connection but doesn't return user pubkey
    const connectResult = await client.connect(connectionString);
    console.log(`Connected! Result: ${connectResult}`);

    // 6. Verify connection with ping
    console.log("\nTesting connection with ping...");
    const pingResult = await client.ping();
    console.log(`Ping result: ${pingResult ? "Success" : "Failed"}`);

    // 7. Get user public key (required step after connect per NIP-46 spec)
    console.log("\nGetting user public key from bunker...");
    const userPubkey = await client.getPublicKey();
    console.log(`Retrieved user public key: ${userPubkey}`);
    console.log(`Matches original user pubkey: ${userPubkey === userKeypair.publicKey ? "Yes" : "No"}`);
    console.log(`Different from signer pubkey: ${userPubkey !== signerKeypair.publicKey ? "Yes" : "No"}`);

    // 8. Sign an event
    console.log("\nSigning a test event...");
    const eventTemplate = {
      kind: 1,
      content: "Hello from NIP-46 example!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const signedEvent = await client.signEvent(eventTemplate);
    console.log("Event signed successfully:");
    console.log(`  ID: ${signedEvent.id}`);
    console.log(`  Pubkey: ${signedEvent.pubkey}`);
    console.log(`  Signed with user pubkey: ${signedEvent.pubkey === userPubkey ? "Yes" : "No"}`);

    // 9. Clean up
    console.log("\nCleaning up...");
    await client.disconnect();
    await bunker.stop();
    await relay.close();

    console.log("Example completed successfully!");
  } catch (error) {
    console.error("Error in NIP-46 example:", error);

    // Clean up resources even if there's an error
    if (relay) {
      try {
        await relay.close();
      } catch (e) {
        console.error("Error closing relay:", e);
      }
    }
  }
}

// Run the example
run();
