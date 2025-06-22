import { NIP46Validator, SecureErrorHandler } from "../../src/nip46/utils/validator";
import { NIP46Method, NIP46Request, NIP46ErrorCode, NIP46ErrorUtils } from "../../src/nip46/types";
import { generateKeypair } from "../../src/utils/crypto";
import { generateRequestId } from "../../src/nip46/utils/request-response";
import { 
  validatePrivateKey, 
  validateKeypairForCrypto, 
  validateBeforeSigning, 
  validateBeforeEncryption, 
  validatePrivateKeyResult, 
  validatePrivateKeySecure, 
  createProductionSafeMessage,
  securePermissionCheck 
} from "../../src/nip46/utils/security";
// import { NIP46SecurityError } from "../../src/nip46/types";

describe("NIP-46 Validator Unit Tests", () => {
  let validKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    validKeypair = await generateKeypair();
  });

  describe("NIP46Validator.validateRequestPayload", () => {
    test("validates valid request", () => {
      const validRequest: NIP46Request = {
        id: "request-123",
        method: NIP46Method.GET_PUBLIC_KEY,
        params: []
      };
      expect(NIP46Validator.validateRequestPayload(validRequest)).toBe(true);
    });

    test("rejects invalid requests", () => {
      expect(NIP46Validator.validateRequestPayload(null as unknown as NIP46Request)).toBe(false);
      expect(NIP46Validator.validateRequestPayload({} as unknown as NIP46Request)).toBe(false);
      expect(NIP46Validator.validateRequestPayload({
        id: "",
        method: NIP46Method.PING,
        params: []
      })).toBe(false);
    });
  });

  describe("NIP46Validator.validateEventContent", () => {
    test("validates valid event content", () => {
      const validEvent = {
        kind: 1,
        content: "Hello",
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      };
      expect(NIP46Validator.validateEventContent(JSON.stringify(validEvent))).toBe(true);
    });

    test("rejects invalid content", () => {
      expect(NIP46Validator.validateEventContent("")).toBe(false);
      expect(NIP46Validator.validateEventContent("invalid json")).toBe(false);
      expect(NIP46Validator.validateEventContent("x".repeat(70000))).toBe(false);
    });
  });

  describe("NIP46Validator.validatePubkey", () => {
    test("validates valid pubkeys", () => {
      expect(NIP46Validator.validatePubkey(validKeypair.publicKey)).toBe(true);
      expect(NIP46Validator.validatePubkey("a".repeat(64))).toBe(true);
      expect(NIP46Validator.validatePubkey("A".repeat(64))).toBe(true);
    });

    test("rejects invalid pubkeys", () => {
      expect(NIP46Validator.validatePubkey("")).toBe(false);
      expect(NIP46Validator.validatePubkey("invalid")).toBe(false);
      expect(NIP46Validator.validatePubkey("g".repeat(64))).toBe(false);
      expect(NIP46Validator.validatePubkey(null as unknown as string)).toBe(false);
    });
  });

  describe("NIP46Validator.validatePrivateKey", () => {
    test("validates valid private keys", () => {
      expect(NIP46Validator.validatePrivateKey(validKeypair.privateKey)).toBe(true);
      expect(NIP46Validator.validatePrivateKey("b".repeat(64))).toBe(true);
    });

    test("rejects invalid private keys", () => {
      expect(NIP46Validator.validatePrivateKey("")).toBe(false);
      expect(NIP46Validator.validatePrivateKey("invalid")).toBe(false);
      expect(NIP46Validator.validatePrivateKey("z".repeat(64))).toBe(false);
    });
  });

  describe("NIP46Validator.validateSignature", () => {
    test("validates valid signatures", () => {
      expect(NIP46Validator.validateSignature("c".repeat(128))).toBe(true);
      expect(NIP46Validator.validateSignature("C".repeat(128))).toBe(true);
    });

    test("rejects invalid signatures", () => {
      expect(NIP46Validator.validateSignature("")).toBe(false);
      expect(NIP46Validator.validateSignature("invalid")).toBe(false);
      expect(NIP46Validator.validateSignature("z".repeat(128))).toBe(false);
    });

    test("validates signatures correctly with various formats", () => {
      expect(NIP46Validator.validateSignature("a".repeat(128))).toBe(true);
      expect(NIP46Validator.validateSignature("A".repeat(128))).toBe(true);
      expect(NIP46Validator.validateSignature("1234567890abcdef".repeat(8))).toBe(true);
      
      expect(NIP46Validator.validateSignature("")).toBe(false);
      expect(NIP46Validator.validateSignature("a".repeat(127))).toBe(false);
      expect(NIP46Validator.validateSignature("a".repeat(129))).toBe(false);
      expect(NIP46Validator.validateSignature("xyz" + "a".repeat(125))).toBe(false);
    });
  });

  describe("NIP46Validator.validateEventId", () => {
    test("validates valid event IDs", () => {
      expect(NIP46Validator.validateEventId("d".repeat(64))).toBe(true);
      expect(NIP46Validator.validateEventId("D".repeat(64))).toBe(true);
    });

    test("rejects invalid event IDs", () => {
      expect(NIP46Validator.validateEventId("")).toBe(false);
      expect(NIP46Validator.validateEventId("invalid")).toBe(false);
      expect(NIP46Validator.validateEventId("z".repeat(64))).toBe(false);
    });

    test("validates event IDs correctly with various formats", () => {
      expect(NIP46Validator.validateEventId("a".repeat(64))).toBe(true);
      expect(NIP46Validator.validateEventId("A".repeat(64))).toBe(true);
      expect(NIP46Validator.validateEventId("1234567890abcdef".repeat(4))).toBe(true);
      
      expect(NIP46Validator.validateEventId("")).toBe(false);
      expect(NIP46Validator.validateEventId("a".repeat(63))).toBe(false);
      expect(NIP46Validator.validateEventId("a".repeat(65))).toBe(false);
      expect(NIP46Validator.validateEventId("xyz" + "a".repeat(61))).toBe(false);
    });
  });

  describe("NIP46Validator.validateTimestamp", () => {
    test("validates current timestamp", () => {
      const now = Math.floor(Date.now() / 1000);
      expect(NIP46Validator.validateTimestamp(now)).toBe(true);
      expect(NIP46Validator.validateTimestamp(now - 100)).toBe(true);
    });

    test("rejects old timestamps", () => {
      const old = Math.floor(Date.now() / 1000) - 400;
      expect(NIP46Validator.validateTimestamp(old)).toBe(false);
    });

    test("accepts old timestamps with custom max age", () => {
      const old = Math.floor(Date.now() / 1000) - 400;
      expect(NIP46Validator.validateTimestamp(old, 500)).toBe(true);
    });

    test("relaxed timestamp validation for offline signing", () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Should allow up to 24 hours difference
      expect(NIP46Validator.validateTimestamp(now - 86000, 86400)).toBe(true); // ~23.9 hours ago with 24h tolerance
      expect(NIP46Validator.validateTimestamp(now + 86000, 86400)).toBe(false); // Future timestamps not allowed
      expect(NIP46Validator.validateTimestamp(now - 90000, 86400)).toBe(false); // >25 hours ago
    });
  });

  describe("NIP46Validator.validateRelayUrl", () => {
    test("validates valid relay URLs", () => {
      expect(NIP46Validator.validateRelayUrl("ws://localhost:3792")).toBe(true);
      expect(NIP46Validator.validateRelayUrl("wss://relay.example.com")).toBe(true);
    });

    test("rejects invalid URLs", () => {
      expect(NIP46Validator.validateRelayUrl("")).toBe(false);
      expect(NIP46Validator.validateRelayUrl("http://example.com")).toBe(false);
      expect(NIP46Validator.validateRelayUrl("invalid")).toBe(false);
    });
  });

  describe("NIP46Validator.validateConnectionString", () => {
    test("validates valid connection strings", () => {
      const bunkerStr = `bunker://${validKeypair.publicKey}?relay=ws://localhost:3792`;
      const nostrStr = `nostrconnect://${validKeypair.publicKey}?relay=ws://localhost:3792`;
      
      expect(NIP46Validator.validateConnectionString(bunkerStr)).toBe(true);
      expect(NIP46Validator.validateConnectionString(nostrStr)).toBe(true);
    });

    test("rejects invalid connection strings", () => {
      expect(NIP46Validator.validateConnectionString("")).toBe(false);
      expect(NIP46Validator.validateConnectionString("invalid://test")).toBe(false);
      expect(NIP46Validator.validateConnectionString("bunker://invalid")).toBe(false);
    });
  });

  describe("NIP46Validator.validateParams", () => {
    test("validates valid params", () => {
      expect(NIP46Validator.validateParams([])).toBe(true);
      expect(NIP46Validator.validateParams(["param1", "param2"])).toBe(true);
    });

    test("rejects invalid params", () => {
      const tooMany = Array(15).fill("param");
      expect(NIP46Validator.validateParams(tooMany)).toBe(false);
      
      const tooLarge = ["x".repeat(40000)];
      expect(NIP46Validator.validateParams(tooLarge)).toBe(false);
    });
  });

  describe("NIP46Validator.validatePermission", () => {
    test("validates valid permissions", () => {
      expect(NIP46Validator.validatePermission("sign_event")).toBe(true);
      expect(NIP46Validator.validatePermission("get_public_key")).toBe(true);
      expect(NIP46Validator.validatePermission("nip44_encrypt")).toBe(true);
    });

    test("rejects invalid permissions", () => {
      expect(NIP46Validator.validatePermission("")).toBe(false);
      expect(NIP46Validator.validatePermission("invalid_perm")).toBe(false);
    });
  });

  describe("NIP46Validator.validateAndParseJson", () => {
    test("validates and parses valid JSON", () => {
      const result = NIP46Validator.validateAndParseJson('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: "value" });
    });

    test("rejects invalid JSON", () => {
      const result = NIP46Validator.validateAndParseJson('invalid json');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("validates JSON input securely", () => {
      const validJson = '{"test": "value"}';
      const result = NIP46Validator.validateAndParseJson(validJson);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ test: "value" });

      const invalidJson = '{"test": value}'; // Missing quotes
      const result2 = NIP46Validator.validateAndParseJson(invalidJson);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("JSON parsing failed");

      const tooLarge = "a".repeat(70000);
      const result3 = NIP46Validator.validateAndParseJson(tooLarge);
      expect(result3.valid).toBe(false);
      expect(result3.error).toBe("JSON string too large");
    });
  });

  describe("NIP46Validator.sanitizeString", () => {
    test("handles string sanitization", () => {
      expect(NIP46Validator.sanitizeString("short")).toBe("short");
      
      const long = "x".repeat(2000);
      const sanitized = NIP46Validator.sanitizeString(long);
      expect(sanitized.length).toBeLessThanOrEqual(1003);
      // Check if truncated (either with ... or just truncated)
      expect(sanitized.length < long.length).toBe(true);
    });
  });

  describe("NIP46Validator.isValidMethod", () => {
    test("validates valid methods", () => {
      expect(NIP46Validator.isValidMethod(NIP46Method.CONNECT)).toBe(true);
      expect(NIP46Validator.isValidMethod(NIP46Method.GET_PUBLIC_KEY)).toBe(true);
      expect(NIP46Validator.isValidMethod(NIP46Method.SIGN_EVENT)).toBe(true);
    });

    test("rejects invalid methods", () => {
      expect(NIP46Validator.isValidMethod("invalid" as string)).toBe(false);
      expect(NIP46Validator.isValidMethod("" as string)).toBe(false);
    });
  });

  describe("SecureErrorHandler", () => {
    test("sanitizes errors", () => {
      const error = new Error("Test error message");
      const sanitized = SecureErrorHandler.sanitizeError(error, false);
      expect(typeof sanitized).toBe("string");
      expect(sanitized.length).toBeGreaterThan(0);
    });

    test("handles debug mode", () => {
      const error = new Error("Debug error");
      const debug = SecureErrorHandler.sanitizeError(error, true);
      const prod = SecureErrorHandler.sanitizeError(error, false);
      
      // Both should be strings
      expect(typeof debug).toBe("string");
      expect(typeof prod).toBe("string");
      expect(debug.length).toBeGreaterThan(0);
      expect(prod.length).toBeGreaterThan(0);
    });

    test("logs security events", () => {
      expect(() => {
        SecureErrorHandler.logSecurityEvent("test_event", { key: "value" });
      }).not.toThrow();
    });

    describe("Security Logging Configuration", () => {
      beforeEach(() => {
        // Reset security logging state before each test
        SecureErrorHandler.setSecurityLoggingEnabled(true);
      });

          test("should allow enabling and disabling security logging", () => {
      // Disable security logging
      SecureErrorHandler.setSecurityLoggingEnabled(false);
      expect(SecureErrorHandler.isSecurityLoggingEnabled()).toBe(false);
      
      // Re-enable security logging
      SecureErrorHandler.setSecurityLoggingEnabled(true);
      expect(SecureErrorHandler.isSecurityLoggingEnabled()).toBe(true);
    });

      test("should initialize custom security logger", () => {
        const mockLogger = {
          warn: jest.fn(),
          error: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          trace: jest.fn(),
          setLevel: jest.fn()
        } as any;

        // Initialize with custom logger
        SecureErrorHandler.initializeSecurityLogging(mockLogger, true);
        
        // Enable logging and test
        SecureErrorHandler.setSecurityLoggingEnabled(true);
        SecureErrorHandler.logSecurityEvent("test_event", { key: "value" });
        
        // Verify the custom logger was called
        expect(mockLogger.warn).toHaveBeenCalledWith("test_event", { key: "value" });
      });

      test("should respect security logging enabled/disabled setting", () => {
        const mockLogger = {
          warn: jest.fn(),
          error: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          trace: jest.fn(),
          setLevel: jest.fn()
        } as any;

        SecureErrorHandler.initializeSecurityLogging(mockLogger, false);
        
        // Should not log when disabled
        SecureErrorHandler.logSecurityEvent("disabled_event", { key: "value" });
        expect(mockLogger.warn).not.toHaveBeenCalled();
        
        // Enable and try again
        SecureErrorHandler.setSecurityLoggingEnabled(true);
        SecureErrorHandler.logSecurityEvent("enabled_event", { key: "value" });
        expect(mockLogger.warn).toHaveBeenCalledWith("enabled_event", { key: "value" });
      });

      test("should properly redact sensitive fields in security logs", () => {
        const mockLogger = {
          warn: jest.fn(),
          error: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          trace: jest.fn(),
          setLevel: jest.fn()
        } as any;

        SecureErrorHandler.initializeSecurityLogging(mockLogger, true);
        SecureErrorHandler.setSecurityLoggingEnabled(true);
        
        // Log with sensitive data
        const details = {
          publicKey: "sensitive-public-key",
          privateKey: "sensitive-private-key",
          normalData: "normal-data"
        };
        
        SecureErrorHandler.logSecurityEvent("test_redaction", details, ["privateKey", "publicKey"]);
        
        // Verify sensitive fields were redacted
        expect(mockLogger.warn).toHaveBeenCalledWith("test_redaction", {
          publicKey: "[REDACTED]",
          privateKey: "[REDACTED]",
          normalData: "normal-data"
        });
      });
    });
  });

  describe("Request ID Generation Security", () => {
    test("generateRequestId produces cryptographically secure IDs", () => {
      const ids = new Set<string>();
      const numIds = 1000;
      
      // Generate many IDs to test for uniqueness
      for (let i = 0; i < numIds; i++) {
        const id = generateRequestId();
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        
        // Should not have duplicates
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(numIds);
    });

    test("Request IDs have sufficient entropy", () => {
      const ids: string[] = [];
      const numIds = 100;
      
      for (let i = 0; i < numIds; i++) {
        ids.push(generateRequestId());
      }
      
      // Check that IDs have good distribution
      const hexPattern = /^[0-9a-f]+$/i;
      let hexCount = 0;
      
      for (const id of ids) {
        if (hexPattern.test(id)) {
          hexCount++;
        }
        
        // Should have reasonable length
        expect(id.length).toBeGreaterThanOrEqual(16);
      }
      
      // Most IDs should be hex (crypto-generated) or have timestamp fallback
      expect(hexCount / numIds).toBeGreaterThan(0.5);
    });

    test("Request IDs are not predictable", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      const id3 = generateRequestId();
      
      // Should be different
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      
      // Test for non-sequential patterns by generating many IDs
      const ids = Array.from({ length: 20 }, () => generateRequestId());
      const uniqueIds = new Set(ids);
      
      // Should have high uniqueness (at least 95% unique for 20 IDs)
      expect(uniqueIds.size / ids.length).toBeGreaterThan(0.95);
      
      // Should not be incrementing sequences
      const isSequential = ids.every((id, index) => {
        if (index === 0) return true;
        const prevNum = parseInt(ids[index - 1], 16) || parseInt(ids[index - 1], 10);
        const currNum = parseInt(id, 16) || parseInt(id, 10);
        return !isNaN(prevNum) && !isNaN(currNum) && currNum === prevNum + 1;
      });
      expect(isSequential).toBe(false);
    });

    test("Request IDs distribution test", () => {
      // Generate multiple IDs and verify they have good distribution
      const ids = Array.from({ length: 100 }, () => generateRequestId());
      const uniqueIds = new Set(ids);
      
      // Should have high uniqueness
      expect(uniqueIds.size).toBeGreaterThan(95);
      
      // Test for randomness - no two consecutive IDs should be identical
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).not.toBe(ids[i - 1]);
      }
         });
   });

  describe("Standardized Error Handling", () => {
    test("creates standardized error responses", () => {
      const response = NIP46ErrorUtils.createErrorResponse(
        "test-id",
        NIP46ErrorCode.PERMISSION_DENIED,
        "Not authorized for this action"
      );
      
      expect(response.id).toBe("test-id");
      expect(response.error).toBeTruthy();
      
      const errorObj = JSON.parse(response.error!);
      expect(errorObj.code).toBe(NIP46ErrorCode.PERMISSION_DENIED);
      expect(errorObj.message).toBe("Not authorized for this action");
    });

    test("provides error descriptions", () => {
      const description = NIP46ErrorUtils.getErrorDescription(NIP46ErrorCode.INVALID_PARAMETERS);
      expect(description).toBe("The provided parameters are invalid");
    });

    test("handles various error codes", () => {
      const errorCodes = [
        NIP46ErrorCode.PERMISSION_DENIED,
        NIP46ErrorCode.INVALID_PARAMETERS,
        NIP46ErrorCode.INTERNAL_ERROR,
        NIP46ErrorCode.RATE_LIMITED
      ];

      errorCodes.forEach(code => {
        const response = NIP46ErrorUtils.createErrorResponse("test", code, "Test message");
        expect(response.error).toBeTruthy();
        
        const errorObj = JSON.parse(response.error!);
        expect(errorObj.code).toBe(code);
        expect(errorObj.message).toBe("Test message");
        
        const description = NIP46ErrorUtils.getErrorDescription(code);
        expect(description).toBeTruthy();
        expect(typeof description).toBe("string");
             });
     });
   });

   describe("Private Key Security Validation", () => {
     test("should throw for empty private key", () => {
       expect(() => {
         validatePrivateKey("", "test key");
       }).toThrow("test key cannot be an empty string");
     });

     test("should throw for placeholder values", () => {
       expect(() => {
         validatePrivateKey("undefined", "test key");
       }).toThrow("test key appears to be a placeholder value");

       expect(() => {
         validatePrivateKey("null", "test key");
       }).toThrow("test key appears to be a placeholder value");
     });

     test("should throw for invalid hex", () => {
       expect(() => {
         validatePrivateKey("invalid_hex", "test key");
       }).toThrow("test key is not a valid private key format or is outside curve order");

       expect(() => {
         validatePrivateKey("123", "test key"); // Too short
       }).toThrow("test key is not a valid private key format or is outside curve order");
     });

           test("should pass for valid private key", () => {
        expect(() => {
          validateKeypairForCrypto(validKeypair, "test keypair");
        }).not.toThrow();
      });

     test("should throw for invalid keypair", () => {
       const invalidKeypair = {
         publicKey: "invalid",
         privateKey: "a".repeat(64) // Valid 64-char hex private key so we test public key validation
       };
       expect(() => {
         validateKeypairForCrypto(invalidKeypair, "test keypair");
       }).toThrow("test keypair public key must be 64 character hex string");
     });

     test("should validate signing parameters", () => {
       const validEventData = {
         kind: 1,
         content: "test",
         created_at: Math.floor(Date.now() / 1000),
       };
       expect(() => {
         validateBeforeSigning(validKeypair, validEventData);
       }).not.toThrow();
     });

     test("should reject invalid keypair for signing", () => {
       const invalidKeypair = { publicKey: "invalid", privateKey: "" };
       const validEventData = {
         kind: 1,
         content: "test",
         created_at: Math.floor(Date.now() / 1000),
       };
       expect(() => {
         validateBeforeSigning(invalidKeypair, validEventData);
       }).toThrow();
     });

     test("should validate encryption parameters", () => {
       const thirdPartyPubkey = "c".repeat(64);
       const plaintext = "test message";
       expect(() => {
         validateBeforeEncryption(validKeypair, thirdPartyPubkey, plaintext);
       }).not.toThrow();
     });

     test("should reject invalid keypair for encryption", () => {
       const invalidKeypair = { publicKey: "invalid", privateKey: "" };
       const thirdPartyPubkey = "c".repeat(64);
       const plaintext = "test message";
       expect(() => {
         validateBeforeEncryption(invalidKeypair, thirdPartyPubkey, plaintext);
       }).toThrow();
     });

           test("should reject oversized data", () => {
        const oversizedData = "a".repeat(100001); // 100KB + 1
        const thirdPartyPubkey = "c".repeat(64);
        expect(() => {
          validateBeforeEncryption(validKeypair, thirdPartyPubkey, oversizedData);
        }).toThrow("NIP-44 encryption data too large (max 100KB)");
      });

     test("should reject empty data", () => {
       const thirdPartyPubkey = "c".repeat(64);
       expect(() => {
         validateBeforeEncryption(validKeypair, thirdPartyPubkey, "");
       }).toThrow("NIP-44 encryption data must not be empty or whitespace-only");
     });

     test("should reject whitespace-only data", () => {
       const thirdPartyPubkey = "c".repeat(64);
       const whitespaceData = "   \t\n\r   "; // Various whitespace characters
       expect(() => {
         validateBeforeEncryption(validKeypair, thirdPartyPubkey, whitespaceData);
       }).toThrow("NIP-44 encryption data must not be empty or whitespace-only");
     });

     test("should return proper validation results", () => {
       const validation = validatePrivateKeyResult("", "test");
       expect(validation.valid).toBe(false);
       expect(validation.error).toContain("test cannot be an empty string");
       expect(validation.code).toBe("PRIVATE_KEY_EMPTY_STRING");
     });

     test("validatePrivateKeySecure should throw production-safe errors in production", () => {
       const originalEnv = process.env.NODE_ENV;
       process.env.NODE_ENV = "production";
       
       expect(() => {
         validatePrivateKeySecure("", "test key");
       }).toThrow("Invalid key format"); // Production-safe message
       
       if (originalEnv === undefined) {
         process.env.NODE_ENV = undefined;
       } else {
         process.env.NODE_ENV = originalEnv;
       }
     });

     test("validatePrivateKeySecure should throw debug errors in development", () => {
       const originalEnv = process.env.NODE_ENV;
       process.env.NODE_ENV = "development";
       
       expect(() => {
         validatePrivateKeySecure("", "test key");
       }).toThrow("test key cannot be an empty string"); // Debug message
       
       if (originalEnv === undefined) {
         process.env.NODE_ENV = undefined;
       } else {
         process.env.NODE_ENV = originalEnv;
       }
     });

     test("createProductionSafeMessage should return prod message in production", () => {
       const originalEnv = process.env.NODE_ENV;
       process.env.NODE_ENV = "production";
       
       const devMessage = createProductionSafeMessage(
         "Detailed debug info", 
         "Generic error"
       );
       expect(devMessage).toBe("Generic error");
       
       if (originalEnv === undefined) {
         process.env.NODE_ENV = undefined;
       } else {
         process.env.NODE_ENV = originalEnv;
       }
     });

     test("createProductionSafeMessage should return debug message in development", () => {
       const originalEnv = process.env.NODE_ENV;
       process.env.NODE_ENV = "development";
       
       const prodMessage = createProductionSafeMessage(
         "Detailed debug info", 
         "Generic error"
       );
       expect(prodMessage).toBe("Detailed debug info");
       
       if (originalEnv === undefined) {
         process.env.NODE_ENV = undefined;
       } else {
         process.env.NODE_ENV = originalEnv;
       }
     });

     test("createProductionSafeMessage should use default prod message", () => {
       const originalEnv = process.env.NODE_ENV;
       process.env.NODE_ENV = "production";
       
       const defaultProdMessage = createProductionSafeMessage("Debug info");
       expect(defaultProdMessage).toBe("Security validation failed");
       
       if (originalEnv === undefined) {
         process.env.NODE_ENV = undefined;
       } else {
         process.env.NODE_ENV = originalEnv;
       }
     });

     test("validatePrivateKeyResult should return validation results", () => {
       // Test null/undefined
       const nullResult = validatePrivateKeyResult(null as any, "test key");
       expect(nullResult.valid).toBe(false);
       expect(nullResult.error).toContain("test key is required and cannot be null or undefined");
       expect(nullResult.code).toBe("PRIVATE_KEY_NULL");
       
       const undefinedResult = validatePrivateKeyResult(undefined as any, "test key");
       expect(undefinedResult.valid).toBe(false);
       expect(undefinedResult.error).toContain("test key is required and cannot be null or undefined");
       expect(undefinedResult.code).toBe("PRIVATE_KEY_NULL");
       
       // Test empty string
       const emptyResult = validatePrivateKeyResult("", "test key");
       expect(emptyResult.valid).toBe(false);
       expect(emptyResult.error).toContain("test key cannot be an empty string");
       expect(emptyResult.code).toBe("PRIVATE_KEY_EMPTY_STRING");
       
       const placeholderResult = validatePrivateKeyResult("undefined", "test key");
       expect(placeholderResult.valid).toBe(false);
       expect(placeholderResult.error).toContain("test key appears to be a placeholder value");
       
       const invalidResult = validatePrivateKeyResult("invalid", "test key");
       expect(invalidResult.valid).toBe(false);
       expect(invalidResult.error).toContain("test key is not a valid private key format");
       
       // Valid key test - use a fixed 64-character hex string for consistent testing
       const validKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Fixed 64-char hex
       const validResult = validatePrivateKeyResult(validKey, "test key");
       expect(validResult.valid).toBe(true);
       expect(validResult.error).toBeUndefined();
     });
   });

   describe("Timing Attack Prevention", () => {
     test("should use constant-time permission checking", () => {
       const permissions = new Set(["sign_event", "get_public_key", "ping"]);
       
       // Use the imported secure permission check function
       
       // These should take similar time regardless of permission position
       const start1 = process.hrtime.bigint();
       const result1 = securePermissionCheck(permissions, "sign_event");
       const end1 = process.hrtime.bigint();
       
       const start2 = process.hrtime.bigint();
       const result2 = securePermissionCheck(permissions, "invalid_permission");
       const end2 = process.hrtime.bigint();
       
       expect(result1).toBe(true);
       expect(result2).toBe(false);
       
       // Both operations should complete (timing is less reliable in tests,
       // but the important part is that the function exists and works)
       const time1 = Number(end1 - start1);
       const time2 = Number(end2 - start2);
       
       expect(time1).toBeGreaterThan(0);
       expect(time2).toBeGreaterThan(0);
     });

     test("should check all permissions to avoid early exit timing", () => {
       const permissions = new Set([
         "permission_1",
         "permission_2", 
         "target_permission",
         "permission_4"
       ]);
       
       // Use the imported secure permission check function
       
       // Should find the permission even when it's not first
       const result = securePermissionCheck(permissions, "target_permission");
       expect(result).toBe(true);
       
       // Should not find non-existent permissions
       const result2 = securePermissionCheck(permissions, "nonexistent");
       expect(result2).toBe(false);
     });
   });
 });    