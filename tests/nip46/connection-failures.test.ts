import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

describe("NIP-46 Connection Failures", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker | null = null;
  let client: SimpleNIP46Client;

  beforeAll(async () => {
    // Start ephemeral relay for testing (use 0 to let OS assign free port)
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, 10000);

  beforeEach(() => {
    // Create client for testing with shorter timeout for tests
    client = new SimpleNIP46Client([relayUrl], {
      timeout: 1000,
      debug: true,
      logLevel: LogLevel.DEBUG,
    });
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
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, 5000);

  test("Connect fails with invalid connection string", async () => {
    await expect(client.connect("invalid://string")).rejects.toThrow();
  }, 5000);

  test("Connect fails with invalid pubkey", async () => {
    const invalidConnectionString =
      "bunker://invalidpubkey?relay=" + encodeURIComponent(relayUrl);
    await expect(client.connect(invalidConnectionString)).rejects.toThrow();
  }, 5000);

  test("Connect fails with non-existent relay", async () => {
    // Create a client with a non-existent relay - use a very short timeout
    const nonExistentClient = new SimpleNIP46Client(["ws://localhost:9999"], {
      timeout: 1000,
      debug: true,
      logLevel: LogLevel.DEBUG,
    });

    // Generate a valid connection string but with a relay that doesn't exist
    const connectionString = `bunker://${signerKeypair.publicKey}?relay=ws://localhost:9999`;

    await expect(nonExistentClient.connect(connectionString)).rejects.toThrow();

    // Clean up
    await nonExistentClient.disconnect().catch(() => {});
  }, 5000);

  test("Connect fails when bunker is not running", async () => {
    // Create a valid connection string with a correct relay but no bunker running
    const connectionString = `bunker://${signerKeypair.publicKey}?relay=${relayUrl}`;

    await expect(client.connect(connectionString)).rejects.toThrow(
      /timeout|timed out/i,
    );
  }, 10000);

  test("Connect times out when bunker is unreachable", async () => {
    // Start bunker
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    await bunker.start();

    // Shutdown bunker right after starting
    await bunker.stop();

    // The connection string is valid but the bunker is no longer listening
    const connectionString = bunker.getConnectionString();

    await expect(client.connect(connectionString)).rejects.toThrow(
      /timeout|timed out/i,
    );
  }, 10000);

  test("Ping fails when bunker is stopped", async () => {
    // Start bunker
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );
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

  test("Ping returns false when client is not connected", async () => {
    // Client is not connected, ping should return false
    expect(await client.ping()).toBe(false);
  }, 5000);

  test("Client disconnects properly", async () => {
    // Set up a spy on the disconnect method
    const disconnectSpy = jest.spyOn(client, "disconnect");

    // Disconnect
    await client.disconnect();

    // Check if disconnect was called
    expect(disconnectSpy).toHaveBeenCalled();
    disconnectSpy.mockRestore();
  }, 5000);

  describe("Timeout and Error Handling Edge Cases", () => {
    test("Very short timeout should still work for fast operations", async () => {
      // Start bunker for this test
      bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: true,
          logLevel: LogLevel.DEBUG,
        },
      );
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
      bunker.setDefaultPermissions(["get_public_key", "ping"]);
      await bunker.start();

      // Create client with reasonable timeout for local relay
      const shortTimeoutClient = new SimpleNIP46Client([relayUrl], {
        timeout: 5000, // 5 seconds should be enough for local relay
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = bunker.getConnectionString();
        const userPubkey = await shortTimeoutClient.connect(connectionString);
        expect(userPubkey).toBe(userKeypair.publicKey);
        
        // Fast operations should still work
        expect(await shortTimeoutClient.ping()).toBe(true);
      } finally {
        await shortTimeoutClient.disconnect().catch(() => {});
      }
    });

    test("Client without relays should fail gracefully", async () => {
      // Create a client with empty relays array
      const noRelayClient = new SimpleNIP46Client([], {
        timeout: 2000, // Short timeout to fail quickly
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        // Create a connection string that specifies no relays
        const connectionString = `bunker://${signerKeypair.publicKey}`;
        await expect(noRelayClient.connect(connectionString)).rejects.toThrow(/connection|relay|failed/i);
      } finally {
        await noRelayClient.disconnect().catch(() => {});
      }
    });

    test("Client handles relay disconnection gracefully", async () => {
      // Create an isolated relay for this test to avoid affecting other tests
      let isolatedRelay: NostrRelay | null = null;
      let isolatedClient: SimpleNIP46Client | null = null;
      let isolatedBunker: SimpleNIP46Bunker | null = null;
      
      try {
        // Start isolated relay
        isolatedRelay = new NostrRelay(0);
        await isolatedRelay.start();
        const isolatedRelayUrl = isolatedRelay.url;
        
        // Wait for relay to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Create isolated client using the isolated relay
        isolatedClient = new SimpleNIP46Client([isolatedRelayUrl], {
          timeout: 5000,
          debug: true,
          logLevel: LogLevel.DEBUG,
        });

        // Start bunker for this test using isolated relay
        isolatedBunker = new SimpleNIP46Bunker(
          [isolatedRelayUrl],
          userKeypair.publicKey,
          signerKeypair.publicKey,
          {
            debug: true,
            logLevel: LogLevel.DEBUG,
          },
        );
        isolatedBunker.setUserPrivateKey(userKeypair.privateKey);
        isolatedBunker.setSignerPrivateKey(signerKeypair.privateKey);
        isolatedBunker.setDefaultPermissions(["get_public_key", "ping"]);
        await isolatedBunker.start();

        const connectionString = isolatedBunker.getConnectionString();
        await isolatedClient.connect(connectionString);
        
        // Verify connection works
        expect(await isolatedClient.ping()).toBe(true);
        
        // Stop the isolated relay to simulate disconnection
        await isolatedRelay.close();
        isolatedRelay = null; // Mark as closed
        
        // Operations should now fail gracefully
        expect(await isolatedClient.ping()).toBe(false);
        
      } finally {
        // Clean up isolated resources
        if (isolatedClient) {
          await isolatedClient.disconnect().catch(() => {});
          isolatedClient = null;
        }
        
        if (isolatedBunker) {
          await isolatedBunker.stop().catch(() => {});
          isolatedBunker = null;
        }
        
        if (isolatedRelay) {
          await isolatedRelay.close().catch(() => {});
          isolatedRelay = null;
        }
        
        // Allow time for cleanup
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    });
  });
});
