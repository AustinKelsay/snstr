"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../src");
/**
 * This minimal example demonstrates NIP-46 remote signing functionality.
 * It creates a bunker (signer) and client, establishes a connection,
 * and performs basic operations like signing an event.
 */
async function run() {
    try {
        console.log('=== NIP-46 Minimal Example ===');
        // 1. Set up relay
        const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band'];
        console.log(`Using relays: ${relays.join(', ')}`);
        // 2. Generate test keypairs
        console.log('\nGenerating keypairs...');
        const userKeypair = await (0, src_1.generateKeypair)();
        console.log(`User public key: ${userKeypair.publicKey}`);
        // 3. Create and start bunker
        console.log('\nStarting bunker...');
        const bunker = new src_1.SimpleNIP46Bunker(relays, userKeypair.publicKey);
        bunker.setUserPrivateKey(userKeypair.privateKey);
        await bunker.start();
        // 4. Get connection string
        const connectionString = bunker.getConnectionString();
        console.log(`Connection string: ${connectionString}`);
        // 5. Create and connect client
        console.log('\nConnecting client...');
        const client = new src_1.SimpleNIP46Client(relays);
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
        console.log('Example completed successfully!');
    }
    catch (error) {
        console.error('Error in NIP-46 example:', error);
    }
}
// Run the example
run();
