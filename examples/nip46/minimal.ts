import { 
  SimpleNIP46Client, 
  SimpleNIP46Bunker, 
  generateKeypair
} from '../../src';
import { LogLevel } from '../../src/nip46/utils/logger';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

/**
 * This minimal example demonstrates NIP-46 remote signing functionality.
 * It creates a bunker (signer) and client, establishes a connection,
 * and performs basic operations like signing an event.
 */
async function run() {
  // Create a local ephemeral relay for testing
  const relay = new NostrRelay(4000);
  const relays = [relay.url];
  
  try {
    console.log('=== NIP-46 Minimal Example ===');
    
    // 1. Start the relay
    await relay.start();
    console.log(`Using local ephemeral relay: ${relay.url}`);
    
    // 2. Generate test keypairs
    console.log('\nGenerating keypairs...');
    const userKeypair = await generateKeypair();
    console.log(`User public key: ${userKeypair.publicKey}`);
    
    // 3. Create and start bunker with more verbose logging
    console.log('\nStarting bunker...');
    const bunker = new SimpleNIP46Bunker(relays, userKeypair.publicKey);
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(userKeypair.privateKey);
    bunker.setLogLevel(LogLevel.DEBUG);

    // Set permissions for signing events
    bunker.setDefaultPermissions(['sign_event:1', 'get_public_key', 'ping']);

    await bunker.start();
    
    // 4. Get connection string
    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);
    
    // 5. Create and connect client with more verbose logging
    console.log('\nConnecting client...');
    const client = new SimpleNIP46Client(relays, { timeout: 5000, logLevel: LogLevel.DEBUG });
    await client.connect(connectionString);
    
    // 6. Verify connection with ping
    console.log('Testing connection with ping...');
    const pingResult = await client.ping();
    console.log(`Ping result: ${pingResult ? 'Success' : 'Failed'}`);
    
    // 7. Get public key
    console.log('\nGetting user public key from bunker...');
    const pubkey = await client.getPublicKey();
    console.log(`Retrieved public key: ${pubkey}`);
    console.log(`Matches original: ${pubkey === userKeypair.publicKey ? 'Yes' : 'No'}`);
    
    // 8. Sign an event
    console.log('\nSigning a test event...');
    const eventTemplate = {
      kind: 1,
      content: 'Hello from NIP-46 example!',
      created_at: Math.floor(Date.now() / 1000),
      tags: []
    };
    
    const signedEvent = await client.signEvent(eventTemplate);
    console.log('Event signed successfully:');
    console.log(JSON.stringify(signedEvent, null, 2));
    
    // 9. Clean up
    console.log('\nCleaning up...');
    await client.disconnect();
    await bunker.stop();
    await relay.close();
    
    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in NIP-46 example:', error);
    
    // Clean up resources even if there's an error
    if (relay) {
      try {
        await relay.close();
      } catch (e) {
        console.error('Error closing relay:', e);
      }
    }
  }
}

// Run the example
run(); 