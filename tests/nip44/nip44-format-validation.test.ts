import {
  isValidPublicKeyFormat,
  isValidPrivateKey,
} from "../../src/nip44";

describe("NIP-44 Format Validation", () => {
  describe("isValidPublicKeyFormat", () => {
    it("should return true for valid public key formats", () => {
      expect(
        isValidPublicKeyFormat(
          "0000000000000000000000000000000000000000000000000000000000000000",
        ),
      ).toBe(true);
      expect(
        isValidPublicKeyFormat(
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ).toBe(true);
      expect(
        isValidPublicKeyFormat(
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        ),
      ).toBe(true);
      expect(
        isValidPublicKeyFormat(
          "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
        ),
      ).toBe(true); // Test case-insensitivity
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
      // Empty string
      expect(isValidPublicKeyFormat("")).toBe(false);
      // Non-hex characters
      expect(
        isValidPublicKeyFormat(
          "not_a_hex_string_but_64_chars_long_____________________________",
        ),
      ).toBe(false);
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
          "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140",
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
          "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
        ),
      ).toBe(false);
      // Key greater than the curve order
      expect(
        isValidPrivateKey(
          "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364142",
        ),
      ).toBe(false);
    });
  });
}); 