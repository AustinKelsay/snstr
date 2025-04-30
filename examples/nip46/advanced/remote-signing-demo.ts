import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../../src";
import { LogLevel } from "../../../src/nip46/utils/logger";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

async function main() {
  console.log("=== NIP-46 Remote Signing Advanced Demo ===\n");

  // Use an ephemeral relay for testing - in production you'd use public relays
  const relay = new NostrRelay(3000);
  await relay.start();
  console.log("Started ephemeral relay at:", relay.url);

  const relays = [relay.url];

  // Generate test keypairs
  console.log("\nGenerating keypairs...");
  const userKeypair = await generateKeypair();
  const signerKeypair = await generateKeypair();

  console.log(`User public key: ${userKeypair.publicKey}`);
  console.log(`Signer public key: ${signerKeypair.publicKey}`);

  // Create and configure bunker
  console.log("\nStarting bunker...");
  const bunker = new SimpleNIP46Bunker(
    [relay.url],
    userKeypair.publicKey,
    signerKeypair.publicKey,
    {
      defaultPermissions: [
        "sign_event:1", // Allow signing kind 1 notes
        "get_public_key", // Allow retrieving the user's public key
        "ping", // Allow ping/pong heartbeats
        "nip04_encrypt", // Allow NIP-04 encryption
        "nip04_decrypt", // Allow NIP-04 decryption
      ],
    },
  );

  // Set the private keys (in a real application, these would be securely stored)
  bunker.setUserPrivateKey(userKeypair.privateKey);
  bunker.setSignerPrivateKey(signerKeypair.privateKey);

  // Start the bunker
  await bunker.start();

  // Get the connection string to share with clients
  const connectionString = bunker.getConnectionString();
  console.log("Bunker connection string:", connectionString);

  // Create a client with debug logging
  console.log("\nCreating client...");
  const client = new SimpleNIP46Client(relays);
  client.setLogLevel(LogLevel.DEBUG);

  try {
    // Connect to the bunker
    console.log("Connecting to bunker...");
    await client.connect(connectionString);
    console.log("Connected successfully!");

    // Get the user's public key from the bunker
    const userPubkey = await client.getPublicKey();
    console.log("\nUser public key from bunker:", userPubkey);
    console.log(
      "Matches original:",
      userPubkey === userKeypair.publicKey ? "Yes" : "No",
    );

    // Test ping
    console.log("\nSending ping to verify connection...");
    const pong = await client.ping();
    console.log("Ping response:", pong ? "Successful" : "Failed");

    // Create a third party for encryption tests
    const thirdPartyKeypair = await generateKeypair();
    console.log("\nGenerated third party key for encryption tests:");
    console.log(`Third party public key: ${thirdPartyKeypair.publicKey}`);

    // Sign an event remotely
    console.log("\nRemotely signing an event...");
    const eventToSign = {
      kind: 1,
      content: "Hello from a remote signer!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    console.log("Event to sign:", JSON.stringify(eventToSign));
    const signedEvent = await client.signEvent(eventToSign);
    console.log("Signed event:", JSON.stringify(signedEvent, null, 2));

    // Test NIP-04 encryption
    console.log("\nTesting NIP-04 encryption...");
    const message = "This is a secret message for testing encryption";
    console.log(`Message to encrypt: ${message}`);

    try {
      const encrypted = await client.nip04Encrypt(
        thirdPartyKeypair.publicKey,
        message,
      );
      console.log(`Encrypted: ${encrypted}`);

      // Test NIP-04 decryption
      console.log("\nTesting NIP-04 decryption...");
      const decrypted = await client.nip04Decrypt(
        thirdPartyKeypair.publicKey,
        encrypted,
      );
      console.log(`Decrypted: ${decrypted}`);
      console.log(
        `Original message recovered: ${decrypted === message ? "Yes" : "No"}`,
      );
    } catch (error) {
      console.error("Error in NIP-04 demo:", error);
    }

    // Try to sign an event without permission
    console.log("\nTesting permission restrictions...");
    try {
      const unauthorizedEvent = {
        kind: 30023, // No permission for this kind
        content: "This should fail due to missing permission",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      };

      console.log("Attempting to sign unauthorized event kind 30023...");
      await client.signEvent(unauthorizedEvent);
      console.log("WARNING: Unauthorized event was signed (unexpected)");
    } catch (error: any) {
      console.log(
        "Failed to sign unauthorized event (expected):",
        error.message,
      );
    }
  } catch (error: any) {
    console.error("Error in demo:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  } finally {
    // Clean up
    console.log("\nCleaning up...");
    await client.disconnect();
    await bunker.stop();
    await relay.close();
    console.log("Demo completed");
  }
}

main().catch(console.error);
