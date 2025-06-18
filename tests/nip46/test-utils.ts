import { SimpleNIP46Client, SimpleNIP46Bunker, LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../src/utils/crypto";

export interface TestSetup {
  relay: NostrRelay;
  relayUrl: string;
  userKeypair: { publicKey: string; privateKey: string };
  signerKeypair: { publicKey: string; privateKey: string };
  client?: SimpleNIP46Client;
  bunker?: SimpleNIP46Bunker;
}

export class TestManager {
  private setups: TestSetup[] = [];
  private usedPorts: Set<number> = new Set();

  async createTestSetup(preferredPort?: number): Promise<TestSetup> {
    // Use port 0 for automatic port assignment to avoid conflicts
    const port = preferredPort && !this.usedPorts.has(preferredPort) ? preferredPort : 0;
    
    const relay = new NostrRelay(port);
    await relay.start();
    
    // Track the actual port being used
    const actualPort = relay.url.split(':').pop();
    if (actualPort) {
      this.usedPorts.add(parseInt(actualPort));
    }
    
    const setup: TestSetup = {
      relay,
      relayUrl: relay.url,
      userKeypair: await generateKeypair(),
      signerKeypair: await generateKeypair(),
    };

    this.setups.push(setup);
    return setup;
  }

  async createConnectedPair(setup: TestSetup): Promise<{
    client: SimpleNIP46Client;
    bunker: SimpleNIP46Bunker;
  }> {
    // Create bunker with correct constructor
    const bunker = new SimpleNIP46Bunker(
      [setup.relayUrl],
      setup.signerKeypair.publicKey,
      undefined,
      {
        logLevel: LogLevel.WARN, // Reduce log noise
      }
    );

    // Set both private keys
    bunker.setSignerPrivateKey(setup.signerKeypair.privateKey);
    bunker.setUserPrivateKey(setup.userKeypair.privateKey);

    // Create client with correct constructor
    const client = new SimpleNIP46Client(
      [setup.relayUrl],
      {
        logLevel: LogLevel.WARN, // Reduce log noise
      }
    );

    // Start bunker
    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Store for cleanup
    setup.client = client;
    setup.bunker = bunker;

    return { client, bunker };
  }

  async cleanup(): Promise<void> {
    // Clean up all setups in parallel
    await Promise.all(
      this.setups.map(async (setup) => {
        try {
          // Disconnect client first
          if (setup.client) {
            try {
              await setup.client.disconnect();
            } catch (e) {
              // Ignore disconnect errors during cleanup
            }
          }

          // Stop bunker
          if (setup.bunker) {
            try {
              await setup.bunker.stop();
            } catch (e) {
              // Ignore stop errors during cleanup
            }
          }

          // Stop relay
          if (setup.relay) {
            try {
              await setup.relay.close();
            } catch (e) {
              // Ignore relay stop errors during cleanup
            }
          }
        } catch (e) {
          // Ignore all cleanup errors
        }
      })
    );

    // Clear setups
    this.setups = [];

    // Give time for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Global test manager for automatic cleanup
export const globalTestManager = new TestManager();

// Setup global cleanup
if (typeof afterAll !== 'undefined') {
  afterAll(async () => {
    await globalTestManager.cleanup();
  });
} 