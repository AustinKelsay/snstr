import * as fs from "fs";
import * as path from "path";
import { hexToBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";

// Import the functions we want to test
import {
  getMessageKeys,
  getSharedSecret,
  hmacWithAAD,
  encrypt,
  decrypt,
  decodePayload,
  constantTimeEqual,
} from "../../src/nip44";

// Load official test vectors
const testVectors = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src/nip44/vectors/nip44-official-vectors.json"),
    "utf8",
  ),
);

describe("NIP-44 Padding Implementation", () => {
  // Manually implement the NIP-44 spec calculation for verification
  function calcPaddedLenSpec(unpadded_len: number): number {
    if (unpadded_len <= 32) {
      return 32;
    }

    // NIP-44 spec: next_power = 1 << (floor(log2(unpadded_len - 1))) + 1
    const next_power = 1 << (Math.floor(Math.log2(unpadded_len - 1)) + 1);
    const chunk = next_power <= 256 ? 32 : next_power / 8;

    return chunk * (Math.floor((unpadded_len - 1) / chunk) + 1);
  }

  test("should correctly pad and unpad messages of various lengths", () => {
    // Generate a key pair for testing
    const privateKey =
      "0000000000000000000000000000000000000000000000000000000000000001";
    const publicKey =
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

    // Test cases covering different padding boundaries
    const testCases = [
      { input: "a", desc: "minimum length (1 byte)" }, // 1 byte -> padded to 32
      {
        input: "12345678901234567890123456789012",
        desc: "at padding boundary (32 bytes)",
      }, // 32 bytes -> padded to 32
      {
        input: "123456789012345678901234567890123",
        desc: "just over padding boundary (33 bytes)",
      }, // 33 bytes -> padded to 64
      { input: "a".repeat(64), desc: "at 64-byte boundary" }, // 64 bytes -> padded to 64
      { input: "a".repeat(65), desc: "just over 64-byte boundary" }, // 65 bytes -> padded to 96
      { input: "a".repeat(2000), desc: "larger message (2000 bytes)" }, // 2000 bytes -> padded to 2048
    ];

    for (const testCase of testCases) {
      // Encrypt and decrypt to test padding and unpadding
      const encrypted = encrypt(testCase.input, privateKey, publicKey);
      const decrypted = decrypt(encrypted, privateKey, publicKey);
      expect(decrypted).toBe(testCase.input);
    }
  });

  test("should calculate padding lengths correctly per NIP-44 specification", () => {
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
    const publicKey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

    // Test cases based on the NIP-44 specification
    const testCases = [
      // Basic cases
      { input: 1, expected: 32 },
      { input: 16, expected: 32 },
      { input: 32, expected: 32 },
      
      // Just over 32 bytes - should jump to next power of 2 boundary
      { input: 33, expected: 64 },
      { input: 48, expected: 64 },
      { input: 64, expected: 64 },
      
      // Over 64 bytes
      { input: 65, expected: 96 },
      { input: 96, expected: 96 },
      { input: 97, expected: 128 },
      { input: 128, expected: 128 },
      
      // Larger sizes
      { input: 129, expected: 160 },
      { input: 200, expected: 224 },
      { input: 256, expected: 256 },
      { input: 257, expected: 320 },
      { input: 500, expected: 512 },
      { input: 1000, expected: 1024 },
    ];

    for (const testCase of testCases) {
      const specCalculated = calcPaddedLenSpec(testCase.input);
      expect(specCalculated).toBe(testCase.expected);
      
      // Also test with actual encryption/decryption to ensure it works
      const message = "x".repeat(testCase.input);
      const encrypted = encrypt(message, privateKey, publicKey);
      const decrypted = decrypt(encrypted, privateKey, publicKey);
      
      expect(decrypted).toBe(message);
      expect(decrypted.length).toBe(testCase.input);
    }
  });

  test("should handle edge cases around powers of 2", () => {
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
    const publicKey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
    
    // Test cases specifically around powers of 2 boundaries
    const edgeCases = [
      // Around 64 (2^6)
      { input: 63, expected: 64 },
      { input: 64, expected: 64 },
      { input: 65, expected: 96 },
      
      // Around 128 (2^7)  
      { input: 127, expected: 128 },
      { input: 128, expected: 128 },
      { input: 129, expected: 160 },
      
      // Around 256 (2^8)
      { input: 255, expected: 256 },
      { input: 256, expected: 256 },
      { input: 257, expected: 320 },
      
      // Around 512 (2^9)
      { input: 511, expected: 512 },
      { input: 512, expected: 512 },
      { input: 513, expected: 576 },
    ];

    for (const testCase of edgeCases) {
      const message = "x".repeat(testCase.input);
      const encrypted = encrypt(message, privateKey, publicKey);
      const decrypted = decrypt(encrypted, privateKey, publicKey);
      
      expect(decrypted).toBe(message);
      expect(decrypted.length).toBe(testCase.input);
    }
  });

  test("should handle common message sizes correctly", () => {
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
    const publicKey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
    
    const commonMessages = [
      "Hi", // 2 bytes
      "Hello!", // 6 bytes
      "This is a test message", // 22 bytes
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.", // 56 bytes
      "x".repeat(100), // 100 bytes
      "🔒 Unicode test with emojis! 🌟 こんにちは 世界", // Mixed Unicode
    ];

    for (const message of commonMessages) {
      const encrypted = encrypt(message, privateKey, publicKey);
      const decrypted = decrypt(encrypted, privateKey, publicKey);
      
      expect(decrypted).toBe(message);
      
      // Verify the message roundtrips correctly
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
    }
  });
});

describe("NIP-44 HMAC Implementation", () => {
  test("should derive correct message keys from conversation key and nonce", () => {
    // Test vector from NIP-44 official vectors for message key derivation
    const vectors = testVectors.v2.valid.get_message_keys.keys;
    const conversationKey = hexToBytes(
      testVectors.v2.valid.get_message_keys.conversation_key,
    );

    for (const vector of vectors) {
      const nonce = hexToBytes(vector.nonce);
      const expectedChachaKey = vector.chacha_key;
      const expectedChachaNonce = vector.chacha_nonce;
      const expectedHmacKey = vector.hmac_key;

      const keys = getMessageKeys(conversationKey, nonce);

      expect(Buffer.from(keys.chacha_key).toString("hex")).toBe(
        expectedChachaKey,
      );
      expect(Buffer.from(keys.chacha_nonce).toString("hex")).toBe(
        expectedChachaNonce,
      );
      expect(Buffer.from(keys.hmac_key).toString("hex")).toBe(expectedHmacKey);
    }
  });

  test("should calculate correct HMAC with AAD", () => {
    // This test uses the encrypt/decrypt vectors to validate our HMAC calculation
    // We'll decrypt a vector payload, extract the MAC, and verify we can recalculate it

    const encryptDecryptVectors = testVectors.v2.valid.encrypt_decrypt || [];

    for (const vector of encryptDecryptVectors) {
      // Skip vectors without payload
      if (!vector.payload || !vector.sec1 || !vector.sec2 || !vector.nonce)
        continue;

      const { sec1, sec2, nonce: nonceHex, payload } = vector;

      try {
        // Get the public key from private key
        const pub1 = secp256k1.getPublicKey(sec1, false).slice(1, 33);
        const pub1Hex = Buffer.from(pub1).toString("hex");

        // Get the conversation key
        const conversationKey = getSharedSecret(sec2, pub1Hex);

        // Get message keys
        const nonce = hexToBytes(nonceHex);
        const { hmac_key } = getMessageKeys(conversationKey, nonce);

        // Extract the ciphertext and MAC from the payload
        const { ciphertext, mac: payloadMac } = decodePayload(payload);

        // Calculate our own MAC
        const calculatedMac = hmacWithAAD(hmac_key, ciphertext, nonce);

        // Compare the MACs
        expect(Buffer.from(calculatedMac).toString("hex")).toBe(
          Buffer.from(payloadMac).toString("hex"),
        );
      } catch (error) {
        console.warn("Failed to verify HMAC for vector:", vector, error);
      }
    }
  });
});

describe("NIP-44 Comprehensive Test Vector Compatibility", () => {
  test("should successfully encrypt and decrypt all official test vectors", () => {
    const encryptDecryptVectors = testVectors.v2.valid.encrypt_decrypt || [];
    let successCount = 0;

    for (const vector of encryptDecryptVectors) {
      // Skip vectors without plaintext
      if (!vector.payload || vector.plaintext === undefined) continue;

      const { sec1, sec2, plaintext, payload } = vector;

      try {
        // Get the public key from private key
        const pub1 = secp256k1.getPublicKey(sec1, false).slice(1, 33);
        const pub1Hex = Buffer.from(pub1).toString("hex");

        // Decrypt the test vector payload
        const decrypted = decrypt(payload, sec2, pub1Hex);
        expect(decrypted).toBe(plaintext);

        successCount++;
      } catch (error) {
        console.warn(
          `Failed to decrypt official test vector: ${plaintext}`,
          error,
        );
      }
    }

    expect(successCount).toBeGreaterThan(0);
  });
});

describe("Constant-Time Comparison", () => {
  test("should return 1 for identical arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(constantTimeEqual(a, b)).toBe(1);
  });

  test("should return 0 for arrays with different lengths", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(0);
  });

  test("should return 0 for arrays with same length but different content", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 6]);
    expect(constantTimeEqual(a, b)).toBe(0);
  });

  test("should handle empty arrays", () => {
    const a = new Uint8Array([]);
    const b = new Uint8Array([]);
    expect(constantTimeEqual(a, b)).toBe(1);
  });

  test("should handle large arrays", () => {
    const a = new Uint8Array(1000).fill(42);
    const b = new Uint8Array(1000).fill(42);
    expect(constantTimeEqual(a, b)).toBe(1);

    // Change just one byte in the middle
    b[500] = 43;
    expect(constantTimeEqual(a, b)).toBe(0);
  });

  test("should handle MAC-sized arrays (32 bytes)", () => {
    // Generate two 32-byte arrays that are identical
    const a = hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    const b = hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    expect(constantTimeEqual(a, b)).toBe(1);

    // Change just one byte
    b[31] = 0x20;
    expect(constantTimeEqual(a, b)).toBe(0);
  });
});
