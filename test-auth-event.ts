import { Relay } from './src/nip01/relay';
import { RelayEvent } from './src/types/nostr';

// Enable debug logging
process.env.DEBUG = 'nostr:*';

async function testAuthEvent() {
  console.log('Starting AUTH event test...');
  
  // Create a relay instance
  const relayUrl = 'wss://relay.damus.io/';
  const relay = new Relay(relayUrl);
  
  // Register event handlers
  relay.on(RelayEvent.Connect, (url) => {
    console.log(`Connected to relay: ${url}`);
  });
  
  relay.on(RelayEvent.Disconnect, (url) => {
    console.log(`Disconnected from relay: ${url}`);
  });
  
  relay.on(RelayEvent.Error, (url, error) => {
    console.error(`Error from relay ${url}:`, error);
  });
  
  // Register our AUTH event handler - should receive both relay URL and challenge
  relay.on(RelayEvent.Auth, (url, challengeEvent) => {
    console.log('------------------------------------');
    console.log(`AUTH event received from relay: ${url}`);
    console.log('Challenge event:', JSON.stringify(challengeEvent, null, 2));
    console.log('------------------------------------');
    
    // Verify that we received both the relay URL and the challenge event
    if (url === relayUrl) {
      console.log('✅ SUCCESS: Relay URL was correctly passed to AUTH event handler');
    } else {
      console.error('❌ ERROR: Relay URL was not correctly passed to AUTH event handler');
    }
    
    if (challengeEvent) {
      console.log('✅ SUCCESS: Challenge event was correctly passed to AUTH event handler');
    } else {
      console.error('❌ ERROR: Challenge event was not passed to AUTH event handler');
    }
  });
  
  // Connect to the relay
  console.log(`Connecting to ${relayUrl}...`);
  try {
    const connected = await relay.connect();
    console.log(`Connection result: ${connected ? 'connected' : 'failed'}`);
    
    // Note: Not all relays will send an AUTH challenge
    // We'll wait a bit to see if we receive one
    console.log('Waiting for potential AUTH challenge (not all relays require auth)...');
    
    // Wait for 5 seconds to see if we get an AUTH challenge
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Manual simulation of an AUTH message
    console.log('\nSimulating an AUTH message from the relay...');
    // @ts-expect-error - Access private method for testing
    relay['handleMessage'](['AUTH', { 
      id: 'simulated-challenge-id',
      kind: 22242,
      pubkey: '00000000000000000000000000000000000000000000000000000000000000000',
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'This is a simulated AUTH challenge',
      sig: '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    }]);
    
    // Disconnect after the test
    console.log('\nDisconnecting from relay...');
    relay.disconnect();
  } catch (error) {
    console.error('Error connecting to relay:', error);
  }
}

// Run the test
testAuthEvent().catch(console.error); 