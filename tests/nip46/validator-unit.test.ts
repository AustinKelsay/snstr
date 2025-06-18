import { NIP46Validator, SecureErrorHandler } from "../../src/nip46/utils/validator";
import { NIP46Method, NIP46Request } from "../../src/nip46/types";
import { generateKeypair } from "../../src/utils/crypto";

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
  });
}); 