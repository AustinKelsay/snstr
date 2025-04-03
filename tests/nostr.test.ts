import { Nostr, NostrEvent, Filter, RelayEvent } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';
import { generateKeypair } from '../src/utils/crypto';
import { encrypt as encryptNIP04 } from '../src/nip04';

// Use ephemeral relay for all tests
const RELAY_TEST_PORT = 3555;
let ephemeralRelay: NostrRelay;

describe('Nostr Client', () => {
  // Setup ephemeral relay for tests
  beforeAll(async () => {
    ephemeralRelay = new NostrRelay(RELAY_TEST_PORT);
    await ephemeralRelay.start();
    console.log(`Ephemeral test relay started on port ${RELAY_TEST_PORT}`);
  });

  afterAll(() => {
    if (ephemeralRelay) {
      ephemeralRelay.close();
      console.log('Ephemeral test relay shut down');
    }
  });

  // Create a fresh client for each test
  let client: Nostr;
  
  beforeEach(() => {
    client = new Nostr([ephemeralRelay.url]);
  });
  
  afterEach(() => {
    try {
      client.disconnectFromRelays();
    } catch (e) {
      // Ignore errors when disconnecting
    }
  });

  describe('Client Initialization', () => {
    test('should initialize with relay URLs', () => {
      expect(client).toBeInstanceOf(Nostr);
    });
    
    test('should generate keys correctly', async () => {
      const keys = await client.generateKeys();
      expect(keys.publicKey).toHaveLength(64);
      expect(keys.privateKey).toHaveLength(64);
      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
    });
  });
  
  describe('Relay Management', () => {
    test('should add relays', () => {
      const additionalRelay = 'ws://localhost:3556';
      client.addRelay(additionalRelay);
      
      // This test verifies the relay was added but doesn't need to connect
      const relays = (client as any).relays;
      expect(relays.has(additionalRelay)).toBe(true);
    });
    
    test('should connect to relays', async () => {
      let connectCount = 0;
      client.on(RelayEvent.Connect, () => {
        connectCount++;
      });
      
      await client.connectToRelays();
      expect(connectCount).toBe(1);
    });
  
    test('should disconnect from relays', async () => {
      await client.connectToRelays();
      
      let disconnectCount = 0;
      client.on(RelayEvent.Disconnect, () => {
        disconnectCount++;
      });
      
      client.disconnectFromRelays();
      
      // Give time for the disconnect event to fire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Our improved relay.ts implementation fires one disconnect event per relay
      expect(disconnectCount).toBeGreaterThan(0);
    });
    
    test('should remove relays', () => {
      const relayUrl = ephemeralRelay.url;
      client.removeRelay(relayUrl);
      
      const relays = (client as any).relays;
      expect(relays.has(relayUrl)).toBe(false);
    });
  });
  
  describe('Event Publishing', () => {
    test('should publish text notes', async () => {
      await client.generateKeys();
      await client.connectToRelays();
      
      const content = 'Test note from testing';
      const note = await client.publishTextNote(content);
      
      expect(note).toBeDefined();
      expect(note?.kind).toBe(1);
      expect(note?.content).toBe(content);
    });
    
    test('should publish metadata', async () => {
      await client.generateKeys();
      await client.connectToRelays();
      
      const metadata = {
        name: 'Test User',
        about: 'Testing the Nostr client',
        picture: 'https://example.com/avatar.png'
      };
      
      const event = await client.publishMetadata(metadata);
      
      expect(event).toBeDefined();
      expect(event?.kind).toBe(0);
      expect(JSON.parse(event?.content || '{}')).toEqual(metadata);
    });
    
    test('should reject publishing without keys', async () => {
      await client.connectToRelays();
      
      await expect(client.publishTextNote('This should fail')).rejects.toThrow();
    });
  });
  
  describe('Direct Messages', () => {
    test('should encrypt and send direct messages', async () => {
      const keys = await client.generateKeys();
      await client.connectToRelays();
      
      // Generate recipient keys
      const recipientKeys = await generateKeypair();
      
      // Send DM
      const content = 'Hello, this is a test DM!';
      const event = await client.publishDirectMessage(content, recipientKeys.publicKey);
      
      expect(event).toBeDefined();
      expect(event?.kind).toBe(4);
      expect(event?.tags).toEqual(expect.arrayContaining([['p', recipientKeys.publicKey]]));
      
      // Verify the content is encrypted (not plaintext)
      expect(event?.content).not.toBe(content);
      expect(event?.content).toContain('?iv=');
    });
    
    test('should decrypt received messages', async () => {
      // Generate recipient keys and set them in our client
      const recipientKeys = await generateKeypair();
      client.setPrivateKey(recipientKeys.privateKey);
      
      // Create a sender client
      const sender = new Nostr([ephemeralRelay.url]);
      const senderKeys = await sender.generateKeys();
      await sender.connectToRelays();
      
      // Create and send a direct message
      const content = 'Test encrypted message';
      const dmEvent = await sender.publishDirectMessage(content, recipientKeys.publicKey);
      
      if (!dmEvent) {
        fail('Failed to create direct message');
        return;
      }
      
      // Test decryption
      const decrypted = client.decryptDirectMessage(dmEvent);
      expect(decrypted).toBe(content);
      
      // Cleanup
      sender.disconnectFromRelays();
    });
    
    test('should reject decryption with wrong keys', async () => {
      // Setup keys
      const senderKeys = await generateKeypair();
      const recipientKeys = await generateKeypair();
      const wrongKeys = await generateKeypair();
      
      // Set wrong keys on the client
      client.setPrivateKey(wrongKeys.privateKey);
      
      // Create a kind 4 direct message event manually
      const content = 'Secret message';
      
      // Create encrypted content
      const encryptedContent = encryptNIP04(
        content,
        senderKeys.privateKey,
        recipientKeys.publicKey
      );
      
      // Create event
      const event: NostrEvent = {
        kind: 4,
        content: encryptedContent,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: senderKeys.publicKey,
        tags: [['p', recipientKeys.publicKey]],
        id: 'fake-id-for-testing',
        sig: 'fake-sig-for-testing'
      };
      
      // The client with wrong keys should not be able to decrypt
      expect(() => client.decryptDirectMessage(event)).toThrow();
    });
  });
  
  describe('Subscription Management', () => {
    test('should create subscriptions', async () => {
      await client.connectToRelays();
      
      const filters: Filter[] = [{ kinds: [1], limit: 10 }];
      const subIds = client.subscribe(filters, () => {}, () => {});
      
      expect(Array.isArray(subIds)).toBe(true);
      expect(subIds.length).toBe(1); // One sub ID per relay
    });
    
    test('should unsubscribe correctly', async () => {
      await client.connectToRelays();
      
      // Create a subscription
      const subIds = client.subscribe([{ kinds: [1] }], () => {}, () => {});
      
      // This basically tests that unsubscribe doesn't throw
      expect(() => {
        client.unsubscribe(subIds);
      }).not.toThrow();
    });
  });
}); 