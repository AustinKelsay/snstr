import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerClient,
  generateKeypair,
  verifySignature,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  NIP46ConnectionError,
} from "../../src/nip46/types";

describe("NIP-46 Core Functionality", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker;
  let client: SimpleNIP46Client;
  const activeClients: NostrRemoteSignerClient[] = [];

  beforeAll(async () => {
    // Start ephemeral relay for testing
    relay = new NostrRelay(3792);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 10000);

  afterAll(async () => {
    // Clean up active clients
    for (const activeClient of activeClients) {
      try {
        await activeClient.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Clean up bunker and client
    if (bunker) {
      await bunker.stop().catch(() => {});
    }
    if (client) {
      await client.disconnect().catch(() => {});
    }
    if (relay) {
      await relay.close().catch(() => {});
    }

    // Add a small delay to ensure all connections are closed
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 15000);

  beforeEach(async () => {
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
      "nip04_encrypt",
      "nip04_decrypt",
    ]);

    await bunker.start();

    // Create client
    client = new SimpleNIP46Client([relayUrl], {
      timeout: 5000,
      debug: true,
      logLevel: LogLevel.DEBUG,
    });
  });

  afterEach(async () => {
    if (bunker) {
      await bunker.stop().catch(() => {});
    }
    if (client) {
      await client.disconnect().catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  describe("Client State Management", () => {
    test("Client throws error when not connected", async () => {
      // Try to call methods without connecting
      await expect(client.getPublicKey()).rejects.toThrow(
        NIP46ConnectionError,
      );
      await expect(client.signEvent({
        kind: 1,
        content: "test",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      })).rejects.toThrow(NIP46ConnectionError);
      await expect(client.nip04Encrypt("pubkey", "message")).rejects.toThrow(
        NIP46ConnectionError,
      );
    });

    test("Client connects and maintains state", async () => {
      const connectionString = bunker.getConnectionString();
      const userPubkey = await client.connect(connectionString);
      
      expect(userPubkey).toBe(userKeypair.publicKey);
      
      // Verify client is connected by calling a method
      const pubkey = await client.getPublicKey();
      expect(pubkey).toBe(userKeypair.publicKey);
    });

    test("Client handles disconnect properly", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      // Verify connection works
      expect(await client.getPublicKey()).toBe(userKeypair.publicKey);
      
      // Disconnect
      await client.disconnect();
      
      // Verify methods fail after disconnect
      await expect(client.getPublicKey()).rejects.toThrow();
    });
  });

  describe("Event Signing Edge Cases", () => {
    test("Sign event with various event kinds", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Test different event kinds
      const eventKinds = [0, 1, 3, 4, 7, 9735];
      
      for (const kind of eventKinds) {
        const eventData = {
          kind,
          content: `Test content for kind ${kind}`,
          created_at: Math.floor(Date.now() / 1000),
          tags: kind === 4 ? [["p", "recipient"]] : [],
        };
        
        const signedEvent = await client.signEvent(eventData);
        expect(signedEvent.kind).toBe(kind);
        expect(signedEvent.pubkey).toBe(userKeypair.publicKey);
        
        // Verify signature
        const valid = await verifySignature(
          signedEvent.id,
          signedEvent.sig,
          signedEvent.pubkey,
        );
        expect(valid).toBe(true);
      }
    });

    test("Sign event with complex tags", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const eventData = {
        kind: 1,
        content: "Event with complex tags",
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", "eventid", "relay", "root"],
          ["p", "pubkey", "relay", "mention"],
          ["t", "hashtag"],
          ["r", "https://example.com"],
          ["custom", "value1", "value2"],
        ],
      };

      const signedEvent = await client.signEvent(eventData);
      expect(signedEvent.tags).toEqual(eventData.tags);
    });

    test("Handle malformed event data", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Missing required fields
      await expect(client.signEvent({
        kind: 1,
        // Missing content
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      } as unknown as Parameters<typeof client.signEvent>[0])).rejects.toThrow();
    });
  });

  describe("Encryption Operations", () => {
    test("NIP-04 encrypt/decrypt round trip", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const recipientKeys = await generateKeypair();
      const message = "This is a test message with special chars: 🤖 @#$%";

      const encrypted = await client.nip04Encrypt(recipientKeys.publicKey, message);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(message);

      const decrypted = await client.nip04Decrypt(recipientKeys.publicKey, encrypted);
      expect(decrypted).toBe(message);
    });

    test("NIP-04 encrypt with empty message", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const recipientKeys = await generateKeypair();
      const message = "";

      const encrypted = await client.nip04Encrypt(recipientKeys.publicKey, message);
      expect(encrypted).toBeTruthy();
      
      const decrypted = await client.nip04Decrypt(recipientKeys.publicKey, encrypted);
      expect(decrypted).toBe(message);
    });

    test("NIP-04 decrypt with invalid ciphertext", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const recipientKeys = await generateKeypair();
      
      await expect(
        client.nip04Decrypt(recipientKeys.publicKey, "invalid_ciphertext")
      ).rejects.toThrow();
    });
  });

  describe("Ping and Connectivity", () => {
    test("Ping returns true when connected", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const result = await client.ping();
      expect(result).toBe(true);
    });

    test("Ping returns false when not connected", async () => {
      const result = await client.ping();
      expect(result).toBe(false);
    });

    test("Multiple pings work correctly", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Send multiple pings
      const results = await Promise.all([
        client.ping(),
        client.ping(),
        client.ping(),
      ]);

      expect(results).toEqual([true, true, true]);
    });
  });

  describe("Bunker Permission Management", () => {
    test("Get connection string format", async () => {
      const connectionString = bunker.getConnectionString();
      
      expect(connectionString).toMatch(/^bunker:\/\/[a-f0-9]{64}\?/);
      expect(connectionString).toContain(`relay=${encodeURIComponent(relayUrl)}`);
    });
    
    test("Default permissions are set correctly", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      // Verify that default permissions allow the expected operations
      expect(await client.getPublicKey()).toBe(userKeypair.publicKey);
      expect(await client.ping()).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("Connection with invalid bunker pubkey", async () => {
      const invalidConnectionString = `bunker://invalid?relay=${encodeURIComponent(relayUrl)}`;
      
      await expect(client.connect(invalidConnectionString)).rejects.toThrow();
    });

    test("Timeout handling", async () => {
      // Create client with very short timeout
      const shortTimeoutClient = new SimpleNIP46Client([relayUrl], {
        timeout: 100, // 100ms timeout
        debug: true,
        logLevel: LogLevel.DEBUG,
      });

      // Stop the bunker to simulate no response
      await bunker.stop();

      const connectionString = `bunker://${signerKeypair.publicKey}?relay=${encodeURIComponent(relayUrl)}`;
      
      await expect(shortTimeoutClient.connect(connectionString)).rejects.toThrow(
        /Request timed out/i
      );

      await shortTimeoutClient.disconnect().catch(() => {});
    });
  });
}); 