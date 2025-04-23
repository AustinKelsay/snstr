import { Relay, RelayEvent } from '../src';

/**
 * This example demonstrates the improved connection handling in SNSTR
 * Including timeout handling, error management, and race condition fixes
 */
async function main() {
  // Create a relay with a specific connection timeout (5 seconds)
  const relay = new Relay('wss://relay.nostr.band', { connectionTimeout: 5000 });
  console.log(`Created relay with connection timeout: ${relay.getConnectionTimeout()}ms`);
  
  // Setup event handlers before connecting
  relay.on(RelayEvent.Connect, (relayUrl) => {
    console.log(`✅ Connected to relay: ${relayUrl}`);
  });
  
  relay.on(RelayEvent.Disconnect, (relayUrl) => {
    console.log(`❌ Disconnected from relay: ${relayUrl}`);
  });
  
  relay.on(RelayEvent.Error, (relayUrl, error) => {
    console.error(`⚠️ Error from relay ${relayUrl}:`, error);
  });
  
  // Attempt to connect with proper error handling
  console.log('Connecting to relay...');
  try {
    const connected = await relay.connect();
    if (connected) {
      console.log('Successfully connected to relay');
    } else {
      console.error('Failed to connect to relay');
      // Demonstrate changing timeout and retrying
      console.log('Changing timeout and retrying...');
      relay.setConnectionTimeout(10000); // Increase timeout to 10 seconds
      console.log(`New connection timeout: ${relay.getConnectionTimeout()}ms`);
      
      const retryConnected = await relay.connect();
      if (retryConnected) {
        console.log('Successfully connected on retry');
      } else {
        console.error('Failed to connect on retry');
        return; // Exit if we still can't connect
      }
    }
  } catch (error) {
    console.error('Connection error:', error);
    return; // Exit if connection errors out
  }
  
  // Demonstrate timeout behavior with an invalid relay
  console.log('\nDemonstrating timeout with an invalid relay...');
  const invalidRelay = new Relay('wss://invalid.relay.example', { connectionTimeout: 3000 });
  
  invalidRelay.on(RelayEvent.Error, (relayUrl, error) => {
    console.error(`⚠️ Error from invalid relay ${relayUrl}:`, error);
  });
  
  console.log(`Invalid relay connection timeout: ${invalidRelay.getConnectionTimeout()}ms`);
  console.log('Attempting to connect to invalid relay (should time out)...');
  
  const invalidConnected = await invalidRelay.connect();
  if (!invalidConnected) {
    console.log('✅ Correctly failed to connect to invalid relay');
  } else {
    console.error('❌ Unexpectedly connected to invalid relay');
  }
  
  // Demonstrate proper cleanup
  if (relay.getConnectionTimeout() !== 10000) {
    console.error('Expected connection timeout to be 10000ms');
  }
  
  // Disconnect from relay
  console.log('\nDisconnecting from relay...');
  relay.disconnect();
  
  // Wait a moment to see the disconnect message
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('Example completed.');
}

// Execute the main function
main()
  .catch(error => {
    console.error('Unhandled error in main:', error);
  }); 