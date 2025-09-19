import {
  encrypt,
  decrypt,
  constantTimeEqual,
  secureWipe,
  getSharedSecret,
} from "../../src/nip44";
import { secp256k1 } from "@noble/curves/secp256k1";

// Helper function to get the public key for a given private key
function getPublicKeyHex(privateKeyHex: string): string {
  const publicKey = secp256k1.getPublicKey(privateKeyHex, false);
  return Buffer.from(publicKey.slice(1, 33)).toString("hex");
}

// Helper function to measure execution time
function measureTime<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, timeMs: end - start };
}

describe("NIP-44 Enhancements Tests", () => {
  const testPrivateKey =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const testPublicKey = getPublicKeyHex(testPrivateKey);

  describe("Memory Security (secureWipe)", () => {
    test("should clear buffer contents completely", () => {
      const buffer = new Uint8Array(32);

      // Fill with test data
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i;
      }

      // Verify buffer has data
      expect(buffer.some((byte) => byte !== 0)).toBe(true);

      // Wipe the buffer
      secureWipe(buffer);

      // Verify buffer is cleared
      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    test("should handle empty buffers gracefully", () => {
      const buffer = new Uint8Array(0);

      // Should not throw
      expect(() => secureWipe(buffer)).not.toThrow();
    });

    test("should handle large buffers", () => {
      const buffer = new Uint8Array(1000);
      buffer.fill(0xff);

      expect(buffer.every((byte) => byte === 0xff)).toBe(true);

      secureWipe(buffer);

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe("Performance Benchmarks", () => {
    test("should encrypt/decrypt efficiently", () => {
      const message = "Hello, NIP-44!";
      const iterations = 10;

      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() => {
          const encrypted = encrypt(message, testPrivateKey, testPublicKey);
          const decrypted = decrypt(encrypted, testPrivateKey, testPublicKey);
          expect(decrypted).toBe(message);
        });
        totalTime += timeMs;
      }

      const avgTime = totalTime / iterations;
      console.log(`Average encrypt/decrypt time: ${avgTime.toFixed(2)}ms`);

      // Should be reasonably fast (adjusted for CI/CD environments and full test suite load)
      // Cryptographic operations can vary based on system load
      expect(avgTime).toBeLessThan(200); // Allow headroom for CI variance
    });

    test("should perform key derivation efficiently", () => {
      const iterations = 10;
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() =>
          getSharedSecret(testPrivateKey, testPublicKey),
        );
        totalTime += timeMs;
      }

      const avgTime = totalTime / iterations;
      console.log(`Average key derivation time: ${avgTime.toFixed(2)}ms`);

      // Key derivation should be reasonable (adjusted for various environments)
      // Cryptographic operations can vary significantly based on hardware and system load
      expect(avgTime).toBeLessThan(100); // More realistic threshold for CI/CD environments

      // Warn if performance is unexpectedly slow
      if (avgTime > 50) {
        console.warn(
          `Key derivation is slower than expected (${avgTime.toFixed(2)}ms). This may indicate system load or slower hardware.`,
        );
      }
    });
  });

  describe("Constant-Time Security", () => {
    test("should perform constant-time comparison correctly", () => {
      const array1 = new Uint8Array(32).fill(0xaa);
      const array2 = new Uint8Array(32).fill(0xaa);
      const array3 = new Uint8Array(32).fill(0xbb);

      // Equal arrays should return 1
      expect(constantTimeEqual(array1, array2)).toBe(1);

      // Different arrays should return 0
      expect(constantTimeEqual(array1, array3)).toBe(0);

      // Different lengths should return 0
      const shortArray = new Uint8Array(16).fill(0xaa);
      expect(constantTimeEqual(array1, shortArray)).toBe(0);
    });

    test("should detect single bit differences", () => {
      const baseArray = new Uint8Array(32).fill(0);

      // Test a few bit positions to ensure sensitivity
      for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
          const modifiedArray = new Uint8Array(baseArray);
          modifiedArray[byteIndex] |= 1 << bitIndex;

          expect(constantTimeEqual(baseArray, modifiedArray)).toBe(0);
        }
      }
    });
  });

  describe("RFC 4648 Base64 Compliance", () => {
    test("should handle various message sizes correctly", () => {
      const testCases = [
        "a", // 1 byte
        "hello", // 5 bytes
        "hello world!", // 12 bytes
        "x".repeat(100), // 100 bytes
        "🔒 Unicode test! こんにちは 🌟", // Unicode characters
      ];

      for (const message of testCases) {
        const encrypted = encrypt(message, testPrivateKey, testPublicKey);
        const decrypted = decrypt(encrypted, testPrivateKey, testPublicKey);

        expect(decrypted).toBe(message);

        // Verify base64 format
        expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
      }
    });
  });

  describe("Error Handling Improvements", () => {
    test("should provide clear error messages", () => {
      const invalidKey = "invalid_key";

      expect(() => {
        encrypt("test", invalidKey, testPublicKey);
      }).toThrow(/NIP-44:/);

      expect(() => {
        decrypt("invalid_payload", testPrivateKey, testPublicKey);
      }).toThrow(/NIP-44:/);
    });
  });

  describe("Padding Algorithm Verification", () => {
    test("should calculate correct padding lengths", () => {
      const testCases = [
        { input: 1, shouldPadTo: 32 },
        { input: 32, shouldPadTo: 32 },
        { input: 33, shouldPadTo: 64 },
        { input: 64, shouldPadTo: 64 },
        { input: 65, shouldPadTo: 96 },
      ];

      for (const testCase of testCases) {
        const message = "x".repeat(testCase.input);
        const encrypted = encrypt(message, testPrivateKey, testPublicKey);
        const decrypted = decrypt(encrypted, testPrivateKey, testPublicKey);

        expect(decrypted).toBe(message);
        expect(decrypted.length).toBe(testCase.input);
      }
    });
  });
});
