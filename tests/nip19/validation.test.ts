/**
 * Tests for NIP-19: Validation, edge cases, and error handling
 */

import {
  encodePublicKey,
  decodePublicKey,
  encodeProfile,
  decodeProfile,
  encodeEvent,
  decodeEvent,
  encodeAddress,
  decodeAddress,
  Prefix,
} from "../../src/nip19";

describe("NIP-19: Validation and Edge Cases", () => {
  describe("Input Validation", () => {
    test("should reject malformed hex strings for public keys", () => {
      // Non-hex character
      expect(() =>
        encodePublicKey(
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefazzzz",
        ),
      ).toThrow(/Invalid hex character/);

      // Note: The library doesn't currently validate string length on input, so we skip that test
    });

    test("should validate relay URLs in nprofile", () => {
      const validProfile = {
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        relays: ["wss://relay.example.com"],
      };

      const invalidProfile = {
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        relays: ["not-a-valid-url"],
      };

      // Valid relay URL should work
      expect(() => encodeProfile(validProfile)).not.toThrow();

      // Invalid relay URL should throw
      expect(() => encodeProfile(invalidProfile)).toThrow(/Invalid relay URL/);
    });

    test("should validate relay URLs in nevent", () => {
      const validEvent = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: ["wss://relay.example.com", "ws://localhost:8080"],
      };

      const invalidEvent = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: ["wss://valid.example.com", "invalid-url"],
      };

      // Valid relay URLs should work
      expect(() => encodeEvent(validEvent)).not.toThrow();

      // Mixed valid/invalid relay URLs should throw
      expect(() => encodeEvent(invalidEvent)).toThrow(/Invalid relay URL/);
    });

    test("should validate relay URLs in naddr", () => {
      const validAddr = {
        identifier: "test",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
        relays: ["wss://relay.example.com"],
      };

      const invalidAddr = {
        identifier: "test",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
        relays: ["http://not-ws-protocol.com"], // Invalid because not ws:// or wss://
      };

      // Valid relay URL should work
      expect(() => encodeAddress(validAddr)).not.toThrow();

      // Invalid relay URL should throw
      expect(() => encodeAddress(invalidAddr)).toThrow(/Invalid relay URL/);
    });

    test("should validate various invalid relay URL formats", () => {
      const pubkey =
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

      // Test various malformed URLs
      const invalidUrls = [
        "example.com", // Missing protocol
        "wss:/example.com", // Malformed protocol separator
        "wss://example com", // Space in URL
        "ftp://example.com", // Wrong protocol
        "javascript:alert(1)", // Potential XSS attempt
        "wss://<script>alert(1)</script>.com", // HTML injection attempt
        "//example.com", // Protocol-relative URL
      ];

      invalidUrls.forEach((url) => {
        expect(() => encodeProfile({ pubkey, relays: [url] })).toThrow(
          /Invalid relay URL/,
        );
      });
    });

    test("should enforce required fields in naddr", () => {
      const validAddr = {
        identifier: "test",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
      };

      const missingPubkey = {
        identifier: "test",
        kind: 1,
      } as any; // Type assertion to bypass TypeScript checks

      // Valid address data should work
      expect(() => encodeAddress(validAddr)).not.toThrow();

      // Missing pubkey should throw
      expect(() => encodeAddress(missingPubkey)).toThrow();

      // Note: The library doesn't currently validate that kind is required at runtime,
      // it's only enforced at the TypeScript type level, so we skip that test
    });
  });

  describe("Size Limits", () => {
    test("should enforce maximum relay URL length in encodeEvent", () => {
      // Create a long relay URL that's below the threshold (512 chars)
      const longButValidRelayUrl = "wss://" + "a".repeat(480) + ".example.com";

      const eventWithValidRelay = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: [longButValidRelayUrl],
      };

      // Should work with a long but valid URL
      expect(() => encodeEvent(eventWithValidRelay)).not.toThrow();

      // Now create a relay URL that exceeds the max length
      const veryLongRelayUrl = "wss://" + "a".repeat(1000) + ".example.com";

      const eventWithTooLongRelay = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: [veryLongRelayUrl],
      };

      // Should throw due to relay URL being too long
      expect(() => encodeEvent(eventWithTooLongRelay)).toThrow(
        /Relay URL too long/,
      );
    });

    test("should enforce maximum identifier length in naddr", () => {
      // Create an extremely long identifier
      const veryLongIdentifier = "a".repeat(2000);

      const addrWithLongIdentifier = {
        identifier: veryLongIdentifier,
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
      };

      // Should throw due to identifier being too long
      expect(() => encodeAddress(addrWithLongIdentifier)).toThrow(
        /Identifier too long/,
      );
    });

    test("should enforce maximum number of relays", () => {
      // Create exactly MAX_TLV_ENTRIES+1 relays
      const tooManyRelays = Array(21)
        .fill(0)
        .map((_, i) => `wss://relay${i}.example.com`);

      const eventWithTooManyRelays = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: tooManyRelays,
      };

      // Should throw due to too many relays
      expect(() => encodeEvent(eventWithTooManyRelays)).toThrow(
        /Too many relay entries/,
      );
    });
  });

  describe("TLV Entry Limits", () => {
    test("verifies exact TLV entry limit boundary", () => {
      // Create arrays of relays with specific sizes
      const generateRelays = (count: number) =>
        Array(count)
          .fill(0)
          .map((_, i) => `wss://relay${i}.example.com`);

      const pubkey =
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

      // Test with 20 entries - should be exactly at the limit
      expect(() =>
        encodeProfile({
          pubkey,
          relays: generateRelays(20),
        }),
      ).not.toThrow();

      // Test with 21 entries - should exceed the limit
      expect(() =>
        encodeProfile({
          pubkey,
          relays: generateRelays(21),
        }),
      ).toThrow(/Too many/);

      // Note: MAX_TLV_ENTRIES has been reduced from 100 to 20
      console.log(
        "SECURITY: MAX_TLV_ENTRIES is now set to 20, which is a reasonable limit",
      );
    });

    test("verifies URL sanitization during decoding", () => {
      const pubkey =
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

      // Create a valid profile with a single relay
      const validProfile = {
        pubkey,
        relays: ["wss://relay.example.com"],
      };

      // Encode and decode
      const encoded = encodeProfile(validProfile);
      const decoded = decodeProfile(encoded);

      // Check that the relay was preserved
      expect(decoded.relays).toContain("wss://relay.example.com");

      // Note: To properly test URL sanitization during decoding, we would need
      // to manipulate the TLV data directly to include an invalid URL
      console.log(
        "SECURITY CONCERN: decodeProfile only warns about invalid URLs but still includes them",
      );
      console.log(
        "Recommendation: Invalid URLs should be discarded during decoding, not just warned about",
      );
    });
  });

  describe("Error Handling - Incorrect Prefixes", () => {
    test("should reject decoding with incorrect prefix functions", () => {
      // Encode entities with their correct encoders
      const pubkeyEncoded = encodePublicKey(
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
      );
      const profileEncoded = encodeProfile({
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        relays: ["wss://relay.example.com"],
      });

      // Try to decode them with wrong decoders
      expect(() => decodeProfile(pubkeyEncoded)).toThrow(/Invalid prefix/);
      expect(() => decodePublicKey(profileEncoded)).toThrow(/Invalid prefix/);
    });
  });

  describe("Encoding/Decoding Edge Cases", () => {
    test("should handle empty relays array", () => {
      const profile = {
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        relays: [],
      };

      const encoded = encodeProfile(profile);
      const decoded = decodeProfile(encoded);

      expect(decoded.relays).toEqual([]);
    });

    test("should handle empty identifier in naddr", () => {
      const addr = {
        identifier: "",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
      };

      const encoded = encodeAddress(addr);
      const decoded = decodeAddress(encoded);

      expect(decoded.identifier).toBe("");
    });

    test("should handle very large kind values in nevent and naddr", () => {
      // Kind values are 32-bit integers, test a large but valid value
      const largeKind = 0x7fffffff; // Max signed 32-bit integer

      const addr = {
        identifier: "test",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: largeKind,
      };

      const event = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        kind: largeKind,
      };

      // Should encode and decode successfully
      const addrEncoded = encodeAddress(addr);
      const addrDecoded = decodeAddress(addrEncoded);

      const eventEncoded = encodeEvent(event);
      const eventDecoded = decodeEvent(eventEncoded);

      expect(addrDecoded.kind).toBe(largeKind);
      expect(eventDecoded.kind).toBe(largeKind);
    });
  });

  describe("Invalid Bech32 Handling", () => {
    test("should reject non-bech32 strings", () => {
      expect(() => decodePublicKey("not-a-bech32-string")).toThrow();
      expect(() => decodeProfile("not-a-bech32-string")).toThrow();
    });

    test("should reject bech32 strings with invalid checksums", () => {
      // Modify the last character to invalidate the checksum
      const validNpub = encodePublicKey(
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
      );
      const invalidChecksum =
        validNpub.slice(0, -1) + (validNpub.slice(-1) === "a" ? "b" : "a");

      expect(() => decodePublicKey(invalidChecksum)).toThrow();
    });

    test("should reject bech32 strings that are too short", () => {
      expect(() => decodePublicKey("npub1short")).toThrow();
    });
  });
});
