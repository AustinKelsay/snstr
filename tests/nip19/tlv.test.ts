/**
 * Tests for NIP-19: TLV (Type-Length-Value) entity encoding and decoding
 */

import {
  encodeProfile,
  decodeProfile,
  encodeAddress,
  decodeAddress,
  encodeEvent,
  decodeEvent,
  decode,
  ProfileData,
  EventData,
  AddressData,
  Bech32String,
  DecodedEntity,
  Prefix
} from "../../src/nip19";

// Test data fixtures for TLV entities
const TEST_FIXTURES = {
  profile: {
    pubkey: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
    relays: ["wss://relay.example.com", "wss://relay.nostr.org"],
  },
  relay: {
    url: "wss://relay.example.com",
  },
  event: {
    id: "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c",
    relays: ["wss://relay.example.com", "wss://relay.nostr.org"],
    author: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  },
  addr: {
    identifier: "test",
    pubkey: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
    kind: 1,
    relays: ["wss://relay.example.com"],
  },
};

// Type guard functions for the DecodedEntity type
function isProfileData(entity: DecodedEntity): entity is { type: Prefix.Profile; data: ProfileData } {
  return entity.type === Prefix.Profile;
}

function isEventData(entity: DecodedEntity): entity is { type: Prefix.Event; data: EventData } {
  return entity.type === Prefix.Event;
}

function isAddressData(entity: DecodedEntity): entity is { type: Prefix.Address; data: AddressData } {
  return entity.type === Prefix.Address;
}

describe("NIP-19: TLV Entities", () => {
  describe("Profile (nprofile)", () => {
    test("should encode a profile to nprofile format", () => {
      // Arrange
      const { pubkey, relays } = TEST_FIXTURES.profile;

      // Act
      const encoded = encodeProfile({ pubkey, relays });

      // Assert
      expect(encoded).toMatch(/^nprofile1[a-z0-9]+$/);
    });

    test("should decode an nprofile back to the original profile", () => {
      // Arrange
      const { pubkey, relays } = TEST_FIXTURES.profile;
      const encoded = encodeProfile({ pubkey, relays });

      // Act
      const decoded = decodeProfile(encoded);

      // Assert
      expect(decoded.pubkey).toBe(pubkey);
      expect(decoded.relays).toEqual(relays);
    });

    test("should handle nprofile with no relays", () => {
      // Arrange
      const { pubkey } = TEST_FIXTURES.profile;

      // Act
      const encoded = encodeProfile({ pubkey, relays: [] });
      const decoded = decodeProfile(encoded);

      // Assert
      expect(decoded.pubkey).toBe(pubkey);
      expect(decoded.relays || []).toEqual([]);
    });

    test("should throw with appropriate error for invalid nprofile", () => {
      // Arrange & Act & Assert
      expect(() => {
        // Type assertion to bypass strict type checking for testing
        decodeProfile("nprofile1invalid" as Bech32String);
      }).toThrow(/Invalid/);
    });
  });

  // Note: No relay-specific functions in the library, skipping for now
  /* 
  describe('Relay (nrelay)', () => {
    // Implementation pending
  });
  */

  describe("Event (nevent)", () => {
    test("should encode an event to nevent format", () => {
      // Arrange
      const { id, relays, author } = TEST_FIXTURES.event;

      // Act
      const encoded = encodeEvent({ id, relays, author });

      // Assert
      expect(encoded).toMatch(/^nevent1[a-z0-9]+$/);
    });

    test("should decode an nevent back to the original event", () => {
      // Arrange
      const { id, relays, author } = TEST_FIXTURES.event;
      const encoded = encodeEvent({ id, relays, author });

      // Act
      const decoded = decodeEvent(encoded);

      // Assert
      expect(decoded.id).toBe(id);
      expect(decoded.relays).toEqual(relays);
      expect(decoded.author).toBe(author);
    });

    test("should handle nevent with optional fields omitted", () => {
      // Arrange
      const { id } = TEST_FIXTURES.event;

      // Act
      const encoded = encodeEvent({ id });
      const decoded = decodeEvent(encoded);

      // Assert
      expect(decoded.id).toBe(id);
      expect(decoded.relays || []).toEqual([]);
      expect(decoded.author).toBeUndefined();
    });

    test("should throw with appropriate error for invalid nevent", () => {
      // Arrange & Act & Assert
      expect(() => {
        // Type assertion to bypass strict type checking for testing
        decodeEvent("nevent1invalid" as Bech32String);
      }).toThrow(/Invalid/);
    });
  });

  describe("Address (naddr)", () => {
    test("should encode an address to naddr format", () => {
      // Arrange
      const { identifier, pubkey, kind, relays } = TEST_FIXTURES.addr;

      // Act
      const encoded = encodeAddress({ identifier, pubkey, kind, relays });

      // Assert
      expect(encoded).toMatch(/^naddr1[a-z0-9]+$/);
    });

    test("should decode an naddr back to the original address", () => {
      // Arrange
      const { identifier, pubkey, kind, relays } = TEST_FIXTURES.addr;
      const encoded = encodeAddress({ identifier, pubkey, kind, relays });

      // Act
      const decoded = decodeAddress(encoded);

      // Assert
      expect(decoded.identifier).toBe(identifier);
      expect(decoded.pubkey).toBe(pubkey);
      expect(decoded.kind).toBe(kind);
      expect(decoded.relays).toEqual(relays);
    });

    test("should handle naddr with optional fields omitted", () => {
      // Arrange
      const { identifier, pubkey, kind } = TEST_FIXTURES.addr;

      // Act
      const encoded = encodeAddress({ identifier, pubkey, kind, relays: [] });
      const decoded = decodeAddress(encoded);

      // Assert
      expect(decoded.identifier).toBe(identifier);
      expect(decoded.pubkey).toBe(pubkey);
      expect(decoded.kind).toBe(kind);
      expect(decoded.relays || []).toEqual([]);
    });

    test("should throw with appropriate error for invalid naddr", () => {
      // Arrange & Act & Assert
      expect(() => {
        // Type assertion to bypass strict type checking for testing
        decodeAddress("naddr1invalid" as Bech32String);
      }).toThrow(/Invalid/);
    });
  });

  describe("Generic Decoder for TLV Entities", () => {
    test("should decode nprofile entities correctly", () => {
      // Arrange
      const { pubkey, relays } = TEST_FIXTURES.profile;
      const encoded = encodeProfile({ pubkey, relays });

      // Act
      const result = decode(encoded);

      // Assert
      expect(result.type).toBe("nprofile");
      if (isProfileData(result)) {
        expect(result.data.pubkey).toBe(pubkey);
        expect(result.data.relays).toEqual(relays);
      }
    });

    // Skipping relay test since there's no relay encoding in the library

    test("should decode nevent entities correctly", () => {
      // Arrange
      const { id, relays, author } = TEST_FIXTURES.event;
      const encoded = encodeEvent({ id, relays, author });

      // Act
      const result = decode(encoded);

      // Assert
      expect(result.type).toBe("nevent");
      if (isEventData(result)) {
        expect(result.data.id).toBe(id);
        expect(result.data.relays).toEqual(relays);
        expect(result.data.author).toBe(author);
      }
    });

    test("should decode naddr entities correctly", () => {
      // Arrange
      const { identifier, pubkey, kind, relays } = TEST_FIXTURES.addr;
      const encoded = encodeAddress({ identifier, pubkey, kind, relays });

      // Act
      const result = decode(encoded);

      // Assert
      expect(result.type).toBe("naddr");
      if (isAddressData(result)) {
        expect(result.data.identifier).toBe(identifier);
        expect(result.data.pubkey).toBe(pubkey);
        expect(result.data.kind).toBe(kind);
        expect(result.data.relays).toEqual(relays);
      }
    });
  });
});
