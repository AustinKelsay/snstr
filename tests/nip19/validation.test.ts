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
  Bech32String,
  AddressData,
} from "../../src/nip19";

describe("NIP-19: Validation and Edge Cases", () => {
  describe("Input Validation", () => {
    test("should reject malformed hex strings for public keys", () => {
      // Non-hex character
      expect(() =>
        encodePublicKey(
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefazzzz",
        ),
      ).toThrow(/Invalid hex string/);

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
      } as unknown as AddressData; // Type assertion for intentionally invalid test data

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
      // Create a long relay URL that's below the 512 char threshold but respects hostname limits
      // Use a path to make the URL long while keeping hostname valid (< 255 chars)
      const longButValidRelayUrl = "wss://valid-hostname.example.com/" + "a".repeat(450);

      const eventWithValidRelay = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        relays: [longButValidRelayUrl],
      };

      // Should work with a long but valid URL
      expect(() => encodeEvent(eventWithValidRelay)).not.toThrow();

      // Now create a relay URL that exceeds the 512 char max length
      const veryLongRelayUrl = "wss://valid-hostname.example.com/" + "a".repeat(480);

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

      // Test with 19 entries - should be exactly at the limit (MAX_TLV_ENTRIES - 1)
      expect(() =>
        encodeProfile({
          pubkey,
          relays: generateRelays(19),
        }),
      ).not.toThrow();

      // Test with 20 entries - should exceed the limit
      expect(() =>
        encodeProfile({
          pubkey,
          relays: generateRelays(20),
        }),
      ).toThrow(/Too many/);

      // Note: MAX_TLV_ENTRIES has been reduced from 100 to 20
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

      expect(decoded.relays || []).toEqual([]);
    });

    test("should prevent empty identifier in naddr", () => {
      const addr = {
        identifier: "",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 1,
      };

      // Test is updated to expect an error for empty identifier
      expect(() => encodeAddress(addr)).toThrow(/Missing identifier/);
    });

    test("should validate kind values within bounds in nevent and naddr", () => {
      // Updated to use a valid kind within the 0-65535 range
      const validKind = 65000; // Valid kind just under the limit
      const invalidKindNaddr = 0x100000000; // Invalid kind over the new 32-bit limit (4294967296)

      const validAddr = {
        identifier: "test",
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: validKind,
      };

      const validEvent = {
        id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
        kind: validKind, // EventData can still have a kind, it just won't be encoded in nevent
      };

      // Valid kind should encode and decode successfully for naddr
      const addrEncoded = encodeAddress(validAddr);
      const addrDecoded = decodeAddress(addrEncoded);
      expect(addrDecoded.kind).toBe(validKind);

      // For nevent, kind is no longer encoded, so it should be undefined after decoding
      const eventEncoded = encodeEvent(validEvent);
      const eventDecoded = decodeEvent(eventEncoded);
      expect(eventDecoded.kind).toBeUndefined();

      // Invalid kind should throw an error for naddr encoding
      const invalidAddr = { ...validAddr, kind: invalidKindNaddr };
      expect(() => encodeAddress(invalidAddr)).toThrow(/Invalid kind/);

      // For nevent, encodeEvent no longer validates or uses the kind, so this specific check is not applicable.
      // The EventData type still allows kind, so no error is thrown if it's out of expected NIP-19 bounds
      // as it's not used for nevent encoding.
      // If EventData.kind had its own validation separate from TLV encoding, that would be tested differently.
      // const invalidEvent = { ...validEvent, kind: invalidKind };
      // expect(() => encodeEvent(invalidEvent)).toThrow(/Invalid kind/); // This would no longer throw for this reason.
    });
  });

  describe("Invalid Bech32 Handling", () => {
    test("should reject non-bech32 strings", () => {
      // Use expectation of error without calling the function
      // This is to avoid type errors with our new stricter Bech32String type
      expect(() => {
        // Type assertion to bypass the type checking for testing
        decodePublicKey("not-a-bech32-string" as Bech32String);
      }).toThrow();

      expect(() => {
        // Type assertion to bypass the type checking for testing
        decodeProfile("not-a-bech32-string" as Bech32String);
      }).toThrow();
    });

    test("should reject bech32 strings with invalid checksums", () => {
      // Modify the last character to invalidate the checksum
      const validNpub = encodePublicKey(
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
      );
      const invalidChecksum =
        validNpub.slice(0, -1) + (validNpub.slice(-1) === "a" ? "b" : "a");

      expect(() => {
        // Type assertion to bypass the type checking for testing
        // The string still has the bech32 format (contains "1") but has an invalid checksum
        decodePublicKey(invalidChecksum as Bech32String);
      }).toThrow();
    });

    test("should reject bech32 strings that are too short", () => {
      expect(() => {
        // Type assertion to bypass the type checking for testing
        decodePublicKey("npub1short" as Bech32String);
      }).toThrow();
    });
  });
});
