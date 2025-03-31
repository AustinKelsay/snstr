import {
  encodePublicKey,
  decodePublicKey,
  encodePrivateKey,
  decodePrivateKey,
  encodeNoteId,
  decodeNoteId,
  encodeProfile,
  decodeProfile,
  ProfileData,
  encodeEvent,
  decodeEvent,
  encodeAddress,
  decodeAddress,
  decode
} from '../src/nip19';

describe('NIP-19 bech32 encodings', () => {
  // Test data
  const publicKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const privateKey = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';
  const noteId = '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c';
  
  // Generate the bech32 encoded strings dynamically
  const publicKeyBech32 = encodePublicKey(publicKey);
  const privateKeyBech32 = encodePrivateKey(privateKey);
  const noteBech32 = encodeNoteId(noteId);

  describe('encoding and decoding basic types', () => {
    test('public key - encode and decode', () => {
      const encoded = encodePublicKey(publicKey);
      expect(encoded.startsWith('npub1')).toBe(true);
      expect(decodePublicKey(encoded)).toBe(publicKey);
    });

    test('private key - encode and decode', () => {
      const encoded = encodePrivateKey(privateKey);
      expect(encoded.startsWith('nsec1')).toBe(true);
      expect(decodePrivateKey(encoded)).toBe(privateKey);
    });

    test('note id - encode and decode', () => {
      const encoded = encodeNoteId(noteId);
      expect(encoded.startsWith('note1')).toBe(true);
      expect(decodeNoteId(encoded)).toBe(noteId);
    });
  });

  describe('generic decode', () => {
    test('decodes npub', () => {
      const result = decode(publicKeyBech32);
      expect(result.type).toBe('npub');
      expect(result.data).toBe(publicKey);
    });

    test('decodes nsec', () => {
      const result = decode(privateKeyBech32);
      expect(result.type).toBe('nsec');
      expect(result.data).toBe(privateKey);
    });

    test('decodes note', () => {
      const result = decode(noteBech32);
      expect(result.type).toBe('note');
      expect(result.data).toBe(noteId);
    });
  });

  describe('TLV encoding/decoding', () => {
    // Test profile data
    const profileData = {
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
      relays: ['wss://relay.example.com', 'wss://relay.nostr.org']
    };

    test('encodes and decodes nprofile', () => {
      const profileBech32 = encodeProfile(profileData);
      expect(profileBech32.startsWith('nprofile1')).toBe(true);
      
      const decoded = decodeProfile(profileBech32);
      expect(decoded.pubkey).toBe(profileData.pubkey);
      expect(decoded.relays).toEqual(profileData.relays);
    });

    test('decode function with nprofile', () => {
      const profileBech32 = encodeProfile(profileData);
      const result = decode(profileBech32);
      
      expect(result.type).toBe('nprofile');
      
      // Type guard to check result type
      if (result.type === 'nprofile') {
        // Now TypeScript knows result.data is ProfileData
        const profileResult = result.data as ProfileData;
        expect(profileResult.pubkey).toBe(profileData.pubkey);
        expect(profileResult.relays).toEqual(profileData.relays);
      } else {
        fail('Expected result.type to be "nprofile"');
      }
    });

    // Test event data
    const eventData = {
      id: '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d',
      relays: ['wss://relay.example.com'],
      author: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
      kind: 1
    };

    test('encodes and decodes nevent', () => {
      const eventBech32 = encodeEvent(eventData);
      expect(eventBech32.startsWith('nevent1')).toBe(true);
      
      const decoded = decodeEvent(eventBech32);
      expect(decoded.id).toBe(eventData.id);
      expect(decoded.relays).toEqual(eventData.relays);
      expect(decoded.author).toBe(eventData.author);
      expect(decoded.kind).toBe(eventData.kind);
    });

    // Test address data
    const addressData = {
      identifier: 'banana',
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
      kind: 30023,
      relays: ['wss://relay.example.com']
    };

    test('encodes and decodes naddr', () => {
      const addrBech32 = encodeAddress(addressData);
      expect(addrBech32.startsWith('naddr1')).toBe(true);
      
      const decoded = decodeAddress(addrBech32);
      expect(decoded.identifier).toBe(addressData.identifier);
      expect(decoded.pubkey).toBe(addressData.pubkey);
      expect(decoded.kind).toBe(addressData.kind);
      expect(decoded.relays).toEqual(addressData.relays);
    });
  });

  describe('error handling', () => {
    test('throws on invalid bech32 string', () => {
      expect(() => decode('invalid')).toThrow('Invalid bech32 string');
    });

    test('throws on wrong prefix', () => {
      // Generate a valid note bech32 string
      const validNote = encodeNoteId(noteId);
      
      // Try to decode it as a public key (npub)
      expect(() => decodePublicKey(validNote)).toThrow('Invalid prefix');
    });
  });
}); 