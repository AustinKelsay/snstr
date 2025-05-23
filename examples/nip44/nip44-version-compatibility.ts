/**
 * NIP-44 Version Compatibility Demo
 *
 * This example demonstrates how to use the NIP-44 version compatibility features:
 * - Encrypting with different versions (0, 1, 2)
 * - Automatic decryption of messages from any supported version
 * - Using version options for compatibility with older clients
 */

import { generateKeypair, encryptNIP44, decryptNIP44 } from "../../src";

import { decodePayload } from "../../src/nip44";

async function main() {
  console.log("🔒 NIP-44 Version Compatibility Demo");
  console.log("===================================\n");

  // Generate keypairs for Alice and Bob
  console.log("Generating keypairs for Alice and Bob...");
  const aliceKeypair = await generateKeypair();
  const bobKeypair = await generateKeypair();

  console.log(`Alice's public key: ${aliceKeypair.publicKey}`);
  console.log(`Bob's public key: ${bobKeypair.publicKey}\n`);

  // Test message
  const message =
    "Hello, this is a test message for NIP-44 version compatibility!";

  // Demonstrate default encryption (v2)
  console.log("Default Encryption (v2):");
  console.log("------------------------");
  console.log(`Original message: "${message}"`);

  // Alice encrypts with default version (v2)
  const encryptedV2 = encryptNIP44(
    message,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  // Inspect the version byte
  const decodedV2 = decodePayload(encryptedV2);
  console.log(`Encrypted (base64): ${encryptedV2.substring(0, 50)}...`);
  console.log(`Version byte: ${decodedV2.version}`);

  // Bob decrypts the message
  const decryptedV2 = decryptNIP44(
    encryptedV2,
    bobKeypair.privateKey,
    aliceKeypair.publicKey,
  );

  console.log(`Decrypted: "${decryptedV2}"`);
  console.log(`Successful decryption: ${message === decryptedV2}\n`);

  // Demonstrate explicit v1 encryption
  console.log("Attempting Version 1 Encryption (should fail):");
  console.log("-----------------------------------------------");
  try {
    const encryptedV1 = encryptNIP44(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
      undefined, // No specific nonce
      { version: 1 }, // Specify version 1
    );
    // This part should not be reached
    const decodedV1 = decodePayload(encryptedV1);
    console.log(`Encrypted (base64): ${encryptedV1.substring(0, 50)}...`);
    console.log(`Version byte: ${decodedV1.version}`);
    const decryptedV1 = decryptNIP44(
      encryptedV1,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted: "${decryptedV1}"`);
    console.log("❌ Error: V1 encryption succeeded but should have failed!");
  } catch (error) {
    console.log("✅ Success: Encryption with version 1 failed as expected.");
    console.log(
      `   Error message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log("\n");

  // Demonstrate explicit v0 encryption
  console.log("Attempting Version 0 Encryption (should fail):");
  console.log("-----------------------------------------------");
  try {
    const encryptedV0 = encryptNIP44(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
      undefined, // No specific nonce
      { version: 0 }, // Specify version 0
    );
    // This part should not be reached
    const decodedV0 = decodePayload(encryptedV0);
    console.log(`Encrypted (base64): ${encryptedV0.substring(0, 50)}...`);
    console.log(`Version byte: ${decodedV0.version}`);
    const decryptedV0 = decryptNIP44(
      encryptedV0,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted: "${decryptedV0}"`);
    console.log("❌ Error: V0 encryption succeeded but should have failed!");
  } catch (error) {
    console.log("✅ Success: Encryption with version 0 failed as expected.");
    console.log(
      `   Error message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log("\n");

  // Cross-version compatibility test
  console.log("Cross-Version Compatibility:");
  console.log("---------------------------");
  console.log(
    "Testing if Alice and Bob can communicate with different versions",
  );

  // Alice uses v2, Bob uses v0
  console.log("\nScenario 1: Alice (v2) → Bob");
  const aliceMessage = "Hello Bob, I'm using NIP-44 v2!";
  const aliceToBob = encryptNIP44(
    aliceMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  const bobDecrypts = decryptNIP44(
    aliceToBob,
    bobKeypair.privateKey,
    aliceKeypair.publicKey,
  );

  console.log(`Alice's message: "${aliceMessage}"`);
  console.log(`Bob decrypts: "${bobDecrypts}"`);
  console.log(`Successful: ${aliceMessage === bobDecrypts}`);

  // Bob uses v0, Alice uses v2
  console.log(
    "\nScenario 2: Bob receiving a V0/V1 message (e.g., from an older client) and Alice (V2) decrypting it.",
  );
  console.log(
    "  (Decryption of V0/V1 is supported, but sending V0/V1 is not. This scenario is covered by general decryption tests.)",
  );

  // Demonstrate invalid version handling
  console.log("\nInvalid Version Handling:");
  console.log("------------------------");
  console.log("Attempting to encrypt with an unsupported version (3)");

  try {
    encryptNIP44(
      "This shouldn't work",
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
      undefined,
      { version: 3 },
    );
    console.log(
      "❌ Error: Encryption with version 3 should have failed but didn't!",
    );
  } catch (error) {
    console.log("✅ Success: Encryption with version 3 failed as expected");
    console.log(
      `Error message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Summary
  console.log("\nSummary:");
  console.log("--------");
  console.log("- Default encryption uses NIP-44 v2 (most secure)");
  console.log("- Decryption automatically works with versions 0, 1, and 2");
  console.log(
    "- NIP-44 compliant clients MUST NOT encrypt new messages with versions 0 or 1.",
  );
  console.log(
    "- Attempting to use unsupported versions (e.g., 3 or higher) for encryption will fail appropriately",
  );
  console.log(
    "- This implementation complies with NIP-44 requirement that clients:",
  );
  console.log("  * MUST include a version byte in encrypted payloads");
  console.log("  * MUST be able to decrypt versions 0 and 1");
  console.log("  * MUST NOT encrypt with version 0 (Reserved)");
  console.log("  * MUST NOT encrypt with version 1 (Deprecated and undefined)");
}

main().catch(console.error);
