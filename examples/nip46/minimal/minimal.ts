import { 
  SimpleNIP46Client, 
  SimpleNIP46Bunker,
  generateKeypair,
} from '../../../src';
import { NostrRelay } from '../../../src/utils/ephemeral-relay';

/**
 * Minimal NIP-46 Remote Signing Example
 * 
 * This example demonstrates:
 * 1. Setting up a bunker with user and signer keypairs
 * 2. Creating a client and connecting to the bunker
 * 3. Remotely signing an event through the bunker
 */
async function main() {
  try {
    console.log('🔑 NIP-46 Remote Signing Demo');
    console.log('----------------------------');

    // Start an ephemeral relay for testing
    const relay = new NostrRelay(3456);
    await relay.start();
    console.log(`Relay running at: ${relay.url}`);

    // Generate separate keypairs for user identity and bunker communication
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair();
    
    console.log(`User public key: ${userKeypair.publicKey.slice(0, 8)}...`);
    console.log(`Signer public key: ${signerKeypair.publicKey.slice(0, 8)}...`);

    // 1. Create and set up the bunker
    const bunker = new SimpleNIP46Bunker(
      [relay.url],                // Relays to connect to
      userKeypair.publicKey,      // User's public key (for signing events)
      signerKeypair.publicKey     // Signer's public key (for encrypted communication)
    );
    
    // Set the private keys in the bunker (these never leave the bunker)
    await bunker.setUserPrivateKey(userKeypair.privateKey);
    await bunker.setSignerPrivateKey(signerKeypair.privateKey);
    
    // Start the bunker
    await bunker.start();
    console.log('✅ Bunker started successfully');
    
    // Generate a connection string to share with clients
    const connectionString = bunker.getConnectionString();
    console.log(`Connection string: ${connectionString}`);

    // 2. Create a client and connect to the bunker
    const client = new SimpleNIP46Client([relay.url]);
    
    // Wait a bit to make sure relay and bunker are ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect to the bunker using the connection string
    console.log('🔌 Connecting client to bunker...');
    
    try {
      const pubkey = await client.connect(connectionString);
      console.log(`✅ Connected! User public key: ${pubkey.slice(0, 8)}...`);
      
      // Verify we got the correct user pubkey
      if (pubkey !== userKeypair.publicKey) {
        throw new Error('Received incorrect user public key from bunker');
      }

      // 3. Test remote signing
      console.log('✍️  Signing an event remotely...');
      const eventToSign = {
        kind: 1,
        content: 'Hello, signed via NIP-46!',
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      };
      
      // Request remote signing
      const signedEvent = await client.signEvent(eventToSign);
      
      console.log(`✅ Event signed successfully!`);
      console.log(`   ID: ${signedEvent.id.slice(0, 8)}...`);
      console.log(`   Signed with user pubkey: ${signedEvent.pubkey === userKeypair.publicKey}`);
    } catch (error) {
      console.error('Failed during connection or signing:', error);
    }

    // Clean up
    console.log('🧹 Cleaning up...');
    await client.disconnect();
    await bunker.stop();
    await relay.close();
  
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main(); 