/**
 * NIP-46 Remote Signing - Unified Example
 *
 * This example demonstrates the core functionality of NIP-46 remote signing protocol,
 * showing how to:
 * 1. Create and configure a bunker to securely store private keys
 * 2. Connect a client to the bunker
 * 3. Perform remote signing operations
 *
 * For simplicity, this example uses the SimpleNIP46 implementation which provides
 * the essential functionality with minimal code.
 */

import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
  verifySignature,
} from "../../src";
import { LogLevel } from "../../src/nip46/utils/logger";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

async function main() {
  console.log("=== NIP-46 Remote Signing Example ===");

  // Create a local ephemeral relay for testing
  const relay = new NostrRelay(4000);
  const relays = [relay.url];

  try {
    // 1. Start the relay
    await relay.start();
    console.log(`Using local relay at: ${relay.url}`);

    // 2. Generate keypairs
    console.log("\nGenerating keypairs...");

    // Option 1: Use same keypair for both user and signer (simpler but less secure)
    const userKeypair = await generateKeypair();
    const signerKeypair = userKeypair; // Same keypair for simplicity

    // Option 2: Use separate keypairs (more secure, uncomment to use)
    // const userKeypair = await generateKeypair();
    // const signerKeypair = await generateKeypair();

    console.log(`User public key: ${userKeypair.publicKey}`);
    console.log(`Signer public key: ${signerKeypair.publicKey}`);

    // 3. Create and configure bunker
    console.log("\nStarting bunker...");
    const bunker = new SimpleNIP46Bunker(
      relays,
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        defaultPermissions: ["sign_event:1", "get_public_key", "ping"],
      },
    );

    // Set private keys (in a real application, these would be securely stored)
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    bunker.setLogLevel(LogLevel.INFO); // Set to DEBUG for more verbose logging

    await bunker.start();

    // 4. Get connection string that clients will use to connect
    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);

    // 5. Create and connect client
    console.log("\nConnecting client...");
    const client = new SimpleNIP46Client(relays, { timeout: 5000 });
    const remotePublicKey = await client.connect(connectionString);

    console.log(`Connected successfully to bunker`);
    console.log(`Remote public key: ${remotePublicKey}`);
    console.log(
      `Matches user pubkey: ${remotePublicKey === userKeypair.publicKey ? "Yes" : "No"}`,
    );

    // 6. Test connection with ping
    console.log("\nTesting connection with ping...");
    const pingResult = await client.ping();
    console.log(`Ping result: ${pingResult}`);

    // 7. Sign an event
    console.log("\nSigning a text note...");
    const eventTemplate = {
      kind: 1,
      content: "Hello from NIP-46 remote signer!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const signedEvent = await client.signEvent(eventTemplate);
    console.log("Event signed successfully:");
    console.log(`  ID: ${signedEvent.id}`);
    console.log(`  Pubkey: ${signedEvent.pubkey}`);
    console.log(`  Signature: ${signedEvent.sig.substring(0, 20)}...`);

    // 8. Verify the signature
    const isValid = await verifySignature(
      signedEvent.id,
      signedEvent.sig,
      signedEvent.pubkey,
    );
    console.log(`Signature valid: ${isValid ? "Yes" : "No"}`);

    // 9. Clean up resources
    console.log("\nCleaning up...");
    await client.disconnect();
    await bunker.stop();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Always clean up the relay
    if (relay) {
      await relay.close();
      console.log("Relay closed");
    }
  }
}

// Run the example
main().catch(console.error);
