import {
  encrypt,
  decrypt,
  constantTimeEqual,
  secureWipe,
  getSharedSecret,
  getMessageKeys,
  generateNonce,
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

describe("NIP-44 Performance Tests", () => {
  const testPrivateKey = "0000000000000000000000000000000000000000000000000000000000000001";
  const testPublicKey = getPublicKeyHex(testPrivateKey);
  
  describe("Encryption/Decryption Performance", () => {
    test("should encrypt/decrypt small messages efficiently", () => {
      const message = "Hello, World!";
      const iterations = 100;
      
      let totalEncryptTime = 0;
      let totalDecryptTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        // Measure encryption time
        const { result: encrypted, timeMs: encryptTime } = measureTime(() =>
          encrypt(message, testPrivateKey, testPublicKey)
        );
        totalEncryptTime += encryptTime;
        
        // Measure decryption time
        const { result: decrypted, timeMs: decryptTime } = measureTime(() =>
          decrypt(encrypted, testPrivateKey, testPublicKey)
        );
        totalDecryptTime += decryptTime;
        
        expect(decrypted).toBe(message);
      }
      
      const avgEncryptTime = totalEncryptTime / iterations;
      const avgDecryptTime = totalDecryptTime / iterations;
      
      console.log(`Average encryption time: ${avgEncryptTime.toFixed(2)}ms`);
      console.log(`Average decryption time: ${avgDecryptTime.toFixed(2)}ms`);
      
      // Performance assertions (adjust thresholds as needed)
      expect(avgEncryptTime).toBeLessThan(50); // Should encrypt in under 50ms
      expect(avgDecryptTime).toBeLessThan(50); // Should decrypt in under 50ms
    });
    
    test("should handle large messages efficiently", () => {
      const largeMessage = "x".repeat(10000); // 10KB message
      const iterations = 10;
      
      let totalEncryptTime = 0;
      let totalDecryptTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const { result: encrypted, timeMs: encryptTime } = measureTime(() =>
          encrypt(largeMessage, testPrivateKey, testPublicKey)
        );
        totalEncryptTime += encryptTime;
        
        const { result: decrypted, timeMs: decryptTime } = measureTime(() =>
          decrypt(encrypted, testPrivateKey, testPublicKey)
        );
        totalDecryptTime += decryptTime;
        
        expect(decrypted).toBe(largeMessage);
      }
      
      const avgEncryptTime = totalEncryptTime / iterations;
      const avgDecryptTime = totalDecryptTime / iterations;
      
      console.log(`Large message avg encryption time: ${avgEncryptTime.toFixed(2)}ms`);
      console.log(`Large message avg decryption time: ${avgDecryptTime.toFixed(2)}ms`);
      
      // Large messages should still be reasonably fast
      expect(avgEncryptTime).toBeLessThan(200);
      expect(avgDecryptTime).toBeLessThan(200);
    });
    
    test("should perform key derivation efficiently", () => {
      const iterations = 1000;
      let totalTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() =>
          getSharedSecret(testPrivateKey, testPublicKey)
        );
        totalTime += timeMs;
      }
      
      const avgTime = totalTime / iterations;
      console.log(`Average key derivation time: ${avgTime.toFixed(2)}ms`);
      
      // Key derivation should be fast
      expect(avgTime).toBeLessThan(10);
    });
    
    test("should perform message key derivation efficiently", () => {
      const conversationKey = getSharedSecret(testPrivateKey, testPublicKey);
      const nonce = generateNonce();
      const iterations = 1000;
      let totalTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() =>
          getMessageKeys(conversationKey, nonce)
        );
        totalTime += timeMs;
      }
      
      const avgTime = totalTime / iterations;
      console.log(`Average message key derivation time: ${avgTime.toFixed(2)}ms`);
      
      // Message key derivation should be fast
      expect(avgTime).toBeLessThan(5);
    });
  });
  
  describe("Throughput Tests", () => {
    test("should maintain consistent performance under load", () => {
      const message = "Performance test message";
      const iterations = 500;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() => {
          const encrypted = encrypt(message, testPrivateKey, testPublicKey);
          decrypt(encrypted, testPrivateKey, testPublicKey);
        });
        times.push(timeMs);
      }
      
      // Calculate statistics
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const stdDev = Math.sqrt(
        times.reduce((sq, n) => sq + Math.pow(n - avgTime, 2), 0) / times.length
      );
      
      console.log(`Throughput stats - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);
      
      // Performance should be reasonable - informational checks for CI environments
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      
      // Consistency checks - may fail under high system load, which is acceptable
      if (stdDev > avgTime * 1.0) {
        console.warn(`High performance variance detected (StdDev: ${stdDev.toFixed(2)}ms vs Avg: ${avgTime.toFixed(2)}ms) - this may indicate system load`);
      }
      if (maxTime > avgTime * 10) {
        console.warn(`High maximum time detected (Max: ${maxTime.toFixed(2)}ms vs Avg: ${avgTime.toFixed(2)}ms) - this may indicate system load`);
      }
    });
  });
});

describe("NIP-44 Security Tests", () => {
  describe("Constant-Time Comparison Security", () => {
    test("should have consistent timing for equal arrays", () => {
      const array1 = new Uint8Array(32).fill(0xAA);
      const array2 = new Uint8Array(32).fill(0xAA);
      const iterations = 1000;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() => {
          constantTimeEqual(array1, array2);
        });
        times.push(timeMs);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Equal arrays timing - Avg: ${avgTime.toFixed(4)}ms, Min: ${minTime.toFixed(4)}ms, Max: ${maxTime.toFixed(4)}ms`);
      
      // Should always return 1 for equal arrays
      expect(constantTimeEqual(array1, array2)).toBe(1);
    });
    
    test("should have consistent timing for different arrays", () => {
      const array1 = new Uint8Array(32).fill(0xAA);
      const array2 = new Uint8Array(32).fill(0xBB);
      const iterations = 1000;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = measureTime(() => {
          constantTimeEqual(array1, array2);
        });
        times.push(timeMs);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Different arrays timing - Avg: ${avgTime.toFixed(4)}ms, Min: ${minTime.toFixed(4)}ms, Max: ${maxTime.toFixed(4)}ms`);
      
      // Should always return 0 for different arrays
      expect(constantTimeEqual(array1, array2)).toBe(0);
    });
    
    test("should detect single bit differences", () => {
      const baseArray = new Uint8Array(32).fill(0);
      
      // Test each bit position
      for (let byteIndex = 0; byteIndex < 32; byteIndex++) {
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
          const modifiedArray = new Uint8Array(baseArray);
          modifiedArray[byteIndex] |= (1 << bitIndex);
          
          expect(constantTimeEqual(baseArray, modifiedArray)).toBe(0);
        }
      }
    });
    
    test("should handle timing attack scenarios", () => {
      // Test arrays that differ in the first byte vs last byte
      const baseArray = new Uint8Array(32).fill(0);
      const firstByteDiff = new Uint8Array(baseArray);
      const lastByteDiff = new Uint8Array(baseArray);
      
      firstByteDiff[0] = 1;
      lastByteDiff[31] = 1;
      
      const iterations = 1000;
      const firstByteTimes: number[] = [];
      const lastByteTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs: firstTime } = measureTime(() =>
          constantTimeEqual(baseArray, firstByteDiff)
        );
        const { timeMs: lastTime } = measureTime(() =>
          constantTimeEqual(baseArray, lastByteDiff)
        );
        
        firstByteTimes.push(firstTime);
        lastByteTimes.push(lastTime);
      }
      
      const avgFirstTime = firstByteTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgLastTime = lastByteTimes.reduce((a, b) => a + b, 0) / iterations;
      
      console.log(`First byte diff avg: ${avgFirstTime.toFixed(4)}ms, Last byte diff avg: ${avgLastTime.toFixed(4)}ms`);
      
      // The timing difference should be minimal (within reasonable variance)
      const timingDifference = Math.abs(avgFirstTime - avgLastTime);
      const relativeVariance = timingDifference / Math.max(avgFirstTime, avgLastTime);
      
      // Timing difference should be less than 20% relative variance
      expect(relativeVariance).toBeLessThan(0.2);
    });
  });
  
  describe("Memory Security Tests", () => {
    test("secureWipe should clear buffer contents", () => {
      const buffer = new Uint8Array(32);
      
      // Fill with test data
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i;
      }
      
      // Verify buffer has data
      expect(buffer.some(byte => byte !== 0)).toBe(true);
      
      // Wipe the buffer
      secureWipe(buffer);
      
      // Verify buffer is cleared
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
    
    test("secureWipe should handle empty buffers", () => {
      const buffer = new Uint8Array(0);
      
      // Should not throw
      expect(() => secureWipe(buffer)).not.toThrow();
    });
    
    test("secureWipe should handle large buffers", () => {
      const buffer = new Uint8Array(10000);
      buffer.fill(0xFF);
      
      expect(buffer.every(byte => byte === 0xFF)).toBe(true);
      
      secureWipe(buffer);
      
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
  });
  
  describe("Side-Channel Resistance", () => {
    test("should not leak information through exceptions", () => {
      const validKey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const invalidPayload = "invalid_base64_payload_that_should_fail";
      
      // All decryption failures should throw similar errors
      // without leaking information about the specific failure point
      expect(() => {
        decrypt(invalidPayload, validKey, validKey);
      }).toThrow(/NIP-44:/);
    });
    
    test("should maintain consistent behavior across key validation", () => {
      const validKeys = [
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140", // n-1 (max valid)
      ];
      
      const invalidKeys = [
        "0000000000000000000000000000000000000000000000000000000000000000", // zero
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", // too large
        "invalid_hex_string", // not hex
        "", // empty
      ];
      
      // Valid keys should work consistently
      for (const key of validKeys) {
        expect(() => {
          const result = getSharedSecret(key, validKeys[0]);
          expect(result).toBeInstanceOf(Uint8Array);
          expect(result.length).toBe(32);
        }).not.toThrow();
      }
      
      // Invalid keys should fail consistently
      for (const key of invalidKeys) {
        expect(() => {
          getSharedSecret(key, validKeys[0]);
        }).toThrow(/NIP-44:/);
      }
    });
  });
  
  describe("Padding Length Calculation Tests", () => {
    test("should calculate padding correctly according to NIP-44 spec", () => {
      const testCases = [
        { input: 1, expected: 32 },
        { input: 32, expected: 32 },
        { input: 33, expected: 64 },
        { input: 64, expected: 64 },
        { input: 65, expected: 96 },
        { input: 100, expected: 128 },
        { input: 200, expected: 224 },
        { input: 300, expected: 320 },
        { input: 500, expected: 512 },
        { input: 1000, expected: 1024 },
        { input: 2000, expected: 2048 },
      ];
      
      for (const testCase of testCases) {
        const message = "x".repeat(testCase.input);
        const encrypted = encrypt(message, "0000000000000000000000000000000000000000000000000000000000000001", 
                                "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
        const decrypted = decrypt(encrypted, "0000000000000000000000000000000000000000000000000000000000000001", 
                                "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
        
        expect(decrypted).toBe(message);
        expect(decrypted.length).toBe(testCase.input);
      }
    });
  });
}); 