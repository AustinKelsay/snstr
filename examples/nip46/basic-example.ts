import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
  verifySignature,
} from "../../src";
import { NIP46Error } from "../../src/nip46/types";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

async function main() {
  console.log("NIP-46 Basic Remote Signing Example");
  console.log("----------------------------------");
  console.log("Demonstrates the NIP-46 protocol where:");
  console.log("- remote-signer-pubkey is used for communication");
  console.log("- user-pubkey is retrieved via get_public_key after connect");
  console.log("");

  // Start an ephemeral relay for testing
  const relay = new NostrRelay(0);
  await relay.start();
  console.log("Started ephemeral relay at:", relay.url);

  const relays = [relay.url];

  try {
    // Generate keypairs
    console.log("\nGenerating keypairs...");
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair(); // Different keypair for the signer

    console.log("User pubkey (for signing):", userKeypair.publicKey);
    console.log(
      "Remote signer pubkey (for communication):",
      signerKeypair.publicKey,
    );

    // Create and start bunker
    console.log("\nStarting bunker...");
    const bunker = new SimpleNIP46Bunker(
      [relay.url],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        defaultPermissions: ["sign_event:1", "get_public_key", "ping"],
      },
    );

    // Set private keys (these never leave the bunker)
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Start the bunker
    await bunker.start();

    // Get connection string
    const connectionString = bunker.getConnectionString();
    console.log("Connection string:", connectionString);
    console.log("(Contains remote-signer-pubkey, not user-pubkey)");

    // Create client
    console.log("\nInitializing client...");
    const client = new SimpleNIP46Client(relays, { timeout: 30000 });

    // Connect client to bunker
    console.log("Connecting to bunker...");
    const connectResult = await client.connect(connectionString);
    console.log("Client connected successfully");
    console.log("Connect result:", connectResult);

    // Get user public key (required after connect per NIP-46 spec)
    console.log("\nGetting user public key from bunker...");
    const userPubkey = await client.getPublicKey();
    console.log("User public key from bunker:", userPubkey);
    console.log(
      "Matches original user pubkey:",
      userPubkey === userKeypair.publicKey,
    );
    console.log(
      "Different from signer pubkey:",
      userPubkey !== signerKeypair.publicKey,
    );

    // Test ping command
    console.log("\nPinging bunker...");
    const pong = await client.ping();
    console.log("Ping response:", pong);

    // Create and sign a note
    console.log("\nSigning a text note...");
    const noteData = {
      kind: 1,
      content: "Hello from NIP-46 remote signer!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    // Sign the note remotely using the bunker
    const signedNote = await client.signEvent(noteData);

    console.log("Signed note ID:", signedNote.id);
    console.log("Signed with pubkey:", signedNote.pubkey);
    console.log("Signature:", signedNote.sig.substring(0, 20) + "...");
    console.log(
      "Pubkey matches user pubkey:",
      signedNote.pubkey === userPubkey,
    );

    // Verify the signature is valid
    const validSig = await verifySignature(
      signedNote.id,
      signedNote.sig,
      signedNote.pubkey,
    );
    console.log("Signature valid:", validSig);

    // Clean up
    await client.disconnect();
    await bunker.stop();
  } catch (error: unknown) {
    if (error instanceof NIP46Error) {
      console.error("NIP46 Error:", error.message);
    } else if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  } finally {
    // Clean up
    if (relay) {
      await relay.close();
      console.log("\nCleaned up ephemeral relay");
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error("Unhandled error:", error.message);
  } else {
    console.error("Unhandled unknown error:", error);
  }
});
