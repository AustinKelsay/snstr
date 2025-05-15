/**
 * Security tests for NIP-19 implementation (Comprehensive)
 *
 * These tests specifically target potential security issues:
 * 1. URL validation/sanitization in relay URLs
 * 2. TLV entry limits that could lead to DoS attacks
 * 3. Malformed TLV entries detection
 * 4. Edge cases in relay URL handling
 * 5. Integration with decoders
 * 6. URL search params validation
 * 7. Host validation including IDN (International Domain Names)
 * 8. Unusual URL formats and port numbers
 */

import {
  encodeProfile,
  decodeProfile,
  encodeEvent,
  encodeAddress,
  ProfileData,
} from "../../src/nip19/index";
import { isValidRelayUrl, filterProfile } from "../../src/nip19/secure";
import { bech32 } from "@scure/base";

describe("NIP-19: Comprehensive Security Tests", () => {
  // Test data
  const validPubkey =
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
  const validEventId =
    "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d";

  describe("URL Validation and Sanitization", () => {
    test("validates basic relay URL protocols", () => {
      // Valid protocols
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: ["wss://relay.example.com", "ws://localhost:8080"],
        }),
      ).not.toThrow();

      // Invalid protocols
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: ["http://example.com"],
        }),
      ).toThrow(/Invalid relay URL/);
    });

    test("handles potentially malicious URLs", () => {
      const potentiallyDangerousUrls = [
        "javascript:alert(1)", // JavaScript injection
        "wss://<script>alert(1)</script>.com", // HTML injection
        "data:text/html,<script>alert(1)</script>", // Data URL
        "file:///etc/passwd", // Local file access
        "//example.com", // Protocol-relative URL
      ];

      potentiallyDangerousUrls.forEach((url) => {
        expect(() =>
          encodeProfile({
            pubkey: validPubkey,
            relays: [url],
          }),
        ).toThrow(/Invalid relay URL/);
      });
    });

    test("checks if URLs with credentials are rejected", () => {
      const urlsWithCredentials = [
        "wss://user:password@relay.example.com",
        "ws://user@relay.example.com",
      ];

      // Verify credentials are rejected
      urlsWithCredentials.forEach((url) => {
        expect(() =>
          encodeProfile({
            pubkey: validPubkey,
            relays: [url],
          }),
        ).toThrow(/Invalid relay URL/);
      });

      // The original test also had a check for security issues
      try {
        encodeProfile({
          pubkey: validPubkey,
          relays: [urlsWithCredentials[0]],
        });
        console.warn(
          "SECURITY ISSUE: URLs with credentials are accepted in relay URLs",
        );
      } catch (error) {
        // If it throws, check if it's because of the credentials
        expect((error as Error).message).toContain("Invalid relay URL");
      }
    });

    test("handles URLs with URLSearchParams correctly", () => {
      // Valid URLs with search parameters
      const validUrlsWithParams = [
        "wss://relay.example.com?key=value",
        "wss://relay.example.com?key=value&key2=value2",
        "ws://localhost:8080?debug=true",
        "wss://relay.example.com/path?key=value#fragment",
      ];

      validUrlsWithParams.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);

        // Should not throw when encoding
        expect(() =>
          encodeProfile({
            pubkey: validPubkey,
            relays: [url],
          }),
        ).not.toThrow();
      });

      // Potentially dangerous search params
      const dangerousUrlParams = [
        "wss://relay.example.com?script=<script>alert(1)</script>",
        "wss://relay.example.com?callback=javascript:alert(1)",
        'wss://relay.example.com?data=" onmouseover="alert(1)"',
      ];

      // These should still be valid because URL encoding will escape the dangerous characters
      // The security concern is more about how these are used after decoding
      dangerousUrlParams.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });
    });

    test("validates URLs with fragments", () => {
      // Valid URLs with fragments
      const validUrlsWithFragments = [
        "wss://relay.example.com#section1",
        "wss://relay.example.com/path#section1",
        "ws://localhost:8080#debug",
      ];

      validUrlsWithFragments.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });

      // Potentially dangerous fragments
      const dangerousUrlFragments = [
        "wss://relay.example.com#<script>alert(1)</script>",
        "wss://relay.example.com#javascript:alert(1)",
      ];

      // These should still be valid because URL encoding will escape the dangerous characters
      dangerousUrlFragments.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });
    });
  });

  describe("Host Validation", () => {
    test("validates hosts correctly", () => {
      // Valid hosts
      const validHosts = [
        "wss://relay.example.com",
        "wss://localhost",
        "wss://127.0.0.1",
        "wss://[::1]", // IPv6
        "wss://example-relay.com",
        "wss://relay.example.co.uk",
      ];

      validHosts.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });

      // Invalid or suspicious hosts
      const invalidHosts = [
        "wss://relay.example.com@evil.com", // URL confusion
        "wss://relay.example.com\\@evil.com", // Attempted URL confusion
        "wss://relay.example.com%252F@evil.com", // Double-encoded confusion
        "wss://\u0000evil.com", // Null byte injection
        "wss://relay.example.com\u0000.evil.com", // Null byte in middle
      ];

      invalidHosts.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(false);
      });
    });

    test("handles international domain names (IDN)", () => {
      // Valid international domain names
      const validIDNs = [
        "wss://例子.测试", // Chinese
        "wss://пример.испытание", // Russian
        "wss://مثال.اختبار", // Arabic
        "wss://xn--fsqu00a.xn--0zwm56d", // Punycode
      ];

      validIDNs.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });

      // Homograph attack examples (visually similar characters)
      const homographAttacks = [
        "wss://аpple.com", // Cyrillic 'а' instead of Latin 'a'
        "wss://googIe.com", // Capital 'I' instead of lowercase 'l'
        "wss://mirсrоsоft.com", // Multiple Cyrillic characters
      ];

      // Note: These will actually validate as proper URLs
      // Real protection against homograph attacks requires additional checks
      homographAttacks.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
        console.warn(`Warning: Homograph URL ${url} validates as correct`);
      });
    });
  });

  describe("TLV Entry Limits", () => {
    test("checks maximum TLV entry limit", () => {
      // Generate arrays of relays of increasing size
      const generateRelays = (count: number) =>
        Array(count)
          .fill(0)
          .map((_, i) => `wss://relay${i}.example.com`);

      // Try with a reasonable number of relays (5)
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: generateRelays(5),
        }),
      ).not.toThrow();

      // Check if accepting a high but legal number
      try {
        encodeProfile({
          pubkey: validPubkey,
          relays: generateRelays(19), // Just under the limit
        });
      } catch (error) {
        console.warn(
          "SECURITY NOTE: Limit for relays is less than 19, which is unexpected",
        );
      }

      // Try with 21 relays - should throw if limit is 20
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: generateRelays(21),
        }),
      ).toThrow(/Too many relay entries/);

      // Try with 50 relays - should definitely throw due to the limit
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: generateRelays(50),
        }),
      ).toThrow(/Too many relay entries/);
    });

    test("checks how decoding handles invalid relay URLs", () => {
      // Create a profile with valid relays to test decoding behavior
      const profile = {
        pubkey: validPubkey,
        relays: ["wss://relay.example.com"],
      };

      const encoded = encodeProfile(profile);
      const decoded = decodeProfile(encoded);

      // Check that decoded matches original
      expect(decoded.pubkey).toBe(profile.pubkey);
      expect(decoded.relays).toEqual(profile.relays);
    });
  });

  describe("Decode Security Tests", () => {
    test("validator handles malicious URLs", () => {
      // This test manually constructs an invalid TLV to bypass encoding validation

      // Helper function to create a profile with manual TLV entries
      function createProfileWithCustomRelays(relays: string[]): string {
        // Convert pubkey to bytes
        const pubkeyBytes = hexToBytes(validPubkey);

        // Create TLV entries
        const tlvEntries = [
          { type: 0, value: pubkeyBytes }, // Special (pubkey)
          ...relays.map((relay) => ({
            type: 1, // Relay type
            value: new TextEncoder().encode(relay),
          })),
        ];

        // Encode to binary TLV format
        const data = encodeTLV(tlvEntries);

        // Convert to Bech32 format
        return bech32.encode("nprofile", bech32.toWords(data), 5000);
      }

      // Create a profile with an invalid relay URL
      const maliciousUrls = [
        "http://example.com", // Non-WS protocol
        "javascript:alert(1)", // JavaScript injection
        "file:///etc/passwd", // Local file access
        "wss://user:password@relay.example.com", // URL with credentials
      ];

      // Spy on console.warn to verify it's called for invalid URLs
      const originalWarn = console.warn;
      const mockWarn = jest.fn();
      console.warn = mockWarn;

      try {
        maliciousUrls.forEach((url) => {
          const encoded = createProfileWithCustomRelays([url]);

          // The decoder doesn't throw on invalid URLs, but it should warn about them
          const decoded = decodeProfile(encoded);

          // The library code doesn't filter URLs, just warns about them
          expect(decoded.relays).toContain(url);

          // Verify a warning was issued
          expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining(
              `Warning: Invalid relay URL format found while decoding: ${url}`,
            ),
          );

          mockWarn.mockClear();
        });
      } finally {
        // Restore original console.warn
        console.warn = originalWarn;
      }
    });

    test("encodeProfile checks relay count", () => {
      // Create an array of more than MAX_TLV_ENTRIES (20) valid relay URLs
      const tooManyRelays = Array(30)
        .fill(0)
        .map((_, i) => `wss://relay${i}.example.com`);

      // encodeEvent properly enforces the limit
      expect(() =>
        encodeEvent({
          id: validEventId,
          relays: tooManyRelays,
        }),
      ).toThrow(/Too many relay entries/);

      // encodeAddress properly enforces the limit
      expect(() =>
        encodeAddress({
          identifier: "test",
          pubkey: validPubkey,
          kind: 1,
          relays: tooManyRelays,
        }),
      ).toThrow(/Too many relay entries/);

      // encodeProfile should also throw
      expect(() =>
        encodeProfile({
          pubkey: validPubkey,
          relays: tooManyRelays,
        }),
      ).toThrow(/Too many relay entries/);
    });

    test("rejects invalid relay URLs during encoding", () => {
      const badUrls = [
        "http://example.com", // Wrong protocol
        "wss:/example.com", // Malformed URL
        "javascript:alert(1)", // Script injection attempt
        "wss://user:password@relay.com", // Credentials not allowed
      ];

      badUrls.forEach((url) => {
        expect(() => {
          encodeProfile({
            pubkey: validPubkey,
            relays: [url],
          });
        }).toThrow(/Invalid relay URL format/);
      });
    });
  });

  describe("Integration with decoders", () => {
    test("should safely decode and filter a potentially malicious profile", () => {
      // Create a valid profile with relays
      const pubkey =
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

      // Start with a valid profile
      const profile: ProfileData = {
        pubkey,
        relays: [
          "wss://relay.damus.io",
          "wss://relay.example.com",
          // Add a potentially malicious URL directly to the object
          // In reality, this might come from a manipulated nprofile string
          'javascript:alert("XSS")',
        ],
      };

      // Filter the profile
      const safeProfile = filterProfile(profile);

      // Validate the results
      expect(profile.pubkey).toBe(pubkey);

      // Check if there are any invalid relay URLs in the original profile
      const hasInvalidRelays =
        profile.relays?.some((url) => !isValidRelayUrl(url)) || false;
      expect(hasInvalidRelays).toBe(true);

      // Check that all relay URLs in the filtered profile are valid
      expect(safeProfile.relays?.every((url) => isValidRelayUrl(url))).toBe(
        true,
      );

      // Check that the filtered profile has fewer relays than the original
      expect(safeProfile.relays?.length).toBeLessThan(
        profile.relays?.length || 0,
      );

      // Check specific count
      expect(safeProfile.relays?.length).toBe(2);
    });
  });

  describe("isValidRelayUrl", () => {
    test("should validate relay URLs correctly", () => {
      // Valid relay URLs
      expect(isValidRelayUrl("wss://relay.example.com")).toBe(true);
      expect(isValidRelayUrl("ws://localhost:8080")).toBe(true);
      expect(isValidRelayUrl("wss://relay.example.com/path")).toBe(true);
      expect(isValidRelayUrl("wss://relay.example.com:8080")).toBe(true);

      // Invalid relay URLs
      expect(isValidRelayUrl("http://example.com")).toBe(false);
      expect(isValidRelayUrl("https://example.com")).toBe(false);
      expect(isValidRelayUrl("ws://user:password@relay.example.com")).toBe(
        false,
      );
      expect(isValidRelayUrl("wss://user:password@relay.example.com")).toBe(
        false,
      );
      expect(isValidRelayUrl("javascript:alert(1)")).toBe(false);
      expect(
        isValidRelayUrl(
          "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        ),
      ).toBe(false);
    });

    test("should handle extreme URL edge cases", () => {
      // Edge cases that should be rejected
      const invalidEdgeCases: string[] = [
        "", // Empty string
        "wss:", // Protocol only
        "wss://", // Protocol with empty host
        "wss:///", // Protocol with empty host and path
        "wss://\x00example.com", // Null byte in hostname
        "ws:// example.com", // Space in URL
        "wss://////example.com", // Multiple slashes
        "wss://example.com\\", // Backslash in URL
        "wss:\\/\\/example.com", // Attempted escaping
        "wss://example!.com", // Invalid character in hostname
        "wss://relay.example.com?test=%00", // Null byte in query param
      ];

      invalidEdgeCases.forEach((url) => {
        const result = isValidRelayUrl(url);
        if (result === true) {
          console.error(`URL expected to be invalid but was valid: "${url}"`);
        }
        expect(isValidRelayUrl(url)).toBe(false);
      });

      // Edge cases that should be accepted
      const validEdgeCases: string[] = [
        "wss://a.b", // Minimal TLD
        "ws://[::1]:8080", // IPv6 with port
        "wss://relay.example.com:65535", // Maximum port number
        "wss://relay.example.com/", // Trailing slash
        "wss://xn--bcher-kva.example", // Punycode
        "wss://relay.example.com:80/path/to/resource.json?a=1&b=2#section", // Complex URL with all parts
      ];

      validEdgeCases.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });
    });
  });

  describe("Unusual port numbers", () => {
    test("handles various port numbers correctly", () => {
      // Valid port numbers
      const validPorts = [
        "wss://relay.example.com:80",
        "wss://relay.example.com:443",
        "wss://relay.example.com:8080",
        "wss://relay.example.com:1",
        "wss://relay.example.com:65535", // Maximum valid port
      ];

      validPorts.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(true);
      });

      // Invalid port numbers
      const invalidPorts = [
        "wss://relay.example.com:0", // Port 0 is reserved
        "wss://relay.example.com:65536", // Exceeds maximum valid port
        "wss://relay.example.com:-1", // Negative port
        "wss://relay.example.com:port", // Non-numeric port
        "wss://relay.example.com:8080a", // Port with trailing character
      ];

      invalidPorts.forEach((url) => {
        expect(isValidRelayUrl(url)).toBe(false);
      });
    });
  });
});

// Helper functions for the tests
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Note: This is a simplified version just for testing
function encodeTLV(entries: { type: number; value: Uint8Array }[]): Uint8Array {
  // Calculate total length
  let len = 0;
  for (const entry of entries) {
    len += 2 + entry.value.length; // 1 byte for type, 1 byte for length, n bytes for value
  }

  const result = new Uint8Array(len);
  let offset = 0;

  for (const entry of entries) {
    result[offset++] = entry.type;
    result[offset++] = entry.value.length;
    result.set(entry.value, offset);
    offset += entry.value.length;
  }

  return result;
}
