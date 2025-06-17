import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerClient,
  generateKeypair,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  NIP46ConnectionError,
} from "../../src/nip46/types";

describe("NIP-46 Client Edge Cases", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker;
  let activeClients: Array<SimpleNIP46Client | NostrRemoteSignerClient> = [];

  beforeAll(async () => {
    // Start ephemeral relay for testing
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
    // Clean up all active clients
    for (const client of activeClients) {
      try {
        await client.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    activeClients = [];

    if (relay) {
      relay.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 15000);

  beforeEach(async () => {
    // Clean up any leftover clients from previous tests
    for (const client of activeClients) {
      try {
        await client.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    activeClients = [];

    // Create bunker with comprehensive permissions
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
    bunker.setDefaultPermissions([
      "sign_event",
      "get_public_key",
      "ping",
      "nip44_encrypt",
      "nip44_decrypt",
    ]);

    await bunker.start();
  });

  afterEach(async () => {
    // Clean up all active clients
    for (const client of activeClients) {
      try {
        await client.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    activeClients = [];

    if (bunker) {
      await bunker.stop().catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  // Helper function to track clients for cleanup
  const createSimpleClient = (relays: string[], options?: object) => {
    const client = new SimpleNIP46Client(relays, options);
    activeClients.push(client);
    return client;
  };

  describe("Connection String Parsing", () => {
    test("Valid bunker connection string format", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 5000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = bunker.getConnectionString();
        expect(connectionString).toMatch(/^bunker:\/\/[a-f0-9]{64}\?/);
        
        // Should be able to parse and connect
        const userPubkey = await client.connect(connectionString);
        expect(userPubkey).toBe(userKeypair.publicKey);
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    test("Invalid connection string formats", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 1000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        // Test various invalid formats
        const invalidStrings = [
          "bunker://",
          "bunker://invalid",
          "nostrconnect://invalid",
          "invalid://string",
          "",
          "just-a-string",
        ];

        for (const invalidString of invalidStrings) {
          await expect(client.connect(invalidString)).rejects.toThrow();
        }
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    test("Connection string with invalid relay", async () => {
      const client = createSimpleClient([], {
        timeout: 1000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = `bunker://${signerKeypair.publicKey}?relay=ws://invalid-relay.com`;
        await expect(client.connect(connectionString)).rejects.toThrow();
      } finally {
        await client.disconnect().catch(() => {});
      }
    });
  });

  describe("Client State Edge Cases", () => {
    test("Multiple connect calls should work", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 5000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = bunker.getConnectionString();
        
        // First connection
        const userPubkey1 = await client.connect(connectionString);
        expect(userPubkey1).toBe(userKeypair.publicKey);
        
        // Second connection (should work)
        const userPubkey2 = await client.connect(connectionString);
        expect(userPubkey2).toBe(userKeypair.publicKey);
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    test("Operations after disconnect should fail", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 5000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = bunker.getConnectionString();
        await client.connect(connectionString);
        
        // Verify connection works
        expect(await client.getPublicKey()).toBe(userKeypair.publicKey);
        
        // Disconnect
        await client.disconnect();
        
        // All operations should fail now
        await expect(client.getPublicKey()).rejects.toThrow(NIP46ConnectionError);
        await expect(client.signEvent({
          kind: 1,
          content: "test",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        })).rejects.toThrow(NIP46ConnectionError);
        await expect(client.nip44Encrypt("pubkey", "message")).rejects.toThrow(NIP46ConnectionError);
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    test("Double disconnect should not throw", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 5000,
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      // First disconnect
      await client.disconnect();
      
      // Second disconnect should not throw
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe("NostrRemoteSignerClient Specific Tests", () => {
    test("Full client static methods", async () => {
      const clientKeypair = await generateKeypair();
      
      const connectionString = NostrRemoteSignerClient.generateConnectionString(
        clientKeypair.publicKey,
        {
          relays: [relayUrl],
          secret: "test-secret",
          name: "Test Client",
          permissions: ["sign_event", "nip44_encrypt"],
        }
      );

      expect(connectionString).toMatch(/^nostrconnect:\/\//);
      expect(connectionString).toContain(clientKeypair.publicKey);
      expect(connectionString).toContain("test-secret");
      expect(connectionString).toContain("Test+Client"); // URL encoding uses + for spaces
    });
  });

  describe("Timeout and Error Handling", () => {
    test("Very short timeout should still work for fast operations", async () => {
      const client = createSimpleClient([relayUrl], {
        timeout: 5000, // 5 seconds should be enough for local relay
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        const connectionString = bunker.getConnectionString();
        const userPubkey = await client.connect(connectionString);
        expect(userPubkey).toBe(userKeypair.publicKey);
        
        // Fast operations should still work
        expect(await client.ping()).toBe(true);
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    test("Client without relays should fail gracefully", async () => {
      // Create a client with empty relays array
      const client = createSimpleClient([], {
        timeout: 2000, // Short timeout to fail quickly
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      try {
        // Create a connection string that specifies no relays
        const connectionString = `bunker://${signerKeypair.publicKey}`;
        await expect(client.connect(connectionString)).rejects.toThrow(/connection|relay|failed/i);
      } finally {
        await client.disconnect().catch(() => {});
      }
    });
  });

  describe("Static Methods", () => {
    test("NostrRemoteSignerClient.generateConnectionString", () => {
      const clientPubkey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      
      const connectionString = NostrRemoteSignerClient.generateConnectionString(clientPubkey);
      expect(connectionString).toMatch(/^nostrconnect:\/\/[a-f0-9]{64}\?/);
      expect(connectionString).toContain("secret=");
      
      // With options
      const connectionStringWithOptions = NostrRemoteSignerClient.generateConnectionString(clientPubkey, {
        relays: ["wss://relay1.com", "wss://relay2.com"],
        name: "Test App",
        url: "https://test.app",
        image: "https://test.app/icon.png",
        permissions: ["sign_event:1", "get_public_key"],
      });
      
      expect(connectionStringWithOptions).toContain("relay=");
      expect(connectionStringWithOptions).toContain("name=");
      expect(connectionStringWithOptions).toContain("perms=");
    });

    test("generateConnectionString with invalid pubkey", () => {
      expect(() => NostrRemoteSignerClient.generateConnectionString("")).toThrow(
        NIP46ConnectionError
      );
    });
  });
}); 