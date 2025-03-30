import { generateKeypair, getPublicKey, signEvent, verifySignature } from '../src/utils/crypto';
import { 
  encrypt as encryptNIP04, 
  decrypt as decryptNIP04, 
  getSharedSecret as getNIP04SharedSecret 
} from '../src/nip04';
import { NostrEvent } from '../src/types/nostr';

describe('Crypto Utilities', () => {
  describe('Key Generation', () => {
    test('generateKeypair should produce valid keys', async () => {
      const keypair = await generateKeypair();
      
      // Check private key format
      expect(keypair.privateKey).toMatch(/^[0-9a-f]{64}$/);
      
      // Check public key format
      expect(keypair.publicKey).toMatch(/^[0-9a-f]{64}$/);
      
      // Ensure the public key is derivable from the private key
      const derivedPublicKey = getPublicKey(keypair.privateKey);
      expect(derivedPublicKey).toEqual(keypair.publicKey);
    });
    
    test('getPublicKey should consistently derive the same public key', async () => {
      const keypair = await generateKeypair();
      
      // Generate the public key multiple times
      const publicKey1 = getPublicKey(keypair.privateKey);
      const publicKey2 = getPublicKey(keypair.privateKey);
      const publicKey3 = getPublicKey(keypair.privateKey);
      
      // Ensure they're all the same
      expect(publicKey1).toEqual(publicKey2);
      expect(publicKey2).toEqual(publicKey3);
      expect(publicKey1).toEqual(keypair.publicKey);
    });
  });
  
  describe('Event Signing', () => {
    let eventData: Omit<NostrEvent, 'id' | 'sig'>;
    let privateKey: string;
    let publicKey: string;
    
    beforeEach(async () => {
      const keypair = await generateKeypair();
      privateKey = keypair.privateKey;
      publicKey = keypair.publicKey;
      
      eventData = {
        pubkey: publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['t', 'test']],
        content: 'Hello, Nostr!',
      };
    });
    
    test('signEvent should produce a valid signature', async () => {
      const event = {
        ...eventData,
        id: 'fake-id',
      };
      
      const signedEvent = await signEvent(event, privateKey);
      
      // Check that a signature was added
      expect(signedEvent.sig).toBeDefined();
      expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/);
    });
    
    test('verifySignature should validate a correctly signed event', async () => {
      const event = {
        ...eventData,
        id: 'fake-id',
      };
      
      const signedEvent = await signEvent(event, privateKey);
      const verified = await verifySignature(signedEvent);
      
      expect(verified).toBe(true);
    });
    
    test('verifySignature should reject an invalid signature', async () => {
      const event = {
        ...eventData,
        id: 'fake-id',
      };
      
      // Sign the event
      const signedEvent = await signEvent(event, privateKey);
      
      // Tamper with the event
      const tamperedEvent = {
        ...signedEvent,
        content: 'Tampered content',
      };
      
      const verified = await verifySignature(tamperedEvent);
      
      expect(verified).toBe(false);
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

    test('getNIP04SharedSecret should create identical secrets for both parties', () => {
      const aliceSharedSecret = getNIP04SharedSecret(alicePrivateKey, bobPublicKey);
      const bobSharedSecret = getNIP04SharedSecret(bobPrivateKey, alicePublicKey);
      
      // Convert Uint8Array to hex for comparison
      const aliceSecretHex = Buffer.from(aliceSharedSecret).toString('hex');
      const bobSecretHex = Buffer.from(bobSharedSecret).toString('hex');
      
      expect(aliceSecretHex).toEqual(bobSecretHex);
    });

    test('encryptNIP04 and decryptNIP04 should work together', () => {
      const originalMessage = 'This is a secret message!';
      
      // Alice encrypts message for Bob
      const encrypted = encryptNIP04(originalMessage, alicePrivateKey, bobPublicKey);
      
      // Check encrypted format
      expect(encrypted).toContain('?iv=');
      
      // Bob decrypts message from Alice
      const decrypted = decryptNIP04(encrypted, bobPrivateKey, alicePublicKey);
      
      expect(decrypted).toEqual(originalMessage);
    });

    test('decryption should fail with wrong keys', async () => {
      const originalMessage = 'This is a secret message!';
      const encrypted = encryptNIP04(originalMessage, alicePrivateKey, bobPublicKey);
      
      // Generate an unrelated keypair
      const eveKeypair = await generateKeypair();
      const evePrivateKey = eveKeypair.privateKey;
      
      // Eve tries to decrypt with her key
      expect(() => {
        decryptNIP04(encrypted, evePrivateKey, alicePublicKey);
      }).toThrow();
    });
    
    test('should produce different ciphertexts for the same message to different recipients', async () => {
      // Create Charlie as a third party
      const charlieKeypair = await generateKeypair();
      const charliePrivateKey = charlieKeypair.privateKey;
      const charliePublicKey = charlieKeypair.publicKey;
      
      const message = 'This is a confidential message';
      
      // Alice encrypts for Bob
      const encryptedForBob = encryptNIP04(message, alicePrivateKey, bobPublicKey);
      
      // Alice encrypts same message for Charlie
      const encryptedForCharlie = encryptNIP04(message, alicePrivateKey, charliePublicKey);
      
      // The two encrypted messages should be different
      expect(encryptedForBob).not.toBe(encryptedForCharlie);
      
      // But both should decrypt to the original message by their intended recipient
      expect(decryptNIP04(encryptedForBob, bobPrivateKey, alicePublicKey)).toBe(message);
      expect(decryptNIP04(encryptedForCharlie, charliePrivateKey, alicePublicKey)).toBe(message);
    });
    
    test('should handle various message types including special characters', () => {
      const testMessages = [
        'Hello, world!',
        'Special chars: !@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./Æ©®',
        'Unicode: 你好，世界！こんにちは！',
        'Emoji: 👋🌍🔐🔑',
        'Very long message: ' + 'X'.repeat(1000),
        JSON.stringify({ hello: 'world', nested: { data: [1, 2, 3] } }),
        ''  // Empty message
      ];
      
      testMessages.forEach(message => {
        const encrypted = encryptNIP04(message, alicePrivateKey, bobPublicKey);
        const decrypted = decryptNIP04(encrypted, bobPrivateKey, alicePublicKey);
        expect(decrypted).toBe(message);
      });
    });
    
    test('decryption should fail on tampered messages', () => {
      const message = 'This is a secure message';
      const encrypted = encryptNIP04(message, alicePrivateKey, bobPublicKey);
      
      // Tamper with the message by changing a character in the encrypted part
      const parts = encrypted.split('?iv=');
      const tampered = parts[0].substring(0, parts[0].length - 1) + 'X' + '?iv=' + parts[1];
      
      // Decryption should throw an error
      expect(() => {
        decryptNIP04(tampered, bobPrivateKey, alicePublicKey);
      }).toThrow();
    });
  });
}); 