import {
  generateKeypair,
  encryptNIP44,
  decryptNIP44,
  generateNIP44Nonce as generateNonce,
} from "../../src";

import { constantTimeEqual } from "../../src/nip44";

async function main() {
  console.log("🔒 NIP-44 Encryption Demo");
  console.log("====================\n");

  // Generate keypairs for Alice and Bob
  console.log("Generating keypairs for Alice and Bob...");
  const aliceKeypair = await generateKeypair();
  const bobKeypair = await generateKeypair();

  console.log(`Alice's public key: ${aliceKeypair.publicKey}`);
  console.log(`Bob's public key: ${bobKeypair.publicKey}\n`);

  // Messages to encrypt
  const messages = [
    "Hello Bob, this is a secret message!",
    "NIP-44 uses ChaCha20 + HMAC-SHA256 for better security!",
    "🔐 Special characters and emojis work too! こんにちは!",
    " ", // Minimum message size (1 byte)
  ];

  console.log("Encrypting and decrypting messages:");
  console.log("----------------------------------");

  for (const message of messages) {
    console.log(`\nOriginal message: "${message}"`);

    // Alice encrypts a message for Bob
    const encrypted = encryptNIP44(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    console.log(`Encrypted (base64): ${encrypted}`);

    // Bob decrypts the message from Alice
    const decrypted = decryptNIP44(
      encrypted,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted: "${decrypted}"`);
    console.log(`Successful decryption: ${message === decrypted}`);
  }

  // Demonstrate the minimum message length requirement
  console.log("\n\nDemonstrating minimum message length requirement:");
  console.log("----------------------------------------------");
  console.log("NIP-44 requires messages to be at least 1 byte in length.");

  try {
    console.log("Trying to encrypt an empty message:");
    encryptNIP44(
      "", // Empty message (0 bytes)
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    console.log("This should not happen - empty messages should be rejected");
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Encryption failed as expected: ${error.message}`);
    } else {
      console.log("Encryption failed as expected");
    }
  }

  // Demonstrate failed decryption with wrong keys
  console.log("\n\nDemonstrating failed decryption:");
  console.log("--------------------------------");

  // Generate a keypair for Eve (an eavesdropper)
  const eveKeypair = await generateKeypair();
  console.log(`Eve's public key: ${eveKeypair.publicKey}`);

  const message = "This message is only for Bob";
  console.log(`\nOriginal message: "${message}"`);

  // Alice encrypts a message for Bob
  const encrypted = encryptNIP44(
    message,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );
  console.log(`Encrypted (base64): ${encrypted}`);

  try {
    // Eve tries to decrypt the message using her key
    const decrypted = decryptNIP44(
      encrypted,
      eveKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(`Decrypted by Eve: "${decrypted}" (This should not happen!)`);
  } catch (error) {
    console.log("Eve failed to decrypt the message (expected)");
  }

  // Demonstrate tampered message
  console.log("\n\nDemonstrating tampered message:");
  console.log("------------------------------");

  const originalMessage = "Important financial information: send 1 BTC";
  console.log(`Original message: "${originalMessage}"`);

  const encryptedOriginal = encryptNIP44(
    originalMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  // Tamper with the encrypted message
  const tamperedEncrypted =
    encryptedOriginal.substring(0, encryptedOriginal.length - 5) + "XXXXX";
  console.log(`Tampered ciphertext: ${tamperedEncrypted}`);

  try {
    const decryptedTampered = decryptNIP44(
      tamperedEncrypted,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );
    console.log(
      `Decrypted tampered message: "${decryptedTampered}" (This should not happen!)`,
    );
  } catch (error) {
    console.log("Decryption of tampered message failed (expected)");
  }

  // Demonstrate the padding scheme
  console.log("\n\nDemonstrating padding scheme:");
  console.log("----------------------------");

  const shortMessage = "Hi";
  const longMessage =
    "This is a much longer message that will have different padding applied to it compared to the short message. The padding scheme helps conceal the exact length of messages.";

  console.log(
    `Short message (${shortMessage.length} chars): "${shortMessage}"`,
  );
  console.log(`Long message (${longMessage.length} chars): "${longMessage}"`);

  const encryptedShort = encryptNIP44(
    shortMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  const encryptedLong = encryptNIP44(
    longMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  console.log(`\nEncrypted short message length: ${encryptedShort.length}`);
  console.log(`Encrypted long message length: ${encryptedLong.length}`);
  console.log(
    "Note: The padding scheme makes short messages have a minimum encrypted size",
  );

  // NEW SECTION: Demonstrate version compatibility
  console.log("\n\nDemonstrating Version Compatibility:");
  console.log("------------------------------------");
  console.log(
    "NIP-44 supports encryption with different versions (0, 1, and 2)",
  );
  console.log("By default, messages are encrypted with version 2 (current)");
  console.log(
    "Decryption works automatically with any supported version (0, 1, 2)",
  );

  const versionCompatMessage =
    "This message demonstrates version compatibility";

  // Encrypt with default version (2)
  const defaultEncrypted = encryptNIP44(
    versionCompatMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
  );

  // Encrypt with explicit version 1
  const v1Encrypted = encryptNIP44(
    versionCompatMessage,
    aliceKeypair.privateKey,
    bobKeypair.publicKey,
    undefined, // No specific nonce
    { version: 1 }, // Explicitly use version 1
  );

  // Decrypt both messages
  const defaultDecrypted = decryptNIP44(
    defaultEncrypted,
    bobKeypair.privateKey,
    aliceKeypair.publicKey,
  );

  const v1Decrypted = decryptNIP44(
    v1Encrypted,
    bobKeypair.privateKey,
    aliceKeypair.publicKey,
  );

  console.log("\nExample: Encrypting the same message with different versions");
  console.log(
    `Default (v2) encrypted: ${defaultEncrypted.substring(0, 50)}...`,
  );
  console.log(`Version 1 encrypted: ${v1Encrypted.substring(0, 50)}...`);
  console.log(`Both decrypt correctly: ${defaultDecrypted === v1Decrypted}`);

  console.log("\nWhen to use different versions:");
  console.log("- Version 2: Use by default (most secure and current)");
  console.log(
    "- Version 0/1: Use only when explicitly needed for compatibility with older clients",
  );
  console.log(
    "For a more detailed demonstration of version compatibility, see nip44-version-compatibility.ts",
  );

  console.log("\n\nNIP-44 vs NIP-04:");
  console.log("----------------");
  console.log("1. NIP-44 uses ChaCha20 + HMAC-SHA256 instead of AES-CBC");
  console.log("2. NIP-44 includes authentication (tamper resistance)");
  console.log("3. NIP-44 has a version byte for future upgradability");
  console.log("4. NIP-44 uses HKDF for key derivation");
  console.log("5. NIP-44 uses padding to help conceal message length");
  console.log(
    "6. NIP-44 payload is versioned, allowing future encryption improvements",
  );
  console.log(
    "7. NIP-44 supports multiple versions (0, 1, 2) for decryption, ensuring backward compatibility",
  );

  // Demonstrate secure constant-time comparison
  demonstrateConstantTimeComparison();
}

// Demonstrate secure constant-time comparison
function demonstrateConstantTimeComparison() {
  console.log("\n=== Demonstrating Constant-Time Comparison ===");
  console.log(
    "This is an important security feature for comparing MACs and other cryptographic values",
  );

  // Generate some test data
  console.log("\nGenerating test data...");
  const nonce1 = generateNonce();
  const nonce2 = generateNonce();
  const nonce3 = new Uint8Array(nonce1); // Create a copy of nonce1

  // Perform comparisons
  console.log("\nComparing nonce values using constant-time equality check:");

  const result1 = constantTimeEqual(nonce1, nonce2);
  console.log(
    `Comparison of two different nonces: ${result1 === 1 ? "EQUAL" : "NOT EQUAL"}`,
  );

  const result2 = constantTimeEqual(nonce1, nonce3);
  console.log(
    `Comparison of identical nonces: ${result2 === 1 ? "EQUAL" : "NOT EQUAL"}`,
  );

  // Explain why this is important
  console.log("\nWhy this matters:");
  console.log(
    "- Regular equality checks (a === b) can have variable timing based on where differences occur",
  );
  console.log(
    "- This timing variation can be measured by attackers to gradually determine secret values",
  );
  console.log(
    "- Constant-time equality ensures the comparison always takes the same amount of time",
  );
  console.log(
    "- This prevents timing side-channel attacks when verifying MACs, signatures, or other secrets",
  );

  console.log(
    "\nIn the NIP-44 implementation, this is used to securely validate the HMAC",
  );
  console.log(
    "without leaking information about whether partial matches occurred.",
  );
}

main().catch(console.error);
