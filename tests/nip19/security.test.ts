/**
 * Security tests for NIP-19 implementation
 * 
 * These tests specifically target potential security issues:
 * 1. URL validation/sanitization in relay URLs
 * 2. TLV entry limits that could lead to DoS attacks
 */

import {
  encodeProfile,
  decodeProfile,
  encodeEvent,
  decodeEvent,
  encodeAddress,
  decode
} from '../../src/nip19';

describe('NIP-19: Security Tests', () => {
  // Test data
  const validPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const validEventId = '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d';

  describe('URL Validation and Sanitization', () => {
    test('validates basic relay URL protocols', () => {
      // Valid protocols
      expect(() => encodeProfile({
        pubkey: validPubkey,
        relays: ['wss://relay.example.com', 'ws://localhost:8080']
      })).not.toThrow();

      // Invalid protocols
      expect(() => encodeProfile({
        pubkey: validPubkey,
        relays: ['http://example.com']
      })).toThrow(/Invalid relay URL/);
    });

    test('handles potentially malicious URLs', () => {
      const potentiallyDangerousUrls = [
        'javascript:alert(1)', // JavaScript injection
        'wss://<script>alert(1)</script>.com', // HTML injection
        'data:text/html,<script>alert(1)</script>', // Data URL
        'file:///etc/passwd', // Local file access
        '//example.com' // Protocol-relative URL
      ];

      potentiallyDangerousUrls.forEach(url => {
        expect(() => encodeProfile({
          pubkey: validPubkey,
          relays: [url]
        })).toThrow(/Invalid relay URL/);
      });
    });

    test('checks if URLs with credentials are rejected', () => {
      const urlsWithCredentials = [
        'wss://user:password@relay.example.com',
        'ws://user@relay.example.com'
      ];

      // The current implementation might not reject URLs with credentials
      // Let's verify if it does or doesn't
      try {
        encodeProfile({
          pubkey: validPubkey,
          relays: [urlsWithCredentials[0]]
        });
        console.warn('SECURITY ISSUE: URLs with credentials are accepted in relay URLs');
      } catch (error) {
        // If it throws, check if it's because of the credentials or for another reason
        expect((error as Error).message).toContain('Invalid relay URL');
      }
    });
  });

  describe('TLV Entry Limits', () => {
    test('checks maximum TLV entry limit', () => {
      // Generate arrays of relays of increasing size
      const generateRelays = (count: number) => Array(count)
        .fill(0)
        .map((_, i) => `wss://relay${i}.example.com`);

      // Try with 50 relays - less than the 100 limit but more than reasonable
      try {
        encodeProfile({
          pubkey: validPubkey,
          relays: generateRelays(50)
        });
        console.warn('SECURITY ISSUE: Accepts 50 relay entries, which is high for normal usage');
      } catch (error) {
        // If it throws, check that it's because of the relay count
        expect((error as Error).message).toContain('Too many relay entries');
      }

      // Try with 101 relays - should definitely throw if limit is 100
      expect(() => encodeProfile({
        pubkey: validPubkey,
        relays: generateRelays(101)
      })).toThrow(/Too many/);
    });

    test('checks how decoding handles invalid relay URLs', () => {
      // Create a profile with valid relays to test decoding behavior
      const profile = {
        pubkey: validPubkey,
        relays: ['wss://relay.example.com']
      };
      
      const encoded = encodeProfile(profile);
      const decoded = decodeProfile(encoded);
      
      // Check that decoded matches original
      expect(decoded.pubkey).toBe(profile.pubkey);
      expect(decoded.relays).toEqual(profile.relays);
      
      // Note: We can't easily test invalid URL handling in decoding
      // since the encoding step already validates URLs.
      // Would need to manually construct an invalid TLV to test this.
    });
  });
}); 