import { Nostr, NostrEvent, Filter, RelayEvent } from '../src';

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
    // Initialize Nostr clients - one for Alice, one for Bob
    // In a real application, these would be running on different devices
    const alice = new Nostr(['wss://relay.damus.io', 'wss://relay.nostr.info']);
    const bob = new Nostr(['wss://relay.damus.io', 'wss://relay.nostr.info']);

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
    const messageContent = "Hello Bob! This is a secret message that only you can read.";
    
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
    
    // Wait for 10 seconds to receive messages
    console.log('\nWaiting for 10 seconds to receive messages...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Gracefully disconnect from relays
    console.log('Disconnecting from relays...');
    try {
      alice.disconnectFromRelays();
      bob.disconnectFromRelays();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 