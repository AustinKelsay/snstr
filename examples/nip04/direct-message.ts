/**
 * NIP-04 Direct Message Example
 *
 * This example demonstrates how to use the NIP-04 encrypted direct messaging functionality.
 * NIP-04 uses ECDH (Elliptic Curve Diffie-Hellman) to create a shared secret between
 * the sender and recipient, then encrypts the message with AES-256-CBC.
 *
 * Key implementation details:
 * - Uses HMAC-SHA256 with the key "nip04" for shared secret derivation
 * - This approach ensures compatibility with nip04 spec compliant nostr libraries and clients
 * - The shared secret is derived from the X coordinate of the ECDH shared point
 *
 * Note: NIP-04 is considered less secure than NIP-44 and has been marked as "unrecommended"
 * in favor of NIP-44. It's provided here for compatibility with older clients.
 */

import { encrypt, decrypt, getSharedSecret, NIP04DecryptionError } from "../../src/nip04";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";

async function main() {
  try {
    console.log("NIP-04 Encryption Example\n");

    // Generate keys for Alice and Bob
    console.log("Generating keypairs...");
    
    // Generate random keypairs for Alice and Bob
    const alicePrivateKey = secp256k1.utils.randomPrivateKey();
    const alicePublicKey = bytesToHex(secp256k1.getPublicKey(alicePrivateKey, true).slice(1));
    
    const bobPrivateKey = secp256k1.utils.randomPrivateKey();
    const bobPublicKey = bytesToHex(secp256k1.getPublicKey(bobPrivateKey, true).slice(1));

    console.log(`Alice's public key: ${alicePublicKey.slice(0, 8)}...`);
    console.log(`Bob's public key: ${bobPublicKey.slice(0, 8)}...`);

    // The message Alice wants to send to Bob
    const message = "Hello Bob! This is a secret message that only you can read.";
    console.log(`\nOriginal message: "${message}"`);

    // Alice encrypts a message for Bob using NIP-04
    console.log("\nAlice encrypting message for Bob...");
    const encryptedMessage = encrypt(
      message,
      bytesToHex(alicePrivateKey),
      bobPublicKey,
    );
    console.log(`Encrypted message: ${encryptedMessage}`);

    // Simulate transmission over a Nostr network
    console.log("\nMessage would be transmitted in a Nostr Event of kind 4 (encrypted direct message)");
    console.log("Event structure would look like:");
    console.log({
      kind: 4,
      pubkey: alicePublicKey,
      tags: [["p", bobPublicKey]],
      content: encryptedMessage,
      created_at: Math.floor(Date.now() / 1000),
    });

    // Bob decrypts the message from Alice using NIP-04
    console.log("\nBob decrypting message from Alice...");
    const decryptedMessage = decrypt(
      encryptedMessage,
      bytesToHex(bobPrivateKey),
      alicePublicKey,
    );
    console.log(`Decrypted message: "${decryptedMessage}"`);

    // Demonstrate how the shared secret is the same in both directions
    console.log("\nShared Secret Demonstration:");
    const aliceSecret = getSharedSecret(
      bytesToHex(alicePrivateKey),
      bobPublicKey,
    );
    const bobSecret = getSharedSecret(
      bytesToHex(bobPrivateKey),
      alicePublicKey,
    );

    console.log("Alice's computed shared secret (first 8 bytes):");
    console.log(bytesToHex(aliceSecret.slice(0, 8)));

    console.log("Bob's computed shared secret (first 8 bytes):");
    console.log(bytesToHex(bobSecret.slice(0, 8)));

    // Check if the shared secrets are identical
    const secretsMatch = bytesToHex(aliceSecret) === bytesToHex(bobSecret);
    console.log(`\nShared secrets match: ${secretsMatch ? "Yes" : "No"}`);

    if (!secretsMatch) {
      console.error(
        "Error: Shared secrets do not match! This should never happen.",
      );
    }

    // Demonstrate error handling for malformed messages
    console.log("\n=== Error Handling Demonstration ===");
    console.log("Attempting to decrypt various malformed messages...");

    const malformedMessages = [
      { type: "No IV separator", message: "malformedmessage" },
      { type: "Multiple IV separators", message: "part1?iv=part2?iv=part3" },
      { type: "Empty ciphertext", message: "?iv=validIV" },
      { type: "Empty IV", message: "validciphertext?iv=" },
      { type: "Invalid base64 ciphertext", message: "invalid!base64?iv=aGVsbG8=" },
      { type: "Invalid base64 IV", message: `${encryptedMessage.split("?iv=")[0]}?iv=invalid!iv!` },
      { type: "Incorrect IV length", message: `${encryptedMessage.split("?iv=")[0]}?iv=aGVsbG8=` }, // "hello" in base64
    ];

    for (const { type, message } of malformedMessages) {
      try {
        console.log(`\nTrying to decrypt: ${type}`);
        console.log(`Message: ${message}`);
        
        const result = decrypt(
          message,
          bytesToHex(bobPrivateKey),
          alicePublicKey,
        );
        
        console.log(`Unexpected success! Decrypted: ${result}`);
      } catch (error) {
        if (error instanceof NIP04DecryptionError) {
          console.log(`✓ Correctly rejected with error: ${error.message}`);
        } else {
          console.error(`Unexpected error type: ${error}`);
        }
      }
    }

    console.log("\nComplete!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
