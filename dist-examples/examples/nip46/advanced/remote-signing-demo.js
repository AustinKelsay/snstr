"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const logger_1 = require("../../../src/nip46/utils/logger");
const ephemeral_relay_1 = require("../../../src/utils/ephemeral-relay");
/**
 * Advanced example demonstrating NIP-46 remote signing and encryption
 * with permission handling, connection management, and best practices.
 */
async function main() {
    console.log('=== NIP-46 Remote Signing Advanced Demo ===\n');
    // Use an ephemeral relay for testing - in production you'd use public relays
    const relay = new ephemeral_relay_1.NostrRelay(3000);
    await relay.start();
    console.log('Started ephemeral relay at:', relay.url);
    const relays = [relay.url];
    // Generate test keypairs
    console.log('\nGenerating keypairs...');
    const userKeypair = await (0, src_1.generateKeypair)();
    const signerKeypair = await (0, src_1.generateKeypair)();
    console.log(`User public key: ${userKeypair.publicKey}`);
    console.log(`Signer public key: ${signerKeypair.publicKey}`);
    // Create a bunker instance with debug logging
    console.log('\nStarting bunker...');
    const bunker = new src_1.SimpleNIP46Bunker(relays, userKeypair.publicKey, signerKeypair.publicKey);
    // Set default permissions for all clients
    bunker.setDefaultPermissions([
        'sign_event:1', // Allow signing Kind 1 (text notes)
        'sign_event:4', // Allow signing Kind 4 (encrypted DMs)
        'nip04_encrypt:*', // Allow encryption with anyone
        'nip04_decrypt:*' // Allow decryption with anyone
    ]);
    // Enable debug logging
    bunker.setLogLevel(logger_1.LogLevel.DEBUG);
    // Set the private keys (in a real application, these would be securely stored)
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    // Start the bunker
    await bunker.start();
    // Get the connection string to share with clients
    const connectionString = bunker.getConnectionString();
    console.log('Bunker connection string:', connectionString);
    // Create a client with debug logging
    console.log('\nCreating client...');
    const client = new src_1.SimpleNIP46Client(relays);
    client.setLogLevel(logger_1.LogLevel.DEBUG);
    try {
        // Connect to the bunker
        console.log('Connecting to bunker...');
        await client.connect(connectionString);
        console.log('Connected successfully!');
        // Get the user's public key from the bunker
        const userPubkey = await client.getPublicKey();
        console.log('\nUser public key from bunker:', userPubkey);
        console.log('Matches original:', userPubkey === userKeypair.publicKey ? 'Yes' : 'No');
        // Test ping
        console.log('\nSending ping to verify connection...');
        const pong = await client.ping();
        console.log('Ping response:', pong ? 'Successful' : 'Failed');
        // Create a third party for encryption tests
        const thirdPartyKeypair = await (0, src_1.generateKeypair)();
        console.log('\nGenerated third party key for encryption tests:');
        console.log(`Third party public key: ${thirdPartyKeypair.publicKey}`);
        // Sign an event remotely
        console.log('\nRemotely signing an event...');
        const eventToSign = {
            kind: 1,
            content: 'Hello from a remote signer!',
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        console.log('Event to sign:', JSON.stringify(eventToSign));
        const signedEvent = await client.signEvent(eventToSign);
        console.log('Signed event:', JSON.stringify(signedEvent, null, 2));
        // Test NIP-04 encryption
        console.log('\nTesting NIP-04 encryption...');
        const message = 'This is a secret message for testing encryption';
        console.log(`Message to encrypt: ${message}`);
        const encrypted = await client.nip04Encrypt(thirdPartyKeypair.publicKey, message);
        console.log(`Encrypted: ${encrypted}`);
        // Test NIP-04 decryption
        console.log('\nTesting NIP-04 decryption...');
        const decrypted = await client.nip04Decrypt(thirdPartyKeypair.publicKey, encrypted);
        console.log(`Decrypted: ${decrypted}`);
        console.log(`Original message recovered: ${decrypted === message ? 'Yes' : 'No'}`);
        // Try to sign an event without permission
        console.log('\nTesting permission restrictions...');
        try {
            const unauthorizedEvent = {
                kind: 30023, // No permission for this kind
                content: 'This should fail due to missing permission',
                created_at: Math.floor(Date.now() / 1000),
                tags: []
            };
            console.log('Attempting to sign unauthorized event kind 30023...');
            await client.signEvent(unauthorizedEvent);
            console.log('WARNING: Unauthorized event was signed (unexpected)');
        }
        catch (error) {
            console.log('Failed to sign unauthorized event (expected):', error.message);
        }
    }
    catch (error) {
        console.error('Error in demo:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
    finally {
        // Clean up
        console.log('\nCleaning up...');
        await client.disconnect();
        await bunker.stop();
        await relay.close();
        console.log('Demo completed');
    }
}
main().catch(error => {
    console.error('Unhandled error in main:', error);
});
