import { Nostr, NostrEvent, RelayEvent } from '../src';

// Mark as integration test that can be skipped in CI environments
describe('Integration Tests', () => {
  // Set longer timeout for integration tests that connect to real relays
  jest.setTimeout(15000);
  
  // Check if we're in a CI environment where we might want to skip these tests
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
  const testFn = runIntegrationTests ? test : test.skip;
  
  testFn('should perform basic client usage flow', async () => {
    // Initialize Nostr client with test relays
    // Use less popular relays for testing to avoid overwhelming main relays
    const client = new Nostr([
      'wss://relay.damus.io',
      'wss://relay.nostr.info'
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
      
      // We should connect to at least one relay
      expect(connectCount).toBeGreaterThan(0);
      
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
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // We should receive our published event and EOSE
      expect(eoseReceived).toBe(true);
      
      // We might receive our event, but since Nostr is eventually consistent
      // and relays might be slow, we won't strictly assert this
      // The important part is that the code runs without errors
      
      // Gracefully disconnect
      client.disconnectFromRelays();
    } catch (error) {
      // Even if the test fails, make sure we disconnect
      try { client.disconnectFromRelays(); } catch {}
      throw error;
    }
  });
  
  testFn('should handle direct messages between users', async () => {
    // Create two clients for Alice and Bob
    const alice = new Nostr(['wss://relay.damus.io']);
    const bob = new Nostr(['wss://relay.damus.io']);
    
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
      
      // Alice sends message to Bob
      const dmEvent = await alice.publishDirectMessage(messageContent, bobKeys.publicKey);
      expect(dmEvent).toBeDefined();
      expect(dmEvent?.kind).toBe(4);
      
      // If we're running in a real environment, test Bob receiving the message
      if (process.env.TEST_REALTIME_DM === 'true') {
        // Bob subscribes to messages addressed to him
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
        
        // Wait for subscription to receive events
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if our message was received
        // This might fail in CI environments due to relay latency
        const messageReceived = receivedMessages.includes(messageContent);
        console.log(`Direct message received: ${messageReceived}`);
      }
      
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