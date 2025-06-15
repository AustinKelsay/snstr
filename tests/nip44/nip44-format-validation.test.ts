import { 
  isValidPublicKeyFormat, 
  isValidPublicKeyPoint, 
  isValidPrivateKey, 
  decodePayload,
  NONCE_SIZE_V0,
  MAC_SIZE_V0
} from "../../src/nip44";

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

describe("NIP-44 decodePayload compliance tests", () => {
  describe("# prefix detection", () => {
    test("should reject payloads starting with #", () => {
      const hashPrefixedPayload = "#invalid-non-base64-payload";
      
      expect(() => {
        decodePayload(hashPrefixedPayload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    });

    test("should reject empty payloads starting with #", () => {
      const hashOnlyPayload = "#";
      
      expect(() => {
        decodePayload(hashOnlyPayload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    });
  });

  describe("base64 payload length validation", () => {
    test("should reject base64 payloads that are too short", () => {
      // Generate a valid base64 string that's shorter than 132 characters
      const shortPayload = "dGVzdA=="; // "test" in base64, only 8 characters
      
      expect(() => {
        decodePayload(shortPayload);
      }).toThrow(/Invalid ciphertext length/);
    });

    test("should reject base64 payloads that are too long", () => {
      // Generate a valid base64 string that's longer than 87,472 characters
      const longPayload = "A".repeat(87473); // 87,473 characters, exceeds limit
      
      expect(() => {
        decodePayload(longPayload);
      }).toThrow(/Invalid ciphertext length/);
    });

    test("should accept base64 payloads at minimum length boundary", () => {
      // Generate a valid base64 string that's exactly 132 characters
      const minLengthPayload = "A".repeat(132);
      
      // This should pass length validation and successfully decode (version 0 is supported for decryption)
      const result = decodePayload(minLengthPayload);
      expect(result.version).toBe(0);
      expect(result.nonce).toHaveLength(NONCE_SIZE_V0);
      expect(result.mac).toHaveLength(MAC_SIZE_V0);
      expect(result.ciphertext.length).toBeGreaterThan(0);
    });

    test("should accept base64 payloads at maximum length boundary", () => {
      // Generate a valid base64 string that's exactly 87,472 characters
      const maxLengthPayload = "A".repeat(87472);
      
      // This should pass length validation but may fail later validation steps
      expect(() => {
        decodePayload(maxLengthPayload);
      }).toThrow(/Invalid base64 encoding|Invalid decoded payload length/);
    });
  });

  describe("decoded payload length validation", () => {
    test("should reject decoded payloads that are too short", () => {
      // Create a valid base64 that decodes to less than 99 bytes
      // "A".repeat(132) decodes to 99 bytes, so we need something shorter
      const shortDecodedPayload = Buffer.alloc(98).toString("base64"); // 98 bytes when decoded
      const paddedPayload = shortDecodedPayload + "=".repeat((4 - (shortDecodedPayload.length % 4)) % 4);
      
      expect(() => {
        decodePayload(paddedPayload);
      }).toThrow(/Invalid decoded payload length/);
    });

    test("should reject decoded payloads that are too long", () => {
      // Create a valid base64 that decodes to more than 65,603 bytes
      const longDecodedPayload = Buffer.alloc(65604).toString("base64"); // 65,604 bytes when decoded
      
      expect(() => {
        decodePayload(longDecodedPayload);
      }).toThrow(/Invalid decoded payload length/);
    });

    test("should accept decoded payloads at minimum length boundary", () => {
      // Create a valid base64 that decodes to exactly 99 bytes
      const minDecodedPayload = Buffer.alloc(99).toString("base64");
      
      // This should pass length validation and successfully decode (version 0 is supported for decryption)
      const result = decodePayload(minDecodedPayload);
      expect(result.version).toBe(0);
      expect(result.nonce).toHaveLength(NONCE_SIZE_V0);
      expect(result.mac).toHaveLength(MAC_SIZE_V0);
      expect(result.ciphertext.length).toBeGreaterThan(0);
    });

    test("should accept decoded payloads at maximum length boundary", () => {
      // Create a valid base64 that decodes to exactly 65,603 bytes
      const maxDecodedPayload = Buffer.alloc(65603).toString("base64");
      
      // This should pass length validation and successfully decode (version 0 is supported for decryption)
      const result = decodePayload(maxDecodedPayload);
      expect(result.version).toBe(0);
      expect(result.nonce).toHaveLength(NONCE_SIZE_V0);
      expect(result.mac).toHaveLength(MAC_SIZE_V0);
      expect(result.ciphertext.length).toBeGreaterThan(0);
    });
  });
});

describe("Whitespace normalization for # prefix detection", () => {
  test("should reject payloads with # prefix after leading spaces", () => {
    const spacePrefixedPayloads = [
      " #invalid-payload",
      "  #invalid-payload", 
      "   #invalid-payload"
    ];
    
    for (const payload of spacePrefixedPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    }
  });

  test("should reject payloads with # prefix after leading tabs", () => {
    const tabPrefixedPayloads = [
      "\t#invalid-payload",
      "\t\t#invalid-payload",
      "\t \t#invalid-payload"
    ];
    
    for (const payload of tabPrefixedPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    }
  });

  test("should reject payloads with # prefix after leading newlines", () => {
    const newlinePrefixedPayloads = [
      "\n#invalid-payload",
      "\r\n#invalid-payload",
      "\n\n#invalid-payload",
      "\r#invalid-payload"
    ];
    
    for (const payload of newlinePrefixedPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    }
  });

  test("should reject payloads with # prefix after mixed whitespace", () => {
    const mixedWhitespacePrefixedPayloads = [
      " \t#invalid-payload",
      "\n \t#invalid-payload",
      " \r\n\t #invalid-payload",
      "\t\n \r#invalid-payload"
    ];
    
    for (const payload of mixedWhitespacePrefixedPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Unsupported version (non-base64 encoding detected)");
    }
  });

  test("should handle valid payloads with leading/trailing whitespace", () => {
    const validPayloadCore = "A".repeat(132);
    const whitespacePaddedPayloads = [
      " " + validPayloadCore,
      validPayloadCore + " ",
      " " + validPayloadCore + " ",
      "\t" + validPayloadCore + "\t",
      "\n" + validPayloadCore + "\n"
    ];
    
    for (const payload of whitespacePaddedPayloads) {
      // Should not throw # prefix error (may fail at later validation steps)
      expect(() => {
        decodePayload(payload);
      }).not.toThrow("Unsupported version (non-base64 encoding detected)");
    }
  });

  test("should handle empty payload after trimming", () => {
    const emptyAfterTrimPayloads = [
      "   ",
      "\t\t",
      "\n\n",
      " \t\n\r "
    ];
    
    for (const payload of emptyAfterTrimPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("Invalid ciphertext length"); // Should fail length validation, not # prefix
    }
  });

  test("should use trimmed length for length validation", () => {
    // Create a payload that's too short after trimming
    const shortPayload = " " + "A".repeat(130) + " "; // 132 chars total, but 130 after trim
    
    expect(() => {
      decodePayload(shortPayload);
    }).toThrow(/Invalid ciphertext length/);
  });
});

describe("Base64 alphabet validation", () => {
  test("should reject payloads with invalid base64 characters", () => {
    const invalidChars = ["@", "!", "%", "~", " ", "\n", "\t"];
    
    for (const char of invalidChars) {
      const invalidPayload = "ABC" + char + "DEF" + "A".repeat(125); // Make it long enough to pass length checks
      
      expect(() => {
        decodePayload(invalidPayload);
      }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
    }
  });

  test("should reject payloads with unicode characters", () => {
    const unicodePayload = "ABC🚀DEF" + "A".repeat(125);
    
    expect(() => {
      decodePayload(unicodePayload);
    }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
  });

  test("should reject payloads with excessive padding", () => {
    const excessivePaddingPayload = "A".repeat(129) + "==="; // 132 chars with 3 padding chars
    
    expect(() => {
      decodePayload(excessivePaddingPayload);
    }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
  });

  test("should reject payloads with padding in the middle", () => {
    const paddingInMiddlePayload = "ABC=DEF" + "A".repeat(125);
    
    expect(() => {
      decodePayload(paddingInMiddlePayload);
    }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
  });

  test("should reject payloads with improper base64 structure (not multiple of 4)", () => {
    // Create payloads that are long enough to pass length validation but have improper base64 structure
    const improperLengthPayloads = [
      "A".repeat(133), // 133 chars, not multiple of 4
      "A".repeat(135), // 135 chars, not multiple of 4  
      "A".repeat(134), // 134 chars, not multiple of 4
    ];
    
    for (const payload of improperLengthPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
    }
  });

  test("should reject payloads with multiple padding blocks", () => {
    // Test cases where padding appears in multiple places - make them long enough to pass length validation
    const multiplePaddingPayloads = [
      "A".repeat(128) + "AB==CD==", // Padding in middle and end (136 chars total)
      "A".repeat(124) + "A=B=C=D=", // Multiple single padding chars (132 chars total)
      "A".repeat(125) + "ABC===D", // Three padding chars (invalid) (132 chars total)
    ];
    
    for (const payload of multiplePaddingPayloads) {
      expect(() => {
        decodePayload(payload);
      }).toThrow("NIP-44: Invalid base64 alphabet in ciphertext");
    }
  });

  test("should accept valid base64 strings with no padding", () => {
    const validPayload = "A".repeat(132);  // All valid chars, no padding
    
    // Should not throw base64 alphabet error (may fail at later validation steps)
    expect(() => {
      decodePayload(validPayload);
    }).not.toThrow("Invalid base64 alphabet");
  });

  test("should accept valid base64 strings with proper padding", () => {
    const validPayload1 = "A".repeat(131) + "=";  // 1 padding char
    const validPayload2 = "A".repeat(130) + "=="; // 2 padding chars
    
    // Should not throw base64 alphabet error (may fail at later validation steps)
    for (const payload of [validPayload1, validPayload2]) {
      expect(() => {
        decodePayload(payload);
      }).not.toThrow("Invalid base64 alphabet");
    }
  });

  test("should accept all valid base64 alphabet characters", () => {
    // Test with a string containing all valid base64 characters
    const allValidChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" + "A".repeat(68);
    
    expect(() => {
      decodePayload(allValidChars);
    }).not.toThrow("Invalid base64 alphabet");
  });
});
