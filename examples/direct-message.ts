import { Nostr } from "../src";
import { NostrRelay } from "../src/utils/ephemeral-relay";

// Set this to false to use external relays instead of ephemeral relay
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== "false";

/**
 * This example demonstrates NIP-04 encrypted direct messaging between two users.
 *
 * In this scenario:
 * - Alice will send an encrypted message to Bob
 * - Bob will receive, decrypt, and display the message
 *
 * NIP-04 creates a shared secret between the sender and recipient using ECDH
 * (Elliptic Curve Diffie-Hellman) key exchange and encrypts the message with
 * AES-256-CBC.
 *
 * Note: For a more secure encryption approach, see the examples/nip44 directory.
 * NIP-44 improves upon NIP-04 by using ChaCha20 with HMAC-SHA256 authentication,
 * proper key derivation, and message padding.
 */
async function main() {
  try {
    let ephemeralRelay: NostrRelay | null = null;

    // Create two clients (Alice and Bob)
    let alice: Nostr;
    let bob: Nostr;

    if (USE_EPHEMERAL) {
      // Start an ephemeral relay on port 3002
      console.log("Starting ephemeral relay on port 3002...");
      ephemeralRelay = new NostrRelay(3002, 60); // Purge every 60 seconds
      await ephemeralRelay.start();
      console.log("Ephemeral relay started");

      // Initialize clients with the ephemeral relay
      alice = new Nostr([ephemeralRelay.url]);
      bob = new Nostr([ephemeralRelay.url]);
    } else {
      // Use public relays
      const PUBLIC_RELAYS = [
        "wss://relay.primal.net",
        "wss://relay.nostr.band",
      ];
      console.log(`Using public relays: ${PUBLIC_RELAYS.join(", ")}`);

      alice = new Nostr(PUBLIC_RELAYS);
      bob = new Nostr(PUBLIC_RELAYS);
    }

    // Generate keypairs for both clients
    console.log("Generating keypairs...");
    const aliceKeys = await alice.generateKeys();
    const bobKeys = await bob.generateKeys();

    console.log(`Alice public key: ${aliceKeys.publicKey.slice(0, 8)}...`);
    console.log(`Bob public key: ${bobKeys.publicKey.slice(0, 8)}...`);

    // Connect to relays
    console.log("Connecting to relays...");
    await Promise.all([alice.connectToRelays(), bob.connectToRelays()]);

    // Set up a subscription for Bob to receive messages
    console.log("Setting up subscription for Bob to receive messages...");
    bob.subscribe(
      [{ kinds: [4], "#p": [bobKeys.publicKey] }],
      (event, relay) => {
        try {
          const senderPubkey = event.pubkey;
          const decrypted = bob.decryptDirectMessage(event);

          console.log(`\nBob received encrypted message from ${relay}:`);
          console.log(`  ID: ${event.id.slice(0, 8)}...`);
          console.log(`  Sender: ${senderPubkey.slice(0, 8)}...`);
          console.log(`  Encrypted content: ${event.content.slice(0, 20)}...`);
          console.log(`  Decrypted content: ${decrypted}`);
          console.log("---");
        } catch (error) {
          console.error("Failed to decrypt message:", error);
        }
      },
    );

    // Alice sends an encrypted message to Bob
    console.log("\nAlice sending encrypted message to Bob...");
    const message =
      "Hello Bob! This is a secret message that only you can read.";
    const dmEvent = await alice.publishDirectMessage(
      message,
      bobKeys.publicKey,
    );

    if (dmEvent) {
      console.log(`Alice sent message with ID: ${dmEvent.id}`);
      // The message is automatically validated according to NIP-01:
      // - Structure validation (all required fields present with correct types)
      // - Event ID matches the SHA-256 hash of the serialized event data
      // - Signature verification (signature is valid for the event ID)
      // - Timestamp validation (not too far in the future)
      console.log("✓ Message passed NIP-01 compliant validation");
    } else {
      console.log("Failed to send message");
    }

    // Wait for a few seconds to receive the message
    console.log("\nWaiting for 3 seconds to receive messages...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Clean up
    console.log("Cleaning up...");
    alice.disconnectFromRelays();
    bob.disconnectFromRelays();

    if (ephemeralRelay) {
      console.log("Shutting down ephemeral relay...");
      ephemeralRelay.close();
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
