import { 
  NostrRemoteSignerClient, 
  NostrRemoteSignerBunker,
  generateKeypair,
  verifySignature
} from '../../src';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

async function main() {
  console.log('NIP-46 Remote Signing Example');
  console.log('-----------------------------');

  // Start an ephemeral relay for testing
  const relay = new NostrRelay(3333);
  await relay.start();
  console.log('Ephemeral relay started at:', relay.url);
  
  const relays = [relay.url];
  
  // Generate test keypairs
  console.log('\nGenerating keypairs...');
  const userKeypair = await generateKeypair();
  const signerKeypair = await generateKeypair(); // Different keypair for the signer

  console.log('User pubkey:', userKeypair.publicKey);
  console.log('Signer pubkey:', signerKeypair.publicKey);

  // Create and configure bunker
  console.log('\nConfiguring bunker...');
  const bunker = new NostrRemoteSignerBunker({
    relays,
    userPubkey: userKeypair.publicKey, // The pubkey that will sign events
    signerPubkey: signerKeypair.publicKey, // The pubkey used for communication
    defaultPermissions: ['sign_event:1', 'sign_event:4'],
    secret: 'test_secret',
    requireAuthChallenge: false
  });

  // Set the private keys
  bunker.setUserPrivateKey(userKeypair.privateKey); // Private key for signing events
  bunker.setSignerPrivateKey(signerKeypair.privateKey); // Private key for communication

  // Start bunker
  await bunker.start();
  console.log('Bunker started');

  // Publish bunker metadata
  console.log('\nPublishing bunker metadata...');
  const metadata = {
    name: 'Example Bunker',
    url: 'https://example.com',
    image: 'https://example.com/icon.png',
    relays,
    nostrconnect_url: 'https://example.com/connect'
  };

  const metadataEvent = await bunker.publishMetadata(metadata);
  if (metadataEvent) {
    console.log('Metadata published with id:', metadataEvent.id);
  }

  // Get connection string
  const connectionString = bunker.getConnectionString();
  console.log('\nConnection string:', connectionString);

  // Create client
  console.log('\nInitializing client...');
  const client = new NostrRemoteSignerClient({
    relays,
    permissions: ['sign_event:1', 'sign_event:4'],
    secret: 'test_secret',
    name: 'Example Client',
    url: 'https://client.example.com'
  });

  try {
    // Connect client to the bunker
    console.log('\nConnecting client to bunker...');
    await client.connect(connectionString);
    console.log('Client connected successfully');

    // Get user's public key from the bunker
    console.log('\nGetting user public key...');
    const pubkey = await client.getPublicKey();
    console.log('User pubkey received from bunker:', pubkey);
    console.log('Matches original user pubkey:', pubkey === userKeypair.publicKey);

    // Test ping
    console.log('\nSending ping to bunker...');
    const pong = await client.ping();
    console.log('Received response:', pong);

    // Sign a note
    console.log('\nSigning a text note...');
    const note = {
      kind: 1,
      content: 'Hello from NIP-46 remote signer!',
      created_at: Math.floor(Date.now() / 1000),
      tags: []
    };

    const signedNote = await client.signEvent(note);
    console.log('Signed note id:', signedNote.id);
    console.log('Signed note pubkey:', signedNote.pubkey);
    // Verify the signature using the user's public key
    console.log('Signature valid:', verifySignature(signedNote.id, signedNote.sig, signedNote.pubkey));

    // Sign an encrypted DM
    console.log('\nSigning an encrypted DM...');
    const recipient = await generateKeypair();
    console.log('Recipient pubkey:', recipient.publicKey);

    const dm = {
      kind: 4,
      content: 'This is a secret message',
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipient.publicKey]]
    };

    const signedDm = await client.signEvent(dm);
    console.log('Signed & encrypted DM id:', signedDm.id);
    // Verify the signature using the user's public key
    console.log('Signature valid:', verifySignature(signedDm.id, signedDm.sig, signedDm.pubkey));

    // Demonstrate NIP-04 encryption
    console.log('\nTesting NIP-04 encryption through bunker...');
    const plaintext = 'Hello, this is a test message!';
    const encrypted = await client.nip04Encrypt(recipient.publicKey, plaintext);
    console.log('Encrypted text:', encrypted);

    // Try an unauthorized operation (if your bunker implements permission checking)
    console.log('\nTrying to sign an unauthorized event...');
    try {
      const unauthorizedEvent = {
        kind: 30023, // Not in the allowed list
        content: 'This should fail',
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      };
      
      await client.signEvent(unauthorizedEvent);
      console.log('❌ Event was signed - permissions are not being enforced');
    } catch (error: any) {
      console.log('✅ Permission check working correctly:', error.message);
    }
  } catch (error: any) {
    console.error('Error in client operations:', error.message);
  } finally {
    // Clean up
    console.log('\nCleaning up...');
    await client.disconnect();
    await bunker.stop();
    await relay.close();
    console.log('Done!');
  }
}

main().catch(console.error); 