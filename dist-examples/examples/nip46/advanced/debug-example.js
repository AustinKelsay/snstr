"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const logger_1 = require("../../../src/nip46/utils/logger");
const ephemeral_relay_1 = require("../../../src/utils/ephemeral-relay");
/**
 * NIP-46 Debug Example
 *
 * This example demonstrates how to debug NIP-46 connections with enhanced
 * logging and step-by-step verification of relay communication.
 *
 * It's useful for diagnosing connection issues, authentication problems,
 * or to understand the sequence of events in the NIP-46 protocol.
 */
async function main() {
    console.log('=== NIP-46 Debug Example ===');
    console.log('---------------------------');
    try {
        // Start ephemeral relay with diagnostics enabled
        console.log('\n1. Starting ephemeral relay for testing...');
        const relay = new ephemeral_relay_1.NostrRelay(3458);
        await relay.start();
        console.log(`✓ Relay started at: ${relay.url}`);
        // Generate keypairs with detailed output
        console.log('\n2. Generating test keypairs...');
        const userKeypair = await (0, src_1.generateKeypair)();
        const signerKeypair = await (0, src_1.generateKeypair)();
        console.log(`✓ User pubkey:   ${userKeypair.publicKey}`);
        console.log(`  User privkey:  ${userKeypair.privateKey.substring(0, 8)}...`);
        console.log(`✓ Signer pubkey: ${signerKeypair.publicKey}`);
        console.log(`  Signer privkey: ${signerKeypair.privateKey.substring(0, 8)}...`);
        // ---- BUNKER SETUP ----
        console.log('\n3. Setting up bunker with maximum debug logging...');
        const bunker = new src_1.SimpleNIP46Bunker([relay.url], userKeypair.publicKey, signerKeypair.publicKey);
        // Set to max logging level for debugging
        bunker.setLogLevel(logger_1.LogLevel.DEBUG);
        // Set up keys and permissions
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        // Set permissions for all methods to help with debugging
        bunker.setDefaultPermissions([
            'sign_event:*', // Allow signing any event kind 
            'nip04_encrypt:*', // Allow encryption with any pubkey
            'nip04_decrypt:*', // Allow decryption with any pubkey
            'get_public_key', // Allow retrieving public key
            'ping' // Allow ping
        ]);
        console.log('\n4. Starting bunker and waiting for setup...');
        await bunker.start();
        console.log('✓ Bunker started successfully');
        // Wait for bunker to fully set up and connect to relays
        console.log('Waiting 2 seconds for relay connections to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Generate connection string
        const connectionString = bunker.getConnectionString();
        console.log(`✓ Connection string: ${connectionString}`);
        // ---- CLIENT SETUP ----
        console.log('\n5. Setting up client with debug logging...');
        const client = new src_1.SimpleNIP46Client([relay.url]);
        client.setLogLevel(logger_1.LogLevel.DEBUG);
        // Connect with timeout for debugging
        console.log('\n6. Connecting to bunker with debug timeout...');
        try {
            // Use shorter connect timeout for debugging purposes
            const connectPromise = client.connect(connectionString);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Debug timeout after 8 seconds')), 8000);
            });
            const pubkey = await Promise.race([connectPromise, timeoutPromise]);
            console.log(`✓ Connected successfully!`);
            console.log(`✓ Remote user pubkey: ${pubkey}`);
            console.log(`✓ Matches original: ${pubkey === userKeypair.publicKey ? 'Yes' : 'No'}`);
            // Test ping for connection verification
            console.log('\n7. Testing connection with ping...');
            const pingResult = await client.ping();
            console.log(`✓ Ping result: ${pingResult}`);
            // Test signing ability
            console.log('\n8. Testing event signing...');
            const eventTemplate = {
                kind: 1,
                content: 'Test note from debug example',
                created_at: Math.floor(Date.now() / 1000),
                tags: []
            };
            try {
                const signedEvent = await client.signEvent(eventTemplate);
                console.log('✓ Event signed successfully. ID:', signedEvent.id);
            }
            catch (error) {
                console.error(`✗ Event signing failed: ${error.message}`);
            }
        }
        catch (error) {
            console.error(`✗ Connection failed: ${error.message}`);
            // Wait a bit longer to see if we get any logs from the bunker
            console.log('\nWaiting 5 seconds to capture additional relay traffic...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        // ---- CLEANUP ----
        console.log('\n9. Cleaning up resources...');
        await client.disconnect();
        await bunker.stop();
        await relay.close();
        console.log('\n✓ Debug test completed');
    }
    catch (error) {
        console.error(`✗ Unhandled error: ${error.message}`);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}
main().catch(error => {
    console.error('Fatal error in main:', error);
});
