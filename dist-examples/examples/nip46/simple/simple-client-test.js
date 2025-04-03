"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const ephemeral_relay_1 = require("../../../src/utils/ephemeral-relay");
async function main() {
    console.log('Testing Simple NIP-46 Implementation');
    console.log('-----------------------------------');
    try {
        // Start an ephemeral relay
        const port = 4571;
        const relay = new ephemeral_relay_1.NostrRelay(port);
        await relay.start();
        const relayUrl = relay.url;
        console.log(`Started relay at ${relayUrl}`);
        // Generate keypairs
        const userKeypair = await (0, src_1.generateKeypair)();
        const signerKeypair = await (0, src_1.generateKeypair)();
        console.log(`\nUser pubkey: ${userKeypair.publicKey}`);
        console.log(`Signer pubkey: ${signerKeypair.publicKey}`);
        // Create and start bunker
        console.log('\nStarting bunker...');
        const bunker = new src_1.SimpleNIP46Bunker([relayUrl], userKeypair.publicKey, signerKeypair.publicKey);
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        await bunker.start();
        // Add a short delay to ensure bunker is ready
        console.log('Waiting for bunker to initialize...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Get connection string
        const connectionString = bunker.getConnectionString();
        console.log(`Connection string: ${connectionString}`);
        // Create and connect client
        console.log('\nConnecting client...');
        const client = new src_1.SimpleNIP46Client([relayUrl]);
        // Set a longer timeout for the request
        try {
            const pubkey = await client.connect(connectionString);
            console.log(`Connected with user pubkey: ${pubkey}`);
            // Test ping
            console.log('\nTesting ping...');
            const pong = await client.ping();
            console.log(`Ping response: ${pong}`);
            // Test signing an event
            console.log('\nSigning a test event...');
            const testEvent = {
                kind: 1,
                content: 'This is a test note from the simple NIP-46 implementation',
                created_at: Math.floor(Date.now() / 1000),
                tags: []
            };
            const signedEvent = await client.signEvent(testEvent);
            console.log(`Signed event ID: ${signedEvent.id}`);
            console.log(`Signed by: ${signedEvent.pubkey}`);
            // Verify signature
            const valid = (0, src_1.verifySignature)(signedEvent.id, signedEvent.sig, signedEvent.pubkey);
            console.log(`Signature valid: ${valid}`);
            // Clean up
            console.log('\nCleaning up...');
            await client.disconnect();
            await bunker.stop();
            await relay.close();
            console.log('Test completed successfully!');
        }
        catch (error) {
            console.error('Error:', error.message);
            console.error(error.stack);
            // Clean up resources even on error
            try {
                await client.disconnect();
                await bunker.stop();
                await relay.close();
            }
            catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }
    }
    catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}
main();
