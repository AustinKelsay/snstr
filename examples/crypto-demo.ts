import {
  generateKeypair,
  getPublicKey,
  encryptNIP04,
  decryptNIP04,
  getNIP04SharedSecret,
} from "../src";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Demo of the Nostr cryptography functions
 *
 * This script demonstrates:
 * 1. Generating keypairs
 * 2. Encryption/decryption with NIP-04
 * 3. How shared secrets work
 */
async function main() {
  try {
    // 1. Generate keypairs
    console.log("Generating keypairs...");

    // Alice's keypair
    const aliceKeypair = await generateKeypair();
    console.log(
      `Alice's private key: ${aliceKeypair.privateKey.slice(0, 8)}...`,
    );
    console.log(
      `Alice's public key:  ${aliceKeypair.publicKey.slice(0, 8)}...`,
    );

    // Bob's keypair
    const bobKeypair = await generateKeypair();
    console.log(`Bob's private key:   ${bobKeypair.privateKey.slice(0, 8)}...`);
    console.log(`Bob's public key:    ${bobKeypair.publicKey.slice(0, 8)}...`);

    // Eve is eavesdropping
    const eveKeypair = await generateKeypair();
    console.log(`Eve's private key:   ${eveKeypair.privateKey.slice(0, 8)}...`);
    console.log(`Eve's public key:    ${eveKeypair.publicKey.slice(0, 8)}...`);

    // 2. NIP-04 Encryption/Decryption
    console.log("\n----- NIP-04 Encryption Demo -----");

    // Alice wants to send a private message to Bob
    const message = "Hello Bob! This is a secret message from Alice.";
    console.log(`\nOriginal message: "${message}"`);

    // Alice encrypts the message using her private key and Bob's public key
    const encryptedMessage = await encryptNIP04(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    console.log(`\nEncrypted message: ${encryptedMessage}`);

    // Bob receives the message and decrypts it using his private key and Alice's public key
    console.log("\nBob decrypts the message...");
    const decryptedMessage = await decryptNIP04(
      encryptedMessage,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted message: "${decryptedMessage}"`);

    // Even if Eve intercepts the message, she cannot decrypt it without Bob's private key
    console.log("\nEve tries to decrypt the message...");
    try {
      const eveDecryption = await decryptNIP04(
        encryptedMessage,
        eveKeypair.privateKey,
        aliceKeypair.publicKey,
      );
      console.log(`Eve decrypted: "${eveDecryption}"`);
    } catch (error) {
      console.log("Eve failed to decrypt the message!");
    }

    // 3. Shared Secret Demo
    console.log("\n----- Shared Secret Demo -----");

    // Alice and Bob compute a shared secret (should be the same value)
    const aliceSharedSecret = getNIP04SharedSecret(
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );

    const bobSharedSecret = getNIP04SharedSecret(
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );

    // Convert to hex for display
    const aliceHex = bytesToHex(aliceSharedSecret);
    const bobHex = bytesToHex(bobSharedSecret);

    console.log("\nShared secret computed by Alice:");
    console.log(aliceHex.slice(0, 32) + "...");

    console.log("\nShared secret computed by Bob:");
    console.log(bobHex.slice(0, 32) + "...");

    // Verify they match (they should always match)
    if (aliceHex === bobHex) {
      console.log("\n✅ Success! Shared secrets match.");
    } else {
      console.log("\n❌ Error! Shared secrets do not match.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
