import { Nostr, NostrEvent, Filter, RelayEvent } from '../src';

async function main() {
  try {
    // Initialize Nostr client with relays
    const client = new Nostr([
      'wss://relay.damus.io',
      'wss://relay.nostr.info',
      'wss://nostr-pub.wellorder.net'
    ]);

    // Generate or set keys
    console.log('Generating keypair...');
    const keys = await client.generateKeys();
    console.log('Public key:', keys.publicKey);
    
    // Connect to relays
    console.log('Connecting to relays...');
    await client.connectToRelays();
    
    // Setup event handlers
    client.on(RelayEvent.Connect, (relay) => {
      console.log(`Connected to relay: ${relay}`);
    });
    
    client.on(RelayEvent.Disconnect, (relay) => {
      console.log(`Disconnected from relay: ${relay}`);
    });
    
    client.on(RelayEvent.Error, (relay, error) => {
      console.error(`Error from relay ${relay}:`, error);
    });
    
    // Subscribe to events
    console.log('Subscribing to events...');
    const filters: Filter[] = [
      { 
        kinds: [1], // Text notes
        limit: 5 
      }
    ];
    
    const subscriptionIds = client.subscribe(
      filters,
      (event: NostrEvent, relay: string) => {
        console.log(`Received event from ${relay}:`);
        console.log(`  ID: ${event.id.slice(0, 8)}...`);
        console.log(`  Author: ${event.pubkey.slice(0, 8)}...`);
        console.log(`  Content: ${event.content.length > 50 ? event.content.slice(0, 50) + '...' : event.content}`);
        console.log('---');
      },
      () => {
        console.log('End of stored events');
      }
    );
    
    // Publish a note
    console.log('Publishing a note...');
    const note = await client.publishTextNote('Hello from SNSTR!');
    console.log(`Published note with ID: ${note?.id}`);
    
    // Wait for 10 seconds then clean up
    console.log('Waiting for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Unsubscribe and disconnect
    console.log('Cleaning up...');
    client.unsubscribe(subscriptionIds);
    client.disconnectFromRelays();
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 