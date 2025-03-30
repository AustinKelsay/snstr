import { Nostr, NostrEvent, Filter, RelayEvent } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';

// Set this to false to use external relays instead of ephemeral relay
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== 'false';

/**
 * This example demonstrates NIP-04 encrypted direct messaging between two users.
 * 
 * In this scenario:
 * - Alice will send an encrypted message to Bob
 * - Bob will receive, decrypt, and display the message
 * 
 * NIP-04 creates a shared secret between the sender and recipient using ECDH
 * (Elliptic Curve Diffie-Hellman) key exchange and encrypts the message with
 * AES-256-CBC.
 */
async function main() {
  try {
    let alice: Nostr;
    let bob: Nostr;
    let ephemeralRelay: NostrRelay | null = null;

    if (USE_EPHEMERAL) {
      // Start an ephemeral relay on port 3001
      console.log('Starting ephemeral relay on port 3001...');
      ephemeralRelay = new NostrRelay(3001, 60); // Purge every 60 seconds
      await ephemeralRelay.start();
      console.log('Ephemeral relay started');
      
      // Initialize Nostr clients with our ephemeral relay
      alice = new Nostr([ephemeralRelay.url]);
      bob = new Nostr([ephemeralRelay.url]);
    } else {
      // Initialize Nostr clients with public relays
      console.log('Using public relays: wss://relay.primal.net and wss://relay.nostr.band');
      const relays = ['wss://relay.primal.net', 'wss://relay.nostr.band'];
      alice = new Nostr(relays);
      bob = new Nostr(relays);
    }

    // Generate keypairs for both users
    console.log('Generating keypairs...');
    const aliceKeys = await alice.generateKeys();
    console.log('Alice public key:', aliceKeys.publicKey);
    
    const bobKeys = await bob.generateKeys();
    console.log('Bob public key:', bobKeys.publicKey);
    
    // Connect to relays
    console.log('Connecting to relays...');
    await Promise.all([
      alice.connectToRelays(),
      bob.connectToRelays()
    ]);
    
    // Setup subscription for Bob to receive direct messages
    // In NIP-04, the 'p' tag contains the recipient's pubkey
    console.log('Setting up subscription for Bob to receive messages...');
    const bobFilters: Filter[] = [
      { 
        kinds: [4], // Kind 4 events are direct messages
        '#p': [bobKeys.publicKey] // Messages addressed to Bob will have his pubkey in a 'p' tag
      }
    ];
    
    bob.subscribe(
      bobFilters,
      (event: NostrEvent, relay: string) => {
        console.log(`Bob received encrypted message from ${relay}:`);
        console.log(`  ID: ${event.id.slice(0, 8)}...`);
        console.log(`  Sender: ${event.pubkey.slice(0, 8)}...`); // The sender's pubkey
        console.log(`  Encrypted content: ${event.content.slice(0, 20)}...`);
        
        try {
          // Decrypt the message using Bob's private key and the sender's public key
          // NIP-04 encryption creates a shared secret between sender and recipient
          const decryptedMessage = bob.decryptDirectMessage(event);
          console.log(`  Decrypted content: ${decryptedMessage}`);
        } catch (error) {
          console.error('  Failed to decrypt message:', error);
        }
        
        console.log('---');
      }
    );
    
    // Alice sends an encrypted direct message to Bob
    // The message is encrypted with Alice's private key and Bob's public key
    console.log('\nAlice sending encrypted message to Bob...');
    const messageContent = USE_EPHEMERAL 
      ? "Hello Bob! This is a secret message that only you can read via our ephemeral relay."
      : "Hello Bob! This is a secret message that only you can read via public relays.";
    
    try {
      // This will:
      // 1. Encrypt the message using NIP-04 (AES-256-CBC with a shared secret)
      // 2. Create a kind 4 event with the encrypted content
      // 3. Include Bob's pubkey in a 'p' tag
      // 4. Sign the event with Alice's private key
      // 5. Publish to all connected relays
      const dmEvent = await alice.publishDirectMessage(messageContent, bobKeys.publicKey);
      console.log(`Alice sent message with ID: ${dmEvent?.id}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
    
    // Wait for 5 seconds to receive messages
    console.log('\nWaiting for 5 seconds to receive messages...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Alice sends a second message
    console.log('\nAlice sending a second message to Bob...');
    const secondMessage = "This is another secret message. Secure communication is important!";
    
    try {
      const dmEvent2 = await alice.publishDirectMessage(secondMessage, bobKeys.publicKey);
      console.log(`Alice sent second message with ID: ${dmEvent2?.id}`);
    } catch (error) {
      console.error('Error sending second message:', error);
    }
    
    // Wait another 5 seconds
    console.log('\nWaiting for 5 more seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Gracefully disconnect from relays
    console.log('Disconnecting from relays...');
    try {
      alice.disconnectFromRelays();
      bob.disconnectFromRelays();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
    
    // Shut down the ephemeral relay if we used one
    if (ephemeralRelay) {
      console.log('Shutting down ephemeral relay...');
      ephemeralRelay.close();
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 