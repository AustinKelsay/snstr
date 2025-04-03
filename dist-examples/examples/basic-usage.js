"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const ephemeral_relay_1 = require("../src/utils/ephemeral-relay");
// Set this to false to use external relays instead of ephemeral relay
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== 'false';
async function main() {
    try {
        let client;
        let ephemeralRelay;
        if (USE_EPHEMERAL) {
            // Use an ephemeral relay for testing
            console.log('Starting ephemeral relay on port 3001...');
            ephemeralRelay = new ephemeral_relay_1.NostrRelay(3001);
            await ephemeralRelay.start();
            console.log(`Ephemeral relay running at ${ephemeralRelay.url}`);
            client = new src_1.Nostr([ephemeralRelay.url]);
        }
        else {
            // Initialize Nostr client with public relays
            console.log('Using public relays: wss://relay.primal.net');
            client = new src_1.Nostr(['wss://relay.primal.net']);
        }
        // Generate or set keys
        console.log('Generating keypair...');
        const keys = await client.generateKeys();
        console.log('Public key:', keys.publicKey);
        // Connect to relays
        console.log('Connecting to relays...');
        await client.connectToRelays();
        // Setup event handlers
        client.on(src_1.RelayEvent.Connect, (relayUrl) => {
            console.log(`Connected to relay: ${relayUrl}`);
        });
        client.on(src_1.RelayEvent.Disconnect, (relayUrl) => {
            console.log(`Disconnected from relay: ${relayUrl}`);
        });
        client.on(src_1.RelayEvent.Error, (relayUrl, error) => {
            console.error(`Error from relay ${relayUrl}:`, error);
        });
        // Subscribe to events
        console.log('Subscribing to events...');
        const filters = [
            {
                kinds: [1], // Text notes
                limit: 5
            }
        ];
        const subscriptionIds = client.subscribe(filters, (event, relayUrl) => {
            console.log(`Received event from ${relayUrl}:`);
            console.log(`  ID: ${event.id.slice(0, 8)}...`);
            console.log(`  Author: ${event.pubkey.slice(0, 8)}...`);
            console.log(`  Content: ${event.content.length > 50 ? event.content.slice(0, 50) + '...' : event.content}`);
            console.log('---');
        }, () => {
            console.log('End of stored events');
        });
        // Message content depends on which relay we're using
        const messageContent = USE_EPHEMERAL
            ? 'Hello from SNSTR with ephemeral relay!'
            : 'Hello from SNSTR with primal.net relay!';
        // Publish a note
        console.log('Publishing a note...');
        const note = await client.publishTextNote(messageContent);
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
        // Shut down the ephemeral relay if we used one
        if (ephemeralRelay) {
            console.log('Shutting down ephemeral relay...');
            ephemeralRelay.close();
        }
        console.log('Done!');
    }
    catch (error) {
        console.error('Error:', error);
    }
}
main();
