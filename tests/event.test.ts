import { 
  createEvent, 
  createSignedEvent, 
  createTextNote, 
  createDirectMessage,
  createMetadataEvent
} from '../src/utils/event';
import { generateKeypair, getPublicKey, verifySignature } from '../src/utils/crypto';
import { NostrEvent } from '../src/types/nostr';

describe('Event Utilities', () => {
  let privateKey: string;
  let publicKey: string;
  
  beforeEach(async () => {
    const keypair = await generateKeypair();
    privateKey = keypair.privateKey;
    publicKey = keypair.publicKey;
  });

  describe('Basic Event Creation', () => {
    test('createEvent should create valid event structure', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const template = {
        kind: 1,
        content: 'Test event',
        tags: [['t', 'test']],
        created_at: timestamp
      };
      
      const event = createEvent(template, publicKey);
      
      expect(event).toEqual({
        pubkey: publicKey,
        created_at: timestamp,
        kind: 1,
        tags: [['t', 'test']],
        content: 'Test event'
      });
    });
    
    test('createEvent should use current timestamp if not provided', () => {
      const now = Math.floor(Date.now() / 1000);
      const template = {
        kind: 1,
        content: 'Test event',
        tags: []
      };
      
      const event = createEvent(template, publicKey);
      
      expect(event.created_at).toBeGreaterThanOrEqual(now);
      expect(event.created_at).toBeLessThanOrEqual(now + 2); // Allow 2 seconds for test execution
    });
  });

  describe('Event Signing', () => {
    test('createSignedEvent should create a properly signed event', async () => {
      const template = {
        kind: 1,
        content: 'Test signed event',
        tags: []
      };
      
      const signedEvent = await createSignedEvent(template, privateKey);
      
      expect(signedEvent).toHaveProperty('id');
      expect(signedEvent).toHaveProperty('sig');
      expect(signedEvent.pubkey).toEqual(publicKey);
      
      // Verify the signature
      const isValid = await verifySignature(signedEvent);
      expect(isValid).toBe(true);
    });
    
    test('createSignedEvent should use provided public key if given', async () => {
      const template = {
        kind: 1,
        content: 'Test with explicit pubkey',
        tags: []
      };
      
      const signedEvent = await createSignedEvent(template, privateKey, publicKey);
      
      expect(signedEvent.pubkey).toEqual(publicKey);
    });
  });

  describe('Specialized Event Types', () => {
    test('createTextNote should create a kind 1 event template', () => {
      const content = 'Hello, world!';
      const tags = [['t', 'test'], ['client', 'snstr']];
      
      const template = createTextNote(content, tags);
      
      expect(template).toEqual({
        kind: 1,
        content: 'Hello, world!',
        tags: [['t', 'test'], ['client', 'snstr']]
      });
    });
    
    test('createDirectMessage should create an encrypted kind 4 event template', () => {
      const content = 'Secret message';
      const recipientPublicKey = getPublicKey(privateKey); // Just for test simplicity
      
      const template = createDirectMessage(content, recipientPublicKey, privateKey);
      
      expect(template.kind).toBe(4);
      expect(template.content).toContain('?iv='); // Encrypted format
      
      // Should have 'p' tag with recipient pubkey
      expect(template.tags.some(tag => 
        tag[0] === 'p' && tag[1] === recipientPublicKey
      )).toBe(true);
    });
    
    test('createMetadataEvent should create a kind 0 event with JSON content', () => {
      const metadata = {
        name: 'Test User',
        about: 'Just testing',
        picture: 'https://example.com/pic.jpg'
      };
      
      const template = createMetadataEvent(metadata);
      
      expect(template.kind).toBe(0);
      expect(template.tags).toEqual([]);
      
      // Content should be JSON string
      const parsedContent = JSON.parse(template.content);
      expect(parsedContent).toEqual(metadata);
    });
  });
}); 