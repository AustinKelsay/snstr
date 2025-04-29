import { NostrEvent } from '../src/types/nostr';
import { 
  createSignedEvent, 
  createTextNote, 
  createDirectMessage, 
  createMetadataEvent,
  UnsignedEvent,
  getEventHash
} from '../src/utils/event';
import { verifySignature } from '../src/utils/crypto';
import { getPublicKey } from '../src/utils/crypto';

describe('Event Creation and Signing', () => {
  const privateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const publicKey = getPublicKey(privateKey);

  describe('getEventHash', () => {
    it('should consistently generate the same hash for the same event data', async () => {
      const event: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [['t', 'test']],
        content: 'Hello, world!'
      };

      const hash1 = await getEventHash(event);
      const hash2 = await getEventHash(event);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should throw error for missing pubkey', async () => {
      const event = {
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: missing pubkey');
    });

    it('should throw error for missing created_at', async () => {
      const event = {
        pubkey: publicKey,
        kind: 1,
        tags: [],
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: missing created_at');
    });

    it('should throw error for missing kind', async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        tags: [],
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: missing kind');
    });

    it('should throw error for invalid tags (not an array)', async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: 'not an array' as any,
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: tags must be an array');
    });

    it('should throw error for invalid tag item (not an array)', async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: ['not an array' as any],
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: each tag must be an array');
    });

    it('should throw error for invalid tag item content (not a string)', async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [['t', 123 as any]],
        content: 'Hello, world!'
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: tag items must be strings');
    });

    it('should throw error for invalid content (not a string)', async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: 123 as any
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow('Invalid event: content must be a string');
    });

    it('should hash events with special characters in content correctly', async () => {
      // Test with various special characters that might be encoded differently
      const event: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: 'Hello, "world"!\n\\Special/\t\r\u2022\u0000'
      };

      const hash = await getEventHash(event);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce the same hash for the same event even if object props are ordered differently', async () => {
      // Create the same event data in two different ways
      const event1: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [['t', 'test']],
        content: 'Hello, world!'
      };

      // TypeScript doesn't care about property order, so this is fine
      const event2: UnsignedEvent = {
        content: 'Hello, world!',
        pubkey: publicKey,
        tags: [['t', 'test']],
        created_at: 1652347275,
        kind: 1
      };

      const hash1 = await getEventHash(event1);
      const hash2 = await getEventHash(event2);
      
      expect(hash1).toBe(hash2);
    });
  });

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
    it('should create a text note event with pubkey automatically set', async () => {
      const content = 'Hello, world!';
      const tags = [['t', 'test']];

      const template = createTextNote(content, privateKey, tags);

      expect(template.kind).toBe(1);
      expect(template.content).toBe(content);
      expect(template.tags).toEqual(tags);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe('createDirectMessage', () => {
    it('should create a direct message event with pubkey automatically set', async () => {
      const content = 'Secret message';
      const recipientPrivateKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const recipientPubkey = getPublicKey(recipientPrivateKey);
      const tags = [['t', 'test']];

      const template = createDirectMessage(content, recipientPubkey, privateKey, tags);

      expect(template.kind).toBe(4);
      expect(template.content).toContain('?iv=');
      expect(template.tags).toContainEqual(['p', recipientPubkey]);
      expect(template.tags).toContainEqual(['t', 'test']);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe('createMetadataEvent', () => {
    it('should create a metadata event with pubkey automatically set', async () => {
      const metadata = {
        name: 'Test User',
        about: 'Just testing'
      };

      const template = createMetadataEvent(metadata, privateKey);

      expect(template.kind).toBe(0);
      expect(template.tags).toEqual([]);
      expect(JSON.parse(template.content)).toEqual(metadata);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });
}); 