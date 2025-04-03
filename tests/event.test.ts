import { NostrEvent } from '../src/types/nostr';
import { 
  createSignedEvent, 
  createTextNote, 
  createDirectMessage, 
  createMetadataEvent,
  UnsignedEvent 
} from '../src/utils/event';
import { verifySignature } from '../src/utils/crypto';
import { getPublicKey } from '../src/utils/crypto';

describe('Event Creation and Signing', () => {
  const privateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const publicKey = getPublicKey(privateKey);

  describe('createSignedEvent', () => {
    it('should create a signed event with valid signature', async () => {
      const template: UnsignedEvent = {
        pubkey: publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: 'Hello, world!',
        tags: []
      };

      const signedEvent = await createSignedEvent(template, privateKey);

      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
      expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/);

      const isValid = await verifySignature(signedEvent.id, signedEvent.sig, signedEvent.pubkey);
      expect(isValid).toBe(true);
    });
  });

  describe('createTextNote', () => {
    it('should create a text note event', async () => {
      const content = 'Hello, world!';
      const tags = [['t', 'test']];

      const template = createTextNote(content, tags);
      template.pubkey = publicKey;

      expect(template.kind).toBe(1);
      expect(template.content).toBe(content);
      expect(template.tags).toEqual(tags);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe('createDirectMessage', () => {
    it('should create a direct message event', async () => {
      const content = 'Secret message';
      const recipientPrivateKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const recipientPubkey = getPublicKey(recipientPrivateKey);
      const tags = [['t', 'test']];

      const template = createDirectMessage(content, recipientPubkey, privateKey, tags);
      template.pubkey = publicKey;

      expect(template.kind).toBe(4);
      expect(template.content).toContain('?iv=');
      expect(template.tags).toContainEqual(['p', recipientPubkey]);
      expect(template.tags).toContainEqual(['t', 'test']);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe('createMetadataEvent', () => {
    it('should create a metadata event', async () => {
      const metadata = {
        name: 'Test User',
        about: 'Just testing'
      };

      const template = createMetadataEvent(metadata, privateKey);
      template.pubkey = publicKey;

      expect(template.kind).toBe(0);
      expect(template.tags).toEqual([]);
      expect(JSON.parse(template.content)).toEqual(metadata);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });
}); 