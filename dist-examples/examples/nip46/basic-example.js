"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../src");
const ephemeral_relay_1 = require("../../src/utils/ephemeral-relay");
async function main() {
    console.log('NIP-46 Basic Remote Signing Example');
    console.log('----------------------------------');
    // Start an ephemeral relay for testing
    const relay = new ephemeral_relay_1.NostrRelay(3333);
    await relay.start();
    console.log('Started ephemeral relay at:', relay.url);
    const relays = [relay.url];
    try {
        // Generate keypairs
        console.log('\nGenerating keypairs...');
        const userKeypair = await (0, src_1.generateKeypair)();
        const signerKeypair = await (0, src_1.generateKeypair)(); // Different keypair for the signer
        console.log('User pubkey:', userKeypair.publicKey);
        console.log('Signer pubkey:', signerKeypair.publicKey);
        // Create bunker
        console.log('\nStarting bunker...');
        const bunker = new src_1.SimpleNIP46Bunker(relays, userKeypair.publicKey, signerKeypair.publicKey);
        // Set private keys (these never leave the bunker)
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        // Start the bunker
        await bunker.start();
        // Get connection string
        const connectionString = bunker.getConnectionString();
        console.log('Connection string:', connectionString);
        // Create client
        console.log('\nInitializing client...');
        const client = new src_1.SimpleNIP46Client(relays, { timeout: 30000 });
        // Connect client to bunker
        console.log('Connecting to bunker...');
        const pubkey = await client.connect(connectionString);
        console.log('Client connected successfully');
        console.log('Public key from bunker:', pubkey);
        console.log('Matches original user pubkey:', pubkey === userKeypair.publicKey);
        // Test ping command
        console.log('\nPinging bunker...');
        const pong = await client.ping();
        console.log('Ping response:', pong);
        // Create and sign a note
        console.log('\nSigning a text note...');
        const noteData = {
            kind: 1,
            content: 'Hello from NIP-46 remote signer!',
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        // Sign the note remotely using the bunker
        const signedNote = await client.signEvent(noteData);
        console.log('Signed note ID:', signedNote.id);
        console.log('Signed with pubkey:', signedNote.pubkey);
        console.log('Signature:', signedNote.sig.substring(0, 20) + '...');
        // Verify the signature is valid
        const validSig = (0, src_1.verifySignature)(signedNote.id, signedNote.sig, signedNote.pubkey);
        console.log('Signature valid:', validSig);
        // Clean up
        await client.disconnect();
        await bunker.stop();
    }
    catch (error) {
        console.error('Error:', error.message);
    }
    finally {
        // Clean up
        if (relay) {
            await relay.close();
            console.log('\nCleaned up ephemeral relay');
        }
    }
}
main().catch(console.error);
