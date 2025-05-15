/**
 * NIP-44 Test Vectors Demo
 *
 * This script loads and verifies test vectors from the NIP-44 official test vectors.
 * It demonstrates:
 * 1. Shared secret derivation
 * 2. Message key derivation
 * 3. Encryption and decryption
 * 4. Version compatibility (v0, v1, v2)
 */

import {
  encrypt,
  decrypt,
  getSharedSecret,
  decodePayload,
  getMessageKeys,
} from "../../src/nip44";
import { hexToBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";
import * as fs from "fs";
import * as path from "path";

// Load the full test vectors
const testVectors = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src/nip44/vectors/nip44-official-vectors.json"),
    "utf8",
  ),
);

// Helper function to get the public key for a given private key
function getPublicKeyHex(privateKeyHex: string): string {
  const publicKey = secp256k1.getPublicKey(privateKeyHex, false); // Get uncompressed public key
  return Buffer.from(publicKey.slice(1, 33)).toString("hex"); // Return x-coordinate only
}

async function runVectors() {
  console.log("🔍 NIP-44 Official Test Vectors Verification");
  console.log("==========================================\n");

  // 1. Test conversation key derivation with various vectors
  console.log("Testing conversation key derivation...");
  const conversationVectors = testVectors.v2.valid.get_conversation_key;
  let passedCount = 0;

  for (let i = 0; i < Math.min(5, conversationVectors.length); i++) {
    const vector = conversationVectors[i];
    const { sec1, pub2, conversation_key } = vector;

    try {
      const derivedKey = getSharedSecret(sec1, pub2);
      const derivedKeyHex = Buffer.from(derivedKey).toString("hex");
      const passed = derivedKeyHex === conversation_key;

      if (passed) {
        passedCount++;
      } else {
        console.log(`\nFailed vector ${i + 1}:`);
        console.log(`  sec1: ${sec1.substring(0, 10)}...`);
        console.log(`  pub2: ${pub2.substring(0, 10)}...`);
        console.log(`  Expected: ${conversation_key.substring(0, 10)}...`);
        console.log(`  Got:      ${derivedKeyHex.substring(0, 10)}...`);
      }
    } catch (error) {
      console.log(`\nException on vector ${i + 1}:`, error);
    }
  }

  console.log(
    `Conversation key derivation: ${passedCount}/${Math.min(5, conversationVectors.length)} tests passed\n`,
  );

  // 2. Test message key derivation
  console.log("Testing message key derivation...");
  if (testVectors.v2.valid.get_message_keys) {
    const messageKeyBase = testVectors.v2.valid.get_message_keys;
    const conversationKey = messageKeyBase.conversation_key;
    const keyDerivations = messageKeyBase.keys;

    let messageKeysPassed = 0;

    for (let i = 0; i < Math.min(3, keyDerivations.length); i++) {
      const vector = keyDerivations[i];
      const { nonce, chacha_key, chacha_nonce, hmac_key } = vector;

      try {
        const conversationKeyBytes = hexToBytes(conversationKey);
        const nonceBytes = hexToBytes(nonce);
        const keys = getMessageKeys(conversationKeyBytes, nonceBytes);

        const derivedChachaKey = Buffer.from(keys.chacha_key).toString("hex");
        const derivedChachaNonce = Buffer.from(keys.chacha_nonce).toString(
          "hex",
        );
        const derivedHmacKey = Buffer.from(keys.hmac_key).toString("hex");

        const keysMatch =
          derivedChachaKey === chacha_key &&
          derivedChachaNonce === chacha_nonce &&
          derivedHmacKey === hmac_key;

        if (keysMatch) {
          messageKeysPassed++;
        } else {
          console.log(`\nFailed message key vector ${i + 1}:`);
          if (derivedChachaKey !== chacha_key) {
            console.log(
              `  Expected chacha_key: ${chacha_key.substring(0, 10)}...`,
            );
            console.log(
              `  Got chacha_key:      ${derivedChachaKey.substring(0, 10)}...`,
            );
          }
          if (derivedChachaNonce !== chacha_nonce) {
            console.log(`  Expected chacha_nonce: ${chacha_nonce}`);
            console.log(`  Got chacha_nonce:      ${derivedChachaNonce}`);
          }
          if (derivedHmacKey !== hmac_key) {
            console.log(`  Expected hmac_key: ${hmac_key.substring(0, 10)}...`);
            console.log(
              `  Got hmac_key:      ${derivedHmacKey.substring(0, 10)}...`,
            );
          }
        }
      } catch (error) {
        console.log(`\nException on message key vector ${i + 1}:`, error);
      }
    }

    console.log(
      `Message key derivation: ${messageKeysPassed}/${Math.min(3, keyDerivations.length)} tests passed\n`,
    );
  } else {
    console.log("No message key vectors found in test data\n");
  }

  // 3. Test encryption and decryption
  console.log("Testing encryption and decryption...");
  if (testVectors.v2.valid.encrypt_decrypt) {
    const encryptDecryptVectors = testVectors.v2.valid.encrypt_decrypt;
    let encryptDecryptPassed = 0;

    for (let i = 0; i < Math.min(3, encryptDecryptVectors.length); i++) {
      const vector = encryptDecryptVectors[i];
      if (!vector.plaintext || !vector.sec1 || !vector.sec2) continue;

      const { sec1, sec2, plaintext, payload } = vector;
      const pub1 = getPublicKeyHex(sec1);

      try {
        // Test decryption of reference payload
        if (payload) {
          const decrypted = decrypt(payload, sec2, pub1);
          if (decrypted === plaintext) {
            encryptDecryptPassed++;
            console.log(
              `Vector ${i + 1}: Decryption successful - "${plaintext}"`,
            );
          } else {
            console.log(`\nVector ${i + 1}: Decryption produced wrong result:`);
            console.log(`  Expected: "${plaintext}"`);
            console.log(`  Got:      "${decrypted}"`);
          }
        }

        // Test our own encryption/decryption roundtrip
        const pub2 = getPublicKeyHex(sec2);
        const ourEncrypted = encrypt(plaintext, sec1, pub2);
        const ourDecrypted = decrypt(ourEncrypted, sec2, pub1);

        if (ourDecrypted === plaintext) {
          console.log(
            `Vector ${i + 1}: Our encryption/decryption roundtrip successful`,
          );
        } else {
          console.log(
            `\nVector ${i + 1}: Our encryption/decryption roundtrip failed:`,
          );
          console.log(`  Expected: "${plaintext}"`);
          console.log(`  Got:      "${ourDecrypted}"`);
        }
      } catch (error) {
        console.log(`\nException on vector ${i + 1}:`, error);
      }
    }

    console.log(
      `Encryption/decryption: ${encryptDecryptPassed}/${Math.min(3, encryptDecryptVectors.length)} tests passed\n`,
    );
  } else {
    console.log("No encryption/decryption vectors found in test data\n");
  }

  // 4. Test version compatibility
  console.log("Testing version compatibility...");

  // Simple vector for testing all versions
  const simpleVector = {
    sec1: "0000000000000000000000000000000000000000000000000000000000000001",
    sec2: "0000000000000000000000000000000000000000000000000000000000000002",
    plaintext: "Hello, Nostr!",
  };

  // Calculate public keys
  const pub1 = getPublicKeyHex(simpleVector.sec1);
  const pub2 = getPublicKeyHex(simpleVector.sec2);

  // Test encryption/decryption with each version
  for (const version of [0, 1, 2]) {
    try {
      // Encrypt with specific version
      const encrypted = encrypt(
        simpleVector.plaintext,
        simpleVector.sec1,
        pub2,
        undefined, // No specific nonce
        { version }, // Specify version
      );

      // Verify the version in the payload
      const decoded = decodePayload(encrypted);
      const versionMatches = decoded.version === version;

      // Decrypt the payload
      const decrypted = decrypt(encrypted, simpleVector.sec2, pub1);
      const decryptionWorks = decrypted === simpleVector.plaintext;

      if (versionMatches && decryptionWorks) {
        console.log(
          `Version ${version}: Encryption and decryption successful ✅`,
        );
      } else {
        console.log(`Version ${version}: Test failed ❌`);
        if (!versionMatches) {
          console.log(
            `  - Version mismatch: expected ${version}, got ${decoded.version}`,
          );
        }
        if (!decryptionWorks) {
          console.log(
            `  - Decryption failed: expected "${simpleVector.plaintext}", got "${decrypted}"`,
          );
        }
      }
    } catch (error) {
      console.log(`Version ${version}: Exception:`, error);
    }
  }

  // 5. Demonstrate a specific vector in detail
  console.log("\nDetailed examination of a specific vector:");
  const specificVector = testVectors.v2.valid.encrypt_decrypt[0];

  if (specificVector) {
    const { sec1, sec2, plaintext, payload } = specificVector;

    if (sec1 && sec2 && plaintext && payload) {
      const pub1 = getPublicKeyHex(sec1);
      const pub2 = getPublicKeyHex(sec2);

      console.log(`pub1 (from sec1): ${pub1}`);
      console.log(`pub2 (from sec2): ${pub2}`);

      // Derive and check shared secret
      const sharedSecret = getSharedSecret(sec1, pub2);
      console.log(
        `Shared secret: ${Buffer.from(sharedSecret).toString("hex").substring(0, 20)}...`,
      );

      // Decode payload
      const decodedPayload = decodePayload(payload);
      console.log(`\nDecoded payload:`);
      console.log(`- Version: ${decodedPayload.version}`);
      console.log(
        `- Nonce: ${Buffer.from(decodedPayload.nonce).toString("hex").substring(0, 20)}...`,
      );
      console.log(`- Ciphertext length: ${decodedPayload.ciphertext.length}`);
      console.log(
        `- MAC: ${Buffer.from(decodedPayload.mac).toString("hex").substring(0, 20)}...`,
      );

      try {
        // Decrypt
        const decrypted = decrypt(payload, sec2, pub1);
        console.log(`\nDecryption successful: "${decrypted}"`);
        console.log(`Matches plaintext: ${decrypted === plaintext}`);
      } catch (error) {
        console.log(`\nDecryption failed:`, error);
      }
    } else {
      console.log("Selected vector is missing required fields");
    }
  } else {
    console.log("No specific vector found for detailed examination");
  }
}

runVectors().catch(console.error);
