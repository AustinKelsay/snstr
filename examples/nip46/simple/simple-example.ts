import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
  verifySignature,
} from "../../../src";
import { NIP46Error } from "../../../src/nip46/types";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

async function main() {
  console.log("=============================");
  console.log("Simple NIP-46 Remote Signing Example");
  console.log("=============================");
  console.log("This example demonstrates the new NIP-46 flow:");
  console.log("1. Connect to remote signer (establishes connection)");
  console.log("2. Call get_public_key to retrieve user's signing pubkey");
  console.log("3. Differentiate between remote-signer-pubkey and user-pubkey");
  console.log("");

  // Start an ephemeral relay for testing
  const relay = new NostrRelay(3456);
  await relay.start();
  console.log(`Started relay at: ${relay.url}`);
  console.log("");

  // Generate keypairs
  console.log("Generating keypairs...");
  const userKeypair = await generateKeypair();
  const signerKeypair = await generateKeypair(); // Different keypair for the signer

  console.log(`User pubkey (for signing): ${userKeypair.publicKey}`);
  console.log(`Remote signer pubkey (for communication): ${signerKeypair.publicKey}`);
  console.log("");

  try {
    // Create and start bunker
    console.log("Creating bunker...");
    // Pass different keypairs for user (for signing) and signer (for remote communication)
    const bunker = new SimpleNIP46Bunker(
      [relay.url],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        // Add default permissions
        defaultPermissions: ["sign_event:1", "get_public_key", "ping"], // Allow signing kind 1 (text notes)
        debug: true,
      },
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    console.log("Starting bunker...");
    await bunker.start();

    // Give the bunker time to initialize and connect to relays
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);
    console.log("(Note the remote signer pubkey in the URL, not the user pubkey)");
    console.log("");

    // Create client and connect to bunker
    console.log("Creating client...");
    const client = new SimpleNIP46Client([relay.url]);

    console.log("Connecting client to bunker...");
    // connect() establishes the connection but doesn't return user pubkey
    const connectResult = await client.connect(connectionString);
    console.log(`Connected! Connect result: ${connectResult}`);
    
    // Must call get_public_key after connect to get the user's signing pubkey
    console.log("\nGetting user public key from bunker...");
    const userPubkey = await client.getPublicKey();
    console.log(`Retrieved user pubkey: ${userPubkey}`);
    console.log(`Matches original user pubkey: ${userPubkey === userKeypair.publicKey}`);
    console.log(`Pubkey is NOT the signer pubkey: ${userPubkey !== signerKeypair.publicKey}`);
    console.log("");

    // Test ping
    console.log("Testing ping...");
    const pong = await client.ping();
    console.log(`Response: ${pong}`);
    console.log("");

    // Test signing an event
    console.log("Testing event signing...");
    const event = {
      kind: 1,
      content: "Hello from NIP-46 remote signing!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    // Sign the note remotely using the bunker
    const signedEvent = await client.signEvent(event);

    console.log("Successfully signed event:");
    console.log(`- ID: ${signedEvent.id}`);
    console.log(`- Pubkey: ${signedEvent.pubkey}`);
    console.log(`- Signature: ${signedEvent.sig.substring(0, 20)}...`);

    // Verify signature
    const valid = await verifySignature(
      signedEvent.id,
      signedEvent.sig,
      signedEvent.pubkey,
    );
    console.log(`Signature valid: ${valid}`);
    console.log(`Pubkey matches user pubkey: ${signedEvent.pubkey === userKeypair.publicKey}`);
    console.log(`Pubkey is NOT the signer pubkey: ${signedEvent.pubkey !== signerKeypair.publicKey}`);
    console.log("");

    // Clean up
    console.log("Cleaning up...");
    await client.disconnect();
    await bunker.stop();
  } catch (error: unknown) {
    if (error instanceof NIP46Error) {
      console.error("NIP46 ERROR:", error.message);
    } else if (error instanceof Error) {
      console.error("ERROR:", error.message);
    } else {
      console.error("UNKNOWN ERROR:", error);
    }
  } finally {
    // Close relay
    await relay.close();
    console.log("Relay closed");
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error("Unhandled error:", error.message);
  } else {
    console.error("Unhandled unknown error:", error);
  }
});
