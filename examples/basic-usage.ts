import { Nostr, NostrEvent, Filter, RelayEvent } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';

async function main() {
  try {
    // Start an ephemeral relay on port 3000
    console.log('Starting ephemeral relay on port 3000...');
    const relay = new NostrRelay(3000, 60); // Purge every 60 seconds
    await relay.start();
    console.log('Ephemeral relay started');

    // Initialize Nostr client with our ephemeral relay
    const client = new Nostr([
      relay.url
    ]);

    // Generate or set keys
    console.log('Generating keypair...');
    const keys = await client.generateKeys();
    console.log('Public key:', keys.publicKey);
    
    // Connect to relays
    console.log('Connecting to relays...');
    await client.connectToRelays();
    
    // Setup event handlers
    client.on(RelayEvent.Connect, (relayUrl) => {
      console.log(`Connected to relay: ${relayUrl}`);
    });
    
    client.on(RelayEvent.Disconnect, (relayUrl) => {
      console.log(`Disconnected from relay: ${relayUrl}`);
    });
    
    client.on(RelayEvent.Error, (relayUrl, error) => {
      console.error(`Error from relay ${relayUrl}:`, error);
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
      (event: NostrEvent, relayUrl: string) => {
        console.log(`Received event from ${relayUrl}:`);
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
    const note = await client.publishTextNote('Hello from SNSTR with ephemeral relay!');
    console.log(`Published note with ID: ${note?.id}`);
    
    // Publish another note after a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Publishing a second note...');
    const note2 = await client.publishTextNote('This is a second test note!');
    console.log(`Published second note with ID: ${note2?.id}`);
    
    // Wait a bit then clean up
    console.log('Waiting for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Unsubscribe and disconnect
    console.log('Cleaning up...');
    client.unsubscribe(subscriptionIds);
    client.disconnectFromRelays();
    
    // Shut down the ephemeral relay
    console.log('Shutting down relay...');
    relay.close();
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 