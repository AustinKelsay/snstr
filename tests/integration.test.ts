import { Nostr, NostrEvent, RelayEvent } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';

describe('Integration Tests', () => {
  // Set longer timeout for integration tests 
  jest.setTimeout(15000);
  
  // Initialize ephemeral relay before tests
  let ephemeralRelay: NostrRelay;
  const TEST_RELAY_PORT = 3333;
  
  beforeAll(async () => {
    // Start an ephemeral relay for testing
    ephemeralRelay = new NostrRelay(TEST_RELAY_PORT, 60); // Purge events every 60 seconds
    await ephemeralRelay.start();
    console.log(`Ephemeral test relay started on port ${TEST_RELAY_PORT}`);
  });
  
  afterAll(() => {
    // Clean up the relay after tests
    if (ephemeralRelay) {
      ephemeralRelay.close();
      console.log('Ephemeral test relay shut down');
    }
  });
  
  test('should perform basic client usage flow', async () => {
    // Initialize Nostr client with our ephemeral relay
    const client = new Nostr([
      ephemeralRelay.url
    ]);
    
    try {
      // Generate keypair
      const keys = await client.generateKeys();
      expect(keys.publicKey).toHaveLength(64);
      expect(keys.privateKey).toHaveLength(64);
      
      // Connect to relays
      let connectCount = 0;
      client.on(RelayEvent.Connect, () => {
        connectCount++;
      });
      
      await client.connectToRelays();
      
      // We should connect to exactly one relay
      expect(connectCount).toBe(1);
      
      // Publish a test note with random data to prevent duplicate detection
      const randomId = Math.random().toString(36).substring(7);
      const noteContent = `Test note from SNSTR integration tests ${randomId}`;
      
      const publishedNote = await client.publishTextNote(noteContent);
      expect(publishedNote).toBeDefined();
      expect(publishedNote?.content).toBe(noteContent);
      
      // Subscribe to our own event
      const receivedEvents: NostrEvent[] = [];
      let eoseReceived = false;
      
      client.subscribe(
        [{ 
          authors: [keys.publicKey],
          kinds: [1],
          limit: 5 
        }],
        (event) => {
          receivedEvents.push(event);
        },
        () => {
          eoseReceived = true;
        }
      );
      
      // Wait for events to be received
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // We should receive our published event and EOSE
      expect(eoseReceived).toBe(true);
      expect(receivedEvents.length).toBeGreaterThan(0);
      
      // Verify that we got our event back
      const foundOurEvent = receivedEvents.some(e => e.content === noteContent);
      expect(foundOurEvent).toBe(true);
      
      // Gracefully disconnect
      client.disconnectFromRelays();
    } catch (error) {
      // Even if the test fails, make sure we disconnect
      try { client.disconnectFromRelays(); } catch {}
      throw error;
    }
  });
  
  test('should handle direct messages between users', async () => {
    // Create two clients for Alice and Bob
    const alice = new Nostr([ephemeralRelay.url]);
    const bob = new Nostr([ephemeralRelay.url]);
    
    try {
      // Generate keypairs
      const aliceKeys = await alice.generateKeys();
      const bobKeys = await bob.generateKeys();
      
      // Connect to relays
      await Promise.all([
        alice.connectToRelays(),
        bob.connectToRelays()
      ]);
      
      // Create a unique test message
      const messageId = Math.random().toString(36).substring(7);
      const messageContent = `Secret test message ${messageId}`;
      
      // Bob subscribes to messages addressed to him before Alice sends anything
      const receivedMessages: string[] = [];
      
      bob.subscribe(
        [{ 
          kinds: [4],
          '#p': [bobKeys.publicKey]
        }],
        (event) => {
          try {
            const decrypted = bob.decryptDirectMessage(event);
            receivedMessages.push(decrypted);
          } catch (error) {
            // Ignore decryption errors for events not from Alice
          }
        }
      );
      
      // Alice sends message to Bob
      const dmEvent = await alice.publishDirectMessage(messageContent, bobKeys.publicKey);
      expect(dmEvent).toBeDefined();
      expect(dmEvent?.kind).toBe(4);
      
      // Wait for subscription to receive events
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if our message was received
      expect(receivedMessages).toContain(messageContent);
      
      // Test direct decryption if we have the event
      if (dmEvent) {
        const decrypted = bob.decryptDirectMessage(dmEvent);
        expect(decrypted).toBe(messageContent);
      }
      
      // Disconnect clients
      alice.disconnectFromRelays();
      bob.disconnectFromRelays();
    } catch (error) {
      // Ensure we disconnect even on test failure
      try { alice.disconnectFromRelays(); } catch {}
      try { bob.disconnectFromRelays(); } catch {}
      throw error;
    }
  });
}); 