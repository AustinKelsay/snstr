import { 
  generateKeypair, 
  getPublicKey, 
  getEventHash, 
  signEvent, 
  verifySignature,
  getSharedSecret,
  encryptMessage,
  decryptMessage
} from '../src/utils/crypto';
import { NostrEvent } from '../src/types/nostr';

describe('Crypto Utilities', () => {
  describe('Key Generation', () => {
    test('generateKeypair should create valid keypair', async () => {
      const keypair = await generateKeypair();
      
      expect(keypair).toHaveProperty('privateKey');
      expect(keypair).toHaveProperty('publicKey');
      expect(keypair.privateKey).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(keypair.publicKey).toHaveLength(64); // 32 bytes hex = 64 chars
    });

    test('getPublicKey should derive public key from private key', async () => {
      const keypair = await generateKeypair();
      const derivedPublicKey = getPublicKey(keypair.privateKey);
      
      expect(derivedPublicKey).toEqual(keypair.publicKey);
    });
  });

  describe('Event Hashing and Signing', () => {
    let testEvent: Omit<NostrEvent, 'id' | 'sig'>;
    let privateKey: string;
    let publicKey: string;
    
    beforeEach(async () => {
      const keypair = await generateKeypair();
      privateKey = keypair.privateKey;
      publicKey = keypair.publicKey;
      
      testEvent = {
        pubkey: publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test message',
      };
    });

    test('getEventHash should create deterministic hash', () => {
      const hash1 = getEventHash(testEvent);
      const hash2 = getEventHash(testEvent);
      
      expect(hash1).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(hash1).toEqual(hash2);
      
      // Changing event content should change hash
      const modifiedEvent = { ...testEvent, content: 'Different message' };
      const hash3 = getEventHash(modifiedEvent);
      
      expect(hash3).not.toEqual(hash1);
    });

    test('signEvent should create a valid signature', async () => {
      const id = getEventHash(testEvent);
      const eventWithId = { ...testEvent, id };
      
      const signedEvent = await signEvent(eventWithId, privateKey);
      
      expect(signedEvent).toHaveProperty('sig');
      expect(signedEvent.sig).toHaveLength(128); // 64 bytes hex = 128 chars
    });

    test('verifySignature should validate correctly signed events', async () => {
      const id = getEventHash(testEvent);
      const eventWithId = { ...testEvent, id };
      
      const signedEvent = await signEvent(eventWithId, privateKey);
      const isValid = await verifySignature(signedEvent);
      
      expect(isValid).toBe(true);
      
      // Modifying the event should invalidate the signature
      const tamperedEvent = { ...signedEvent, content: 'Tampered content' };
      const isStillValid = await verifySignature(tamperedEvent);
      
      expect(isStillValid).toBe(false);
    });
  });

  describe('NIP-04 Encryption', () => {
    let alicePrivateKey: string;
    let alicePublicKey: string;
    let bobPrivateKey: string;
    let bobPublicKey: string;
    
    beforeEach(async () => {
      const aliceKeypair = await generateKeypair();
      alicePrivateKey = aliceKeypair.privateKey;
      alicePublicKey = aliceKeypair.publicKey;
      
      const bobKeypair = await generateKeypair();
      bobPrivateKey = bobKeypair.privateKey;
      bobPublicKey = bobKeypair.publicKey;
    });

    test('getSharedSecret should create identical secrets for both parties', () => {
      const aliceSharedSecret = getSharedSecret(alicePrivateKey, bobPublicKey);
      const bobSharedSecret = getSharedSecret(bobPrivateKey, alicePublicKey);
      
      // Convert Uint8Array to hex for comparison
      const aliceSecretHex = Buffer.from(aliceSharedSecret).toString('hex');
      const bobSecretHex = Buffer.from(bobSharedSecret).toString('hex');
      
      expect(aliceSecretHex).toEqual(bobSecretHex);
    });

    test('encryptMessage and decryptMessage should work together', () => {
      const originalMessage = 'This is a secret message!';
      
      // Alice encrypts message for Bob
      const encrypted = encryptMessage(originalMessage, alicePrivateKey, bobPublicKey);
      
      // Check encrypted format
      expect(encrypted).toContain('?iv=');
      
      // Bob decrypts message from Alice
      const decrypted = decryptMessage(encrypted, bobPrivateKey, alicePublicKey);
      
      expect(decrypted).toEqual(originalMessage);
    });

    test('decryption should fail with wrong keys', async () => {
      const originalMessage = 'This is a secret message!';
      const encrypted = encryptMessage(originalMessage, alicePrivateKey, bobPublicKey);
      
      // Generate an unrelated keypair
      const eveKeypair = await generateKeypair();
      const evePrivateKey = eveKeypair.privateKey;
      
      // Eve tries to decrypt with her key
      expect(() => {
        decryptMessage(encrypted, evePrivateKey, alicePublicKey);
      }).toThrow();
    });
  });
}); 