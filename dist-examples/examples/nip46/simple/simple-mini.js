"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const ephemeral_relay_1 = require("../../../src/utils/ephemeral-relay");
async function main() {
    console.log('NIP-46 Minimal Example');
    console.log('---------------------');
    // Start ephemeral relay
    const relay = new ephemeral_relay_1.NostrRelay(3457);
    await relay.start();
    console.log(`Relay: ${relay.url}`);
    // Generate keypairs
    const userKeypair = await (0, src_1.generateKeypair)(); // This is the user's actual identity
    const signerKeypair = await (0, src_1.generateKeypair)(); // This is for the bunker communication
    console.log(`User pubkey: ${userKeypair.publicKey.substring(0, 8)}...`);
    console.log(`Signer pubkey: ${signerKeypair.publicKey.substring(0, 8)}...`);
    try {
        // ---- BUNKER SETUP ----
        const bunker = new src_1.SimpleNIP46Bunker([relay.url], // Relays to listen on
        userKeypair.publicKey, // User's public key (for signing events)
        signerKeypair.publicKey // Signer's public key (for communication)
        );
        // Set private keys (these never leave the bunker)
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        await bunker.start();
        console.log('Bunker started');
        // Generate connection string (contains the SIGNER pubkey, not user pubkey)
        const connectionString = bunker.getConnectionString();
        console.log(`Connection string: ${connectionString}`);
        // ---- CLIENT SETUP ----
        const client = new src_1.SimpleNIP46Client([relay.url]);
        // Connect to bunker and get user's public key
        console.log('Connecting to bunker...');
        const pubkey = await client.connect(connectionString);
        console.log(`Connected and received user pubkey: ${pubkey.substring(0, 8)}...`);
        // ---- SIGN AN EVENT ----
        const event = {
            kind: 1,
            content: 'Hello, signed remotely via NIP-46!',
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        console.log('Sending event to be signed...');
        const signedEvent = await client.signEvent(event);
        console.log(`Event signed with pubkey: ${signedEvent.pubkey.substring(0, 8)}...`);
        // Verify signature
        const valid = await (0, src_1.verifySignature)(signedEvent.id, signedEvent.sig, signedEvent.pubkey);
        console.log(`Signature valid: ${valid}`);
        // Verify the event is signed with the USER's pubkey, not the SIGNER's pubkey
        console.log(`Event is signed with user pubkey: ${signedEvent.pubkey === userKeypair.publicKey}`);
        console.log(`Event is NOT signed with signer pubkey: ${signedEvent.pubkey !== signerKeypair.publicKey}`);
        // ---- CLEANUP ----
        await client.disconnect();
        await bunker.stop();
    }
    catch (error) {
        console.error('ERROR:', error.message);
    }
    finally {
        await relay.close();
        console.log('Relay closed');
    }
}
main().catch(console.error);
