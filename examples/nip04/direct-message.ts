/**
 * NIP-04 Direct Message Example
 *
 * This example demonstrates how to use the NIP-04 encrypted direct messaging functionality.
 * NIP-04 uses ECDH (Elliptic Curve Diffie-Hellman) to create a shared secret between
 * the sender and recipient, then encrypts the message with AES-256-CBC.
 *
 * Note: NIP-04 is considered less secure than NIP-44 and has been marked as "unrecommended"
 * in favor of NIP-44. It's provided here for compatibility with older clients.
 */

import {
  generateKeypair,
  encryptNIP04,
  decryptNIP04,
  getNIP04SharedSecret,
} from "../../src";

async function main() {
  try {
    console.log("NIP-04 Encryption Example\n");

    // Generate keys for Alice and Bob
    console.log("Generating keypairs...");
    const aliceKeypair = await generateKeypair();
    const bobKeypair = await generateKeypair();

    console.log(`Alice's public key: ${aliceKeypair.publicKey.slice(0, 8)}...`);
    console.log(`Bob's public key: ${bobKeypair.publicKey.slice(0, 8)}...`);

    // The message Alice wants to send to Bob
    const message =
      "Hello Bob! This is a secret message that only you can read.";
    console.log(`\nOriginal message: "${message}"`);

    // Alice encrypts a message for Bob using NIP-04
    console.log("\nAlice encrypting message for Bob...");
    const encryptedMessage = encryptNIP04(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    console.log(`Encrypted message: ${encryptedMessage}`);

    // Bob decrypts the message from Alice using NIP-04
    console.log("\nBob decrypting message from Alice...");
    const decryptedMessage = decryptNIP04(
      encryptedMessage,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted message: "${decryptedMessage}"`);

    // Demonstrate how the shared secret is the same in both directions
    console.log("\nShared Secret Demonstration:");
    const aliceSecret = getNIP04SharedSecret(
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    const bobSecret = getNIP04SharedSecret(
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );

    console.log("Alice's computed shared secret (first 8 bytes):");
    console.log(Buffer.from(aliceSecret.slice(0, 8)).toString("hex"));

    console.log("Bob's computed shared secret (first 8 bytes):");
    console.log(Buffer.from(bobSecret.slice(0, 8)).toString("hex"));

    // Check if the shared secrets are identical
    const secretsMatch =
      Buffer.from(aliceSecret).toString("hex") ===
      Buffer.from(bobSecret).toString("hex");
    console.log(`\nShared secrets match: ${secretsMatch ? "Yes" : "No"}`);

    if (!secretsMatch) {
      console.error(
        "Error: Shared secrets do not match! This should never happen.",
      );
    }

    console.log("\nComplete!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
