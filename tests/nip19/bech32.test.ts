/**
 * Tests for NIP-19: Basic Bech32 entity encoding and decoding
 */

import {
  encodePublicKey,
  decodePublicKey,
  encodePrivateKey,
  decodePrivateKey,
  encodeNoteId,
  decodeNoteId,
  decode
} from '../../src/nip19';

// Test data fixtures
const TEST_FIXTURES = {
  publicKey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  privateKey: '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa',
  noteId: '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c'
};

describe('NIP-19: Basic Bech32 Entities', () => {
  describe('Public Key (npub)', () => {
    test('should encode a public key to npub format', () => {
      // Arrange
      const publicKey = TEST_FIXTURES.publicKey;
      
      // Act
      const encoded = encodePublicKey(publicKey);
      
      // Assert
      expect(encoded).toMatch(/^npub1[a-z0-9]+$/);
    });

    test('should decode an npub back to the original public key', () => {
      // Arrange
      const publicKey = TEST_FIXTURES.publicKey;
      const encoded = encodePublicKey(publicKey);
      
      // Act
      const decoded = decodePublicKey(encoded);
      
      // Assert
      expect(decoded).toBe(publicKey);
    });

    test('should throw with appropriate error for invalid npub', () => {
      // Arrange & Act & Assert
      expect(() => decodePublicKey('npub1invalid')).toThrow(/Error decoding npub/);
    });
  });

  describe('Private Key (nsec)', () => {
    test('should encode a private key to nsec format', () => {
      // Arrange
      const privateKey = TEST_FIXTURES.privateKey;
      
      // Act
      const encoded = encodePrivateKey(privateKey);
      
      // Assert
      expect(encoded).toMatch(/^nsec1[a-z0-9]+$/);
    });

    test('should decode an nsec back to the original private key', () => {
      // Arrange
      const privateKey = TEST_FIXTURES.privateKey;
      const encoded = encodePrivateKey(privateKey);
      
      // Act
      const decoded = decodePrivateKey(encoded);
      
      // Assert
      expect(decoded).toBe(privateKey);
    });

    test('should throw with appropriate error for invalid nsec', () => {
      // Arrange & Act & Assert
      expect(() => decodePrivateKey('nsec1invalid')).toThrow(/Error decoding nsec/);
    });
  });

  describe('Note ID (note)', () => {
    test('should encode a note ID to note format', () => {
      // Arrange
      const noteId = TEST_FIXTURES.noteId;
      
      // Act
      const encoded = encodeNoteId(noteId);
      
      // Assert
      expect(encoded).toMatch(/^note1[a-z0-9]+$/);
    });

    test('should decode a note back to the original note ID', () => {
      // Arrange
      const noteId = TEST_FIXTURES.noteId;
      const encoded = encodeNoteId(noteId);
      
      // Act
      const decoded = decodeNoteId(encoded);
      
      // Assert
      expect(decoded).toBe(noteId);
    });

    test('should throw with appropriate error for invalid note', () => {
      // Arrange & Act & Assert
      expect(() => decodeNoteId('note1invalid')).toThrow(/Error decoding note/);
    });
  });

  describe('Generic Decoder', () => {
    test('should decode npub entities correctly', () => {
      // Arrange
      const publicKey = TEST_FIXTURES.publicKey;
      const encoded = encodePublicKey(publicKey);
      
      // Act
      const result = decode(encoded);
      
      // Assert
      expect(result.type).toBe('npub');
      expect(result.data).toBe(publicKey);
    });

    test('should decode nsec entities correctly', () => {
      // Arrange
      const privateKey = TEST_FIXTURES.privateKey;
      const encoded = encodePrivateKey(privateKey);
      
      // Act
      const result = decode(encoded);
      
      // Assert
      expect(result.type).toBe('nsec');
      expect(result.data).toBe(privateKey);
    });

    test('should decode note entities correctly', () => {
      // Arrange
      const noteId = TEST_FIXTURES.noteId;
      const encoded = encodeNoteId(noteId);
      
      // Act
      const result = decode(encoded);
      
      // Assert
      expect(result.type).toBe('note');
      expect(result.data).toBe(noteId);
    });

    test('should throw with appropriate error for invalid bech32 strings', () => {
      // Arrange & Act & Assert
      expect(() => decode('not-a-valid-bech32-string')).toThrow(/Invalid bech32 string format/);
    });
  });

  describe('Prefix Validation', () => {
    test('should throw when decoding with the wrong function', () => {
      // Arrange
      const noteId = TEST_FIXTURES.noteId;
      const noteEncoded = encodeNoteId(noteId);
      
      // Act & Assert
      expect(() => decodePublicKey(noteEncoded)).toThrow(/Invalid prefix/);
    });
  });
}); 