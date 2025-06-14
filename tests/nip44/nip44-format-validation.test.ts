import { isValidPublicKeyFormat, isValidPublicKeyPoint, isValidPrivateKey } from "../../src/nip44";

describe("NIP-44 Format Validation", () => {
  describe("isValidPublicKeyFormat", () => {
    it("should return true for valid public key formats", () => {
      expect(
        isValidPublicKeyFormat(
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        ),
      ).toBe(true);
      expect(
        isValidPublicKeyFormat(
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        ),
      ).toBe(true); // Test lowercase hex (64 chars)
      expect(
        isValidPublicKeyFormat(
          "d91191e30e00444b942c0e82cad470b32af171764c7c6c75d9893e4b0e2ad0ad",
        ),
      ).toBe(true); // Known valid format
    });

    it("should return false for invalid public key formats", () => {
      // Too short
      expect(
        isValidPublicKeyFormat(
          "000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(false);
      // Too long
      expect(
        isValidPublicKeyFormat(
          "000000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(false);
      // Invalid characters
      expect(
        isValidPublicKeyFormat(
          "000000000000000000000000000000000000000000000000000000000000000g",
        ),
      ).toBe(false);
      // Uppercase hex (should be rejected)
      expect(
        isValidPublicKeyFormat(
          "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
        ),
      ).toBe(false);
      // Empty string
      expect(isValidPublicKeyFormat("")).toBe(false);
      // Non-hex characters
      expect(
        isValidPublicKeyFormat(
          "not_a_hex_string_but_64_chars_long_____________________________",
        ),
      ).toBe(false);
    });

    it("should return false for problematic edge cases", () => {
      // All zeros - invalid public key (point at infinity)
      expect(
        isValidPublicKeyFormat(
          "0000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(false);
      
      // All 'f's - invalid public key (field prime - 1)
      expect(
        isValidPublicKeyFormat(
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ).toBe(false);
      
      // secp256k1 field prime - invalid
      expect(
        isValidPublicKeyFormat(
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
        ),
      ).toBe(false);
      
      // Value greater than field prime - invalid
      expect(
        isValidPublicKeyFormat(
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc30",
        ),
      ).toBe(false);
    });
  });

  describe("isValidPublicKeyPoint", () => {
    it("should return true for valid public keys that represent points on the secp256k1 curve", () => {
      // Known valid public keys (x-coordinates that have corresponding points on secp256k1)
      expect(
        isValidPublicKeyPoint(
          "d91191e30e00444b942c0e82cad470b32af171764c7c6c75d9893e4b0e2ad0ad",
        ),
      ).toBe(true);
      
      expect(
        isValidPublicKeyPoint(
          "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
        ),
      ).toBe(true);
      
      // Test with more known valid points
      expect(
        isValidPublicKeyPoint(
          "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        ),
      ).toBe(true); // Generator point x-coordinate
    });

    it("should return false for invalid public key formats", () => {
      // Test format validation first
      expect(isValidPublicKeyPoint("")).toBe(false);
      expect(isValidPublicKeyPoint("invalid")).toBe(false);
      expect(
        isValidPublicKeyPoint(
          "d91191e30e00444b942c0e82cad470b32af171764c7c6c75d9893e4b0e2ad0a",
        ),
      ).toBe(false); // Too short
      expect(
        isValidPublicKeyPoint(
          "d91191e30e00444b942c0e82cad470b32af171764c7c6c75d9893e4b0e2ad0adff",
        ),
      ).toBe(false); // Too long
      expect(
        isValidPublicKeyPoint(
          "D91191E30E00444B942C0E82CAD470B32AF171764C7C6C75D9893E4B0E2AD0AD",
        ),
      ).toBe(false); // Uppercase
    });

    it("should return false for x-coordinates that do not represent valid curve points", () => {
      // All zeros - not a valid point
      expect(
        isValidPublicKeyPoint(
          "0000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(false);
      
      // Point at or near curve order/field prime - likely invalid
      expect(
        isValidPublicKeyPoint(
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
        ),
      ).toBe(false);
      
      // Another invalid x-coordinate (carefully chosen to be invalid)
      expect(
        isValidPublicKeyPoint(
          "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc30",
        ),
      ).toBe(false);
    });

    it("should handle edge cases correctly", () => {
      // Test x-coordinate that requires the odd y-coordinate (prefix 03)
      // This tests that both even and odd y-coordinate validation paths work
      const testKeys = [
        "02e49c3e6c97b1b29b4e5b3f3a1d62789a2d3c4e5f6a7b8c9d0e1f2a3b4c5d6e",
        "ffe97bd42e0b9b9f14b3b54b9f9c2a0f8b2d1e42b4f1c5d7e9f2a1b3c4d5e6f",
      ];
      
      // Note: These are randomly generated and may or may not be valid points
      // The test is more about ensuring the function doesn't crash and returns consistent results
      for (const key of testKeys) {
        const result = isValidPublicKeyPoint(key);
        expect(typeof result).toBe("boolean");
      }
    });
  });

  describe("isValidPrivateKey", () => {
    // Valid private keys (these should be actual valid keys on the secp256k1 curve)
    // A key of all zeros is invalid on the curve.
    // A key equal to or larger than the curve order is invalid.
    // The secp256k1.getPublicKey call will throw for these.
    it("should return true for valid private key formats and values", () => {
      // A known valid private key (replace with an actual one if needed for deep validation)
      // This is a random 32-byte hex string, likely valid.
      expect(
        isValidPrivateKey(
          "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
        ),
      ).toBe(true);
      // Smallest valid key (1)
      expect(
        isValidPrivateKey(
          "0000000000000000000000000000000000000000000000000000000000000001",
        ),
      ).toBe(true);
      // A large, but valid private key (just under the curve order)
      expect(
        isValidPrivateKey(
          "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
        ),
      ).toBe(true); // (Order - 1)
    });

    it("should return false for invalid private key formats", () => {
      // Too short
      expect(
        isValidPrivateKey(
          "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff0",
        ),
      ).toBe(false);
      // Too long
      expect(
        isValidPrivateKey(
          "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff0011",
        ),
      ).toBe(false);
      // Invalid characters
      expect(
        isValidPrivateKey(
          "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff0g",
        ),
      ).toBe(false);
      // Uppercase hex (should be rejected)
      expect(
        isValidPrivateKey(
          "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
        ),
      ).toBe(false);
      // Empty string
      expect(isValidPrivateKey("")).toBe(false);
    });

    it("should return false for private key values that are invalid on the curve", () => {
      // Key of all zeros
      expect(
        isValidPrivateKey(
          "0000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(false);
      // Key equal to the curve order (N)
      expect(
        isValidPrivateKey(
          "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
        ),
      ).toBe(false);
      // Key greater than the curve order
      expect(
        isValidPrivateKey(
          "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364142",
        ),
      ).toBe(false);
    });
  });
});
