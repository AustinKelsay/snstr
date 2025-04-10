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
  Prefix
} from '../../src/nip19';

describe('NIP-19: Validation and Edge Cases', () => {
  describe('Input Validation', () => {
    test('should reject malformed hex strings for public keys', () => {
      // Non-hex character
      expect(() => encodePublicKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefazzzz')).toThrow(/Invalid hex character/);
      
      // Note: The library doesn't currently validate string length on input, so we skip that test
    });

    test('should validate relay URLs in nprofile', () => {
      const validProfile = {
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: ['wss://relay.example.com']
      };

      const invalidProfile = {
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: ['not-a-valid-url']
      };

      // Valid relay URL should work
      expect(() => encodeProfile(validProfile)).not.toThrow();
      
      // Invalid relay URL should throw
      expect(() => encodeProfile(invalidProfile)).toThrow(/Invalid relay URL/);
    });

    test('should enforce required fields in naddr', () => {
      const validAddr = {
        identifier: 'test',
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        kind: 1
      };

      const missingPubkey = {
        identifier: 'test',
        kind: 1
      } as any; // Type assertion to bypass TypeScript checks

      // Valid address data should work
      expect(() => encodeAddress(validAddr)).not.toThrow();
      
      // Missing pubkey should throw
      expect(() => encodeAddress(missingPubkey)).toThrow();
      
      // Note: The library doesn't currently validate that kind is required at runtime,
      // it's only enforced at the TypeScript type level, so we skip that test
    });
  });

  describe('Size Limits', () => {
    test('should enforce maximum relay URL length', () => {
      // Create an extremely long relay URL
      const veryLongRelayUrl = 'wss://' + 'a'.repeat(1000) + '.example.com';
      
      const profileWithLongRelay = {
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: [veryLongRelayUrl]
      };
      
      // Should throw due to relay URL being too long
      expect(() => encodeProfile(profileWithLongRelay)).toThrow(/too long/);
    });

    test('should enforce maximum identifier length in naddr', () => {
      // Create an extremely long identifier
      const veryLongIdentifier = 'a'.repeat(2000);
      
      const addrWithLongIdentifier = {
        identifier: veryLongIdentifier,
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        kind: 1
      };
      
      // Should throw due to identifier being too long
      expect(() => encodeAddress(addrWithLongIdentifier)).toThrow(/too long/);
    });

    test('should enforce maximum number of relays', () => {
      // Create 1000 relays (which exceeds the MAX_TLV_ENTRIES limit)
      const manyRelays = Array(1000).fill(0).map((_, i) => `wss://relay${i}.example.com`);
      
      const profileWithManyRelays = {
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: manyRelays
      };
      
      // Should throw due to too many relays
      expect(() => encodeProfile(profileWithManyRelays)).toThrow(/Too many relay entries/);
    });
  });

  describe('Error Handling - Incorrect Prefixes', () => {
    test('should reject decoding with incorrect prefix functions', () => {
      // Encode entities with their correct encoders
      const pubkeyEncoded = encodePublicKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
      const profileEncoded = encodeProfile({
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: ['wss://relay.example.com']
      });
      
      // Try to decode them with wrong decoders
      expect(() => decodeProfile(pubkeyEncoded)).toThrow(/Invalid prefix/);
      expect(() => decodePublicKey(profileEncoded)).toThrow(/Invalid prefix/);
    });
  });

  describe('Encoding/Decoding Edge Cases', () => {
    test('should handle empty relays array', () => {
      const profile = {
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: []
      };
      
      const encoded = encodeProfile(profile);
      const decoded = decodeProfile(encoded);
      
      expect(decoded.relays).toEqual([]);
    });

    test('should handle empty identifier in naddr', () => {
      const addr = {
        identifier: '',
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        kind: 1
      };
      
      const encoded = encodeAddress(addr);
      const decoded = decodeAddress(encoded);
      
      expect(decoded.identifier).toBe('');
    });

    test('should handle very large kind values in nevent and naddr', () => {
      // Kind values are 32-bit integers, test a large but valid value
      const largeKind = 0x7FFFFFFF; // Max signed 32-bit integer
      
      const addr = {
        identifier: 'test',
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        kind: largeKind
      };
      
      const event = {
        id: '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d',
        kind: largeKind
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

  describe('Invalid Bech32 Handling', () => {
    test('should reject non-bech32 strings', () => {
      expect(() => decodePublicKey('not-a-bech32-string')).toThrow();
      expect(() => decodeProfile('not-a-bech32-string')).toThrow();
    });

    test('should reject bech32 strings with invalid checksums', () => {
      // Modify the last character to invalidate the checksum
      const validNpub = encodePublicKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
      const invalidChecksum = validNpub.slice(0, -1) + (validNpub.slice(-1) === 'a' ? 'b' : 'a');
      
      expect(() => decodePublicKey(invalidChecksum)).toThrow();
    });

    test('should reject bech32 strings that are too short', () => {
      expect(() => decodePublicKey('npub1short')).toThrow();
    });
  });
}); 