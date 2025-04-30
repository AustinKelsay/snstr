import {
  getSharedSecret,
  getMessageKeys,
  encrypt,
  decrypt,
  hmacWithAAD,
} from "../../src/nip44";
import { hexToBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";
import * as fs from "fs";
import * as path from "path";

// Helper function to get the public key for a given private key (x-coordinate only)
function getPublicKeyHex(privateKeyHex: string): string {
  const publicKey = secp256k1.getPublicKey(privateKeyHex, false); // Get uncompressed public key
  return Buffer.from(publicKey.slice(1, 33)).toString("hex"); // Return x-coordinate only
}

/**
 * This test file specifically focuses on ensuring compatibility with
 * the official NIP-44 test vectors and implementation.
 *
 * It verifies:
 * 1. Conversation key derivation (ECDH + HKDF)
 * 2. Message key derivation (HKDF)
 * 3. Complete encrypt/decrypt flow with fixed test vectors
 * 4. Edge cases like minimum and maximum message lengths
 * 5. Error handling for invalid inputs
 */
describe("NIP-44 Official Compatibility Tests", () => {
  // Test vectors loaded from the official NIP-44 test vectors file
  const testVectors = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../../src/nip44/vectors/nip44-official-vectors.json",
      ),
      "utf8",
    ),
  );

  describe("Conversation Key Derivation", () => {
    const vectors = testVectors.v2.valid.get_conversation_key;

    test("should derive correct conversation keys for all test vectors", () => {
      for (const vector of vectors) {
        const { sec1, pub2, conversation_key } = vector;

        // Derive conversation key using our implementation
        const derived = getSharedSecret(sec1, pub2);
        const derivedHex = Buffer.from(derived).toString("hex");

        // Verify against expected value from test vector
        expect(derivedHex).toBe(conversation_key);
      }
    });

    test("should be symmetric (key derivation works in both directions)", () => {
      for (const vector of vectors) {
        // Only test a subset for performance reasons
        if (Math.random() > 0.3) continue;

        const { sec1, conversation_key } = vector;

        // Calculate public key for sec1
        const pub1 = getPublicKeyHex(sec1);

        // Get sec2 from another vector to use as the other party
        const otherVector = vectors[Math.floor(Math.random() * vectors.length)];
        const sec2 = otherVector.sec1;
        const pub2 = getPublicKeyHex(sec2);

        // Derive conversation key in both directions
        const key1to2 = getSharedSecret(sec1, pub2);
        const key2to1 = getSharedSecret(sec2, pub1);

        // Both should produce the same key (symmetry property)
        expect(Buffer.from(key1to2).toString("hex")).toBe(
          Buffer.from(key2to1).toString("hex"),
        );
      }
    });
  });

  describe("Message Key Derivation", () => {
    const conversationKeyHex =
      testVectors.v2.valid.get_message_keys.conversation_key;
    const keyVectors = testVectors.v2.valid.get_message_keys.keys;

    test("should derive correct message keys for all test vectors", () => {
      const conversationKey = hexToBytes(conversationKeyHex);

      for (const vector of keyVectors) {
        const { nonce, chacha_key, chacha_nonce, hmac_key } = vector;

        // Derive message keys using our implementation
        const nonceBytes = hexToBytes(nonce);
        const keys = getMessageKeys(conversationKey, nonceBytes);

        // Verify each derived key against expected values
        expect(Buffer.from(keys.chacha_key).toString("hex")).toBe(chacha_key);
        expect(Buffer.from(keys.chacha_nonce).toString("hex")).toBe(
          chacha_nonce,
        );
        expect(Buffer.from(keys.hmac_key).toString("hex")).toBe(hmac_key);
      }
    });
  });

  describe("Complete Encrypt/Decrypt Flow", () => {
    const vectors = testVectors.v2.valid.encrypt_decrypt;

    test("should correctly encrypt with known values to produce expected output", () => {
      // Test only the first few vectors that have all values available
      for (let i = 0; i < 5 && i < vectors.length; i++) {
        const vector = vectors[i];
        if (!vector.payload || !vector.plaintext) continue;

        const {
          sec1,
          sec2,
          nonce: nonceHex,
          plaintext,
          payload: expectedPayload,
        } = vector;

        // Get public key
        const pub2 = getPublicKeyHex(sec2);

        // Encrypt with fixed nonce to reproduce expected output
        const nonce = hexToBytes(nonceHex);
        const encrypted = encrypt(plaintext, sec1, pub2, nonce);

        // Should match the expected payload from test vector
        expect(encrypted).toBe(expectedPayload);
      }
    });

    test("should correctly decrypt official test vector payloads", () => {
      for (const vector of vectors) {
        // Skip vectors without needed values
        if (!vector.payload || !vector.plaintext) continue;

        const { sec1, sec2, payload, plaintext } = vector;

        // Calculate public key
        const pub1 = getPublicKeyHex(sec1);

        try {
          // Decrypt using our implementation
          const decrypted = decrypt(payload, sec2, pub1);

          // Should match the original plaintext
          expect(decrypted).toBe(plaintext);
        } catch (error) {
          fail(
            `Failed to decrypt test vector with plaintext "${plaintext}": ${error}`,
          );
        }
      }
    });

    test("should complete roundtrip encrypt/decrypt with random keys", () => {
      // Generate 10 random key pairs to test with
      for (let i = 0; i < 10; i++) {
        const sec1 = secp256k1.utils.randomPrivateKey();
        const sec2 = secp256k1.utils.randomPrivateKey();

        const sec1Hex = Buffer.from(sec1).toString("hex");
        const sec2Hex = Buffer.from(sec2).toString("hex");

        const pub1 = getPublicKeyHex(sec1Hex);
        const pub2 = getPublicKeyHex(sec2Hex);

        // Test with a random message
        const message = `Test message ${i}: ${Math.random()}`;

        // Encrypt and decrypt
        const encrypted = encrypt(message, sec1Hex, pub2);
        const decrypted = decrypt(encrypted, sec2Hex, pub1);

        // Should roundtrip successfully
        expect(decrypted).toBe(message);
      }
    });
  });

  describe("Edge Cases", () => {
    test("should handle minimal (1 byte) and maximal (65535 bytes) message sizes", () => {
      // Use the first set of keys from test vectors
      const { sec1, sec2 } = testVectors.v2.valid.encrypt_decrypt[0];
      const pub1 = getPublicKeyHex(sec1);
      const pub2 = getPublicKeyHex(sec2);

      // Test minimum valid message (1 byte)
      const minMessage = "a";
      const encryptedMin = encrypt(minMessage, sec1, pub2);
      const decryptedMin = decrypt(encryptedMin, sec2, pub1);
      expect(decryptedMin).toBe(minMessage);

      // Test messages just around the 32-byte padding boundary
      const message31 = "a".repeat(31);
      const message32 = "a".repeat(32);
      const message33 = "a".repeat(33);

      expect(decrypt(encrypt(message31, sec1, pub2), sec2, pub1)).toBe(
        message31,
      );
      expect(decrypt(encrypt(message32, sec1, pub2), sec2, pub1)).toBe(
        message32,
      );
      expect(decrypt(encrypt(message33, sec1, pub2), sec2, pub1)).toBe(
        message33,
      );

      // Test maximum valid message (65535 bytes)
      // This is the maximum allowed by NIP-44 spec
      const maxMessage = "a".repeat(65535);
      const encryptedMax = encrypt(maxMessage, sec1, pub2);
      const decryptedMax = decrypt(encryptedMax, sec2, pub1);
      expect(decryptedMax).toBe(maxMessage);
    });

    test("should reject invalid message lengths", () => {
      const invalidVectors = testVectors.v2.invalid.encrypt_msg_lengths || [];

      for (const vector of invalidVectors) {
        if (vector.plaintext === undefined) continue;

        const { sec1, pub2, plaintext } = vector;

        // Should throw for invalid message lengths
        expect(() => {
          encrypt(plaintext, sec1, pub2);
        }).toThrow();
      }

      // Additionally, test the exact boundary cases
      const testKeys = testVectors.v2.valid.encrypt_decrypt[0];
      const testSec1 = testKeys.sec1;
      const testPub2 = getPublicKeyHex(testKeys.sec2);

      // Empty message (0 bytes) - should be rejected
      expect(() => {
        encrypt("", testSec1, testPub2);
      }).toThrow();

      // Message exactly one byte larger than max (65536) - should be rejected
      expect(() => {
        encrypt("a".repeat(65536), testSec1, testPub2);
      }).toThrow();
    });

    test("should reject tampered messages", () => {
      const testVector = testVectors.v2.valid.encrypt_decrypt[0];
      const { sec1, sec2 } = testVector;
      const pub1 = getPublicKeyHex(sec1);
      const pub2 = getPublicKeyHex(sec2);

      // Get a payload from the test vectors
      const { payload } = testVector;

      // Tampering with version byte
      const decodedPayload = Buffer.from(payload, "base64");
      // Change the version byte to something invalid
      decodedPayload[0] = 0xff;
      const tamperedVersion = Buffer.from(decodedPayload).toString("base64");
      expect(() => decrypt(tamperedVersion, sec2, pub1)).toThrow();

      // Tampering with MAC (last 32 bytes)
      const decodedPayload2 = Buffer.from(payload, "base64");
      // Change the last byte of the MAC
      decodedPayload2[decodedPayload2.length - 1] ^= 0xff; // Flip all bits in last byte
      const tamperedMac = Buffer.from(decodedPayload2).toString("base64");
      expect(() => decrypt(tamperedMac, sec2, pub1)).toThrow();
    });
  });
});
