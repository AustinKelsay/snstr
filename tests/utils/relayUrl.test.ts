import {
  preprocessRelayUrl,
  normalizeRelayUrl,
  validateAndNormalizeRelayUrl,
  RelayUrlValidationError,
} from "../../src/utils/relayUrl";

describe("relayUrl utils", () => {
  describe("preprocessRelayUrl", () => {
    test("should handle IPv6 addresses with ports and paths correctly", () => {
      // Regression test for IPv6 addresses with paths
      const testCases = [
        {
          input: "2001:db8::1:8080/chat",
          expected: "wss://[2001:db8::1]:8080/chat",
        },
        {
          input: "2001:db8::1:8080/path/to/resource",
          expected: "wss://[2001:db8::1]:8080/path/to/resource",
        },
        {
          input: "::1:8080/ws",
          expected: "wss://[::1]:8080/ws",
        },
        {
          input: "fe80::1:3000/relay?param=value#fragment",
          expected: "wss://[fe80::1]:3000/relay?param=value#fragment",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(preprocessRelayUrl(input)).toBe(expected);
      });
    });

    test("should handle IPv6 addresses without ports correctly", () => {
      const testCases = [
        {
          input: "[2001:db8::1]/chat",
          expected: "wss://[2001:db8::1]/chat",
        },
        {
          input: "[::1]/ws",
          expected: "wss://[::1]/ws",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(preprocessRelayUrl(input)).toBe(expected);
      });
    });

    test("should handle regular hostnames with paths correctly", () => {
      const testCases = [
        {
          input: "example.com/chat",
          expected: "wss://example.com/chat",
        },
        {
          input: "relay.example.com:8080/ws/path",
          expected: "wss://relay.example.com:8080/ws/path",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(preprocessRelayUrl(input)).toBe(expected);
      });
    });

    test("should preserve existing wss:// scheme", () => {
      const input = "wss://[2001:db8::1]:8080/chat";
      expect(preprocessRelayUrl(input)).toBe(input);
    });

    test("should reject invalid schemes with RelayUrlValidationError", () => {
      expect(() => preprocessRelayUrl("http://example.com")).toThrow(
        RelayUrlValidationError,
      );
      expect(() => preprocessRelayUrl("https://example.com")).toThrow(
        RelayUrlValidationError,
      );

      // Test specific error properties
      try {
        preprocessRelayUrl("http://example.com");
      } catch (error) {
        expect(error).toBeInstanceOf(RelayUrlValidationError);
        expect((error as RelayUrlValidationError).errorType).toBe("scheme");
        expect((error as RelayUrlValidationError).invalidUrl).toBe(
          "http://example.com",
        );
      }
    });

    test("should handle edge cases with RelayUrlValidationError", () => {
      expect(() => preprocessRelayUrl("")).toThrow(RelayUrlValidationError);
      expect(() => preprocessRelayUrl("   ")).toThrow(RelayUrlValidationError);
      expect(preprocessRelayUrl("//example.com")).toBe("wss://example.com");

      // Test specific error properties for format errors
      try {
        preprocessRelayUrl("");
      } catch (error) {
        expect(error).toBeInstanceOf(RelayUrlValidationError);
        expect((error as RelayUrlValidationError).errorType).toBe("format");
      }
    });
  });

  describe("normalizeRelayUrl", () => {
    test("should normalize IPv6 URLs with paths correctly", () => {
      const input = "WSS://[2001:DB8::1]:8080/Chat";
      const expected = "wss://[2001:db8::1]:8080/Chat";
      expect(normalizeRelayUrl(input)).toBe(expected);
    });

    test("should preserve case in paths, queries, and fragments", () => {
      const input =
        "WSS://EXAMPLE.COM:8080/Path/To/Resource?Query=Value#Fragment";
      const expected =
        "wss://example.com:8080/Path/To/Resource?Query=Value#Fragment";
      expect(normalizeRelayUrl(input)).toBe(expected);
    });

    test("should remove root pathname", () => {
      expect(normalizeRelayUrl("wss://example.com/")).toBe("wss://example.com");
    });
  });

  describe("validateAndNormalizeRelayUrl", () => {
    test("should return normalized URL for valid inputs", () => {
      const input = "2001:db8::1:8080/chat";
      const result = validateAndNormalizeRelayUrl(input);
      expect(result).toBe("wss://[2001:db8::1]:8080/chat");
    });

    test("should return undefined for invalid inputs", () => {
      // Note: "invalid-url" actually gets normalized to "wss://invalid-url" which may be valid
      // Let's test with truly invalid URLs
      expect(validateAndNormalizeRelayUrl("")).toBeUndefined();
      expect(
        validateAndNormalizeRelayUrl("http://example.com"),
      ).toBeUndefined();
    });
  });
});
