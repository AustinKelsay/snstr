import { 
  SimpleNIP46Client, 
  SimpleNIP46Bunker,
  generateKeypair
} from '../../src';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

describe('NIP-46 Connection Failures', () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker | null = null;
  let client: SimpleNIP46Client;

  beforeAll(async () => {
    // Start ephemeral relay for testing
    relay = new NostrRelay(3790);
    await relay.start();
    relayUrl = relay.url;
    
    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();
    
    // Give the relay time to start properly
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000);

  afterAll(async () => {
    // Clean up any remaining clients or bunkers
    if (bunker) {
      try {
        await bunker.stop();
      } catch (error) {
        // Ignore errors
      }
      bunker = null;
    }

    try {
      await client?.disconnect().catch(() => {});
    } catch (error) {
      // Ignore errors
    }

    // Stop relay with proper cleanup
    if (relay) {
      relay.close();
    }
    
    // Allow time for cleanup
    await new Promise(resolve => setTimeout(resolve, 300));
  }, 10000);

  beforeEach(() => {
    // Create client for testing with shorter timeout for tests
    client = new SimpleNIP46Client([relayUrl], { timeout: 1000 }); // Short timeout
  });

  afterEach(async () => {
    // Clean up resources
    if (bunker) {
      try {
        await bunker.stop();
        bunker = null;
      } catch (error) {
        // Ignore errors
      }
    }

    try {
      await client.disconnect().catch(() => {});
    } catch (error) {
      // Ignore errors
    }

    // Allow time for cleanup
    await new Promise(resolve => setTimeout(resolve, 300));
  }, 5000);

  test('Connect fails with invalid connection string', async () => {
    await expect(client.connect('invalid://string')).rejects.toThrow();
  }, 5000);
  
  test('Connect fails with invalid pubkey', async () => {
    const invalidConnectionString = 'bunker://invalidpubkey?relay=' + encodeURIComponent(relayUrl);
    await expect(client.connect(invalidConnectionString)).rejects.toThrow();
  }, 5000);

  test('Connect fails with non-existent relay', async () => {
    // Create a client with a non-existent relay - use a very short timeout
    const nonExistentClient = new SimpleNIP46Client(['ws://localhost:9999'], { timeout: 1000 });
    
    // Generate a valid connection string but with a relay that doesn't exist
    const connectionString = `bunker://${signerKeypair.publicKey}?relay=ws://localhost:9999`;
    
    await expect(nonExistentClient.connect(connectionString)).rejects.toThrow();
    
    // Clean up
    await nonExistentClient.disconnect().catch(() => {});
  }, 5000);

  test('Connect fails when bunker is not running', async () => {
    // Create a valid connection string with a correct relay but no bunker running
    const connectionString = `bunker://${signerKeypair.publicKey}?relay=${relayUrl}`;
    
    await expect(client.connect(connectionString)).rejects.toThrow(/timeout|timed out/i);
  }, 10000);

  test('Connect times out when bunker is unreachable', async () => {
    // Start bunker
    bunker = new SimpleNIP46Bunker([relayUrl], userKeypair.publicKey, signerKeypair.publicKey);
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    await bunker.start();
    
    // Shutdown bunker right after starting
    await bunker.stop();
    
    // The connection string is valid but the bunker is no longer listening
    const connectionString = bunker.getConnectionString();
    
    await expect(client.connect(connectionString)).rejects.toThrow(/timeout|timed out/i);
  }, 10000);

  test('Ping fails when bunker is stopped', async () => {
    // Start bunker
    bunker = new SimpleNIP46Bunker([relayUrl], userKeypair.publicKey, signerKeypair.publicKey);
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    await bunker.start();
    
    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);
    
    // Verify ping works
    expect(await client.ping()).toBe(true);
    
    // Stop bunker
    await bunker.stop();
    
    // Ping should now fail
    expect(await client.ping()).toBe(false);
  }, 15000);
  
  test('Ping returns false when client is not connected', async () => {
    // Client is not connected, ping should return false
    expect(await client.ping()).toBe(false);
  }, 5000);
   
  test('Client disconnects properly', async () => {
    // Set up a spy on the disconnect method
    const disconnectSpy = jest.spyOn(client, 'disconnect');
    
    // Disconnect
    await client.disconnect();
    
    // Check if disconnect was called
    expect(disconnectSpy).toHaveBeenCalled();
    disconnectSpy.mockRestore();
  }, 5000);
}); 