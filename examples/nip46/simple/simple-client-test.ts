import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
  verifySignature,
} from "../../../src";
import { NIP46Error } from "../../../src/nip46/types";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

async function main() {
  console.log("Testing Simple NIP-46 Implementation");
  console.log("-----------------------------------");
  console.log("Testing the new NIP-46 flow where:");
  console.log("- connect() establishes connection");
  console.log("- get_public_key() retrieves user pubkey");
  console.log("- remote-signer-pubkey ≠ user-pubkey");
  console.log("");

  try {
    // Start an ephemeral relay
    const port = 4571;
    const relay = new NostrRelay(port);
    await relay.start();
    const relayUrl = relay.url;
    console.log(`Started relay at ${relayUrl}`);

    // Generate keypairs
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair();
    console.log(`\nUser pubkey (for signing): ${userKeypair.publicKey}`);
    console.log(
      `Signer pubkey (for communication): ${signerKeypair.publicKey}`,
    );

    // Create and start bunker
    console.log("\nStarting bunker...");
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        defaultPermissions: ["sign_event:1", "get_public_key", "ping"], // Allow signing kind 1 (text notes)
        debug: true,
      },
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    await bunker.start();

    // Add a short delay to ensure bunker is ready
    console.log("Waiting for bunker to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get connection string
    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);
    console.log(`(Contains signer pubkey: ${signerKeypair.publicKey})`);

    // Create and connect client
    console.log("\nConnecting client...");
    const client = new SimpleNIP46Client([relayUrl]);

    // Set a longer timeout for the request
    try {
      // Connect establishes the connection
      const connectResult = await client.connect(connectionString);
      console.log(`Connected! Result: ${connectResult}`);

      // Get user pubkey (required after connect per NIP-46 spec)
      console.log("\nGetting user public key...");
      const userPubkey = await client.getPublicKey();
      console.log(`Retrieved user pubkey: ${userPubkey}`);
      console.log(
        `Matches original user pubkey: ${userPubkey === userKeypair.publicKey}`,
      );
      console.log(
        `Different from signer pubkey: ${userPubkey !== signerKeypair.publicKey}`,
      );

      // Test ping
      console.log("\nTesting ping...");
      const pong = await client.ping();
      console.log(`Ping response: ${pong}`);

      // Test signing an event
      console.log("\nSigning a test event...");
      const testEvent = {
        kind: 1,
        content: "This is a test note from the simple NIP-46 implementation",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      };

      const signedEvent = await client.signEvent(testEvent);
      console.log(`Signed event ID: ${signedEvent.id}`);
      console.log(`Signed by: ${signedEvent.pubkey}`);
      console.log(`Matches user pubkey: ${signedEvent.pubkey === userPubkey}`);

      console.log("\nFull signed event:");
      console.log(JSON.stringify(signedEvent, null, 2));

      // Verify the signature
      const valid = await verifySignature(
        signedEvent.id,
        signedEvent.sig,
        signedEvent.pubkey,
      );
      console.log("\nValid signature?", valid);

      // Clean up
      console.log("\nCleaning up...");
      await client.disconnect();
      await bunker.stop();
      await relay.close();

      console.log("Test completed successfully!");
    } catch (error: unknown) {
      if (error instanceof NIP46Error) {
        console.error("NIP46 Error:", error.message);
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
        console.error(error.stack);
      } else {
        console.error("Unknown error:", error);
      }

      // Clean up resources even on error
      try {
        await client.disconnect();
        await bunker.stop();
        await relay.close();
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
      console.error(error.stack);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

main();
