import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../../src";
import { NIP46Error } from "../../../src/nip46/types";
import { LogLevel } from "../../../src/nip46/utils/logger";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

async function main() {
  console.log("=== NIP-46 Remote Signing Advanced Demo ===");
  console.log("This demo shows the updated NIP-46 flow:");
  console.log("1. Connect to bunker (connection establishment)");
  console.log("2. Call get_public_key to retrieve user's signing key");
  console.log("3. Demonstrate permission-based signing");
  console.log(
    "4. Show difference between remote-signer-pubkey and user-pubkey",
  );
  console.log("");

  // Use an ephemeral relay for testing - in production you'd use public relays
  const relay = new NostrRelay(3000);
  await relay.start();
  console.log("Started ephemeral relay at:", relay.url);

  const relays = [relay.url];

  // Generate test keypairs
  console.log("\nGenerating keypairs...");
  const userKeypair = await generateKeypair();
  const signerKeypair = await generateKeypair();

  console.log(`User public key (for signing): ${userKeypair.publicKey}`);
  console.log(
    `Signer public key (for communication): ${signerKeypair.publicKey}`,
  );

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
  console.log(`(Contains remote-signer-pubkey: ${signerKeypair.publicKey})`);

  // Create a client with debug logging
  console.log("\nCreating client...");
  const client = new SimpleNIP46Client(relays);
  client.setLogLevel(LogLevel.DEBUG);

  try {
    // Connect to the bunker
    console.log("Connecting to bunker...");
    const connectResult = await client.connect(connectionString);
    console.log(`Connected successfully! Result: ${connectResult}`);

    // Get the user's public key from the bunker (required after connect)
    console.log("\nGetting user public key from bunker...");
    const userPubkey = await client.getPublicKey();
    console.log("User public key from bunker:", userPubkey);
    console.log(
      "Matches original user key:",
      userPubkey === userKeypair.publicKey ? "Yes" : "No",
    );
    console.log(
      "Different from signer key:",
      userPubkey !== signerKeypair.publicKey ? "Yes" : "No",
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
    console.log(
      `Event signed with user pubkey: ${signedEvent.pubkey === userPubkey ? "Yes" : "No"}`,
    );

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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error in NIP-04 demo:", error.message);
      } else {
        console.error("Unknown error in NIP-04 demo:", error);
      }
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
    } catch (error: unknown) {
      if (error instanceof NIP46Error) {
        console.log(
          "Failed to sign unauthorized event (expected):",
          error.message,
        );
      } else if (error instanceof Error) {
        console.log(
          "Failed to sign unauthorized event (expected):",
          error.message,
        );
      } else {
        console.log("Unknown error when signing unauthorized event:", error);
      }
    }
  } catch (error: unknown) {
    if (error instanceof NIP46Error) {
      console.error("NIP46 Error in demo:", error.message);
    } else if (error instanceof Error) {
      console.error("Error in demo:", error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.error("Unknown error in demo:", error);
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

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error("Unhandled error:", error);
  } else {
    console.error("Unhandled unknown error:", error);
  }
});
