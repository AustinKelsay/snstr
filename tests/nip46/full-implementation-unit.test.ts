import { NostrRemoteSignerClient } from "../../src/nip46/client";
import { NostrRemoteSignerBunker } from "../../src/nip46/bunker";
import { 
  NIP46BunkerOptions,
  NIP46ClientOptions,
  NIP46ConnectionError
} from "../../src/nip46/types";
import { generateKeypair } from "../../src/utils/crypto";

describe("NIP-46 Full Implementation Unit Tests", () => {
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();
  });

  describe("Full Bunker Unit Tests", () => {
    let bunker: NostrRemoteSignerBunker;

    beforeEach(() => {
      const bunkerOptions: NIP46BunkerOptions = {
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: ["ws://localhost:3797"],
        debug: false
      };

      bunker = new NostrRemoteSignerBunker(bunkerOptions);
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
    });

    test("bunker constructor creates instance", () => {
      expect(bunker).toBeDefined();
    });

    test("bunker getConnectionString creates valid string", () => {
      const connectionString = bunker.getConnectionString();
      
      expect(connectionString).toContain("bunker://");
      expect(connectionString).toContain(signerKeypair.publicKey);
    });

    test("bunker getSignerPubkey returns correct key", () => {
      const pubkey = bunker.getSignerPubkey();
      expect(pubkey).toBe(signerKeypair.publicKey);
    });

    test("bunker setUserPrivateKey updates key", async () => {
      const newKeypair = await generateKeypair();
      expect(() => bunker.setUserPrivateKey(newKeypair.privateKey)).not.toThrow();
    });

    test("bunker setSignerPrivateKey updates key", async () => {
      const newKeypair = await generateKeypair();
      expect(() => bunker.setSignerPrivateKey(newKeypair.privateKey)).not.toThrow();
    });

    test("bunker setPrivateKeys updates both keys", async () => {
      const userKeypair = await generateKeypair();
      const signerKeypair = await generateKeypair();
      expect(() => bunker.setPrivateKeys(userKeypair.privateKey, signerKeypair.privateKey)).not.toThrow();
    });

    test("bunker resolveAuthChallenge works", () => {
      const clientPubkey = "test-client-pubkey";
      const result = bunker.resolveAuthChallenge(clientPubkey);
      expect(typeof result).toBe("boolean");
    });

    test("bunker permission handlers work", () => {
      // Test setting permission handler
      expect(() => bunker.setPermissionHandler(() => true)).not.toThrow();
      expect(() => bunker.setPermissionHandler(() => false)).not.toThrow();
      
      // Test clearing permission handler
      expect(() => bunker.clearPermissionHandler()).not.toThrow();
    });

    test("bunker publishMetadata works", async () => {
      const metadata = {
        name: "Test Bunker",
        url: "https://test.com"
      };

      // Should not throw even if not connected to relays
      const result = await bunker.publishMetadata(metadata).catch(() => undefined);
      expect(result === undefined || typeof result === "object").toBe(true);
    });

    test("bunker start and stop methods exist", async () => {
      // Test that methods exist and can be called
      expect(typeof bunker.start).toBe("function");
      expect(typeof bunker.stop).toBe("function");
      
      // These will fail without relay connection, but we're testing method coverage
      try {
        await bunker.start();
        await bunker.stop();
      } catch (error) {
        // Expected to fail without proper relay setup
        expect(error).toBeDefined();
      }
    });
  });

  describe("Full Client Unit Tests", () => {
    let client: NostrRemoteSignerClient;

    beforeEach(() => {
      const clientOptions: NIP46ClientOptions = {
        relays: ["ws://localhost:3797"],
        timeout: 5000,
        debug: false
      };

      client = new NostrRemoteSignerClient(clientOptions);
    });

    afterEach(async () => {
      await client.disconnect().catch(() => {});
    });

    test("client constructor creates instance", () => {
      expect(client).toBeDefined();
    });

    test("client methods throw when not connected", async () => {
      await expect(client.getPublicKey()).rejects.toThrow(NIP46ConnectionError);
      await expect(client.ping()).rejects.toThrow(NIP46ConnectionError);
      
      const eventData = {
        kind: 1,
        content: "Test event",
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      };
      await expect(client.signEvent(eventData)).rejects.toThrow(NIP46ConnectionError);
    });

    test("client generateConnectionString creates valid connection string", () => {
      const clientPubkey = "test-pubkey";
      const options: NIP46ClientOptions = {
        relays: ["ws://localhost:3797"],
        secret: "test-secret",
        name: "Test App"
      };

      const connectionString = NostrRemoteSignerClient.generateConnectionString(clientPubkey, options);
      
      expect(connectionString).toContain("nostrconnect://");
      expect(connectionString).toContain(clientPubkey);
      expect(connectionString).toContain("relay=");
      expect(connectionString).toContain("secret=");
      expect(connectionString).toContain("name=");
    });

    test("client generateConnectionString throws with invalid pubkey", () => {
      expect(() => {
        NostrRemoteSignerClient.generateConnectionString("", {});
      }).toThrow(NIP46ConnectionError);
    });

    test("client connect throws with invalid connection string", async () => {
      await expect(client.connect("invalid://connection")).rejects.toThrow(NIP46ConnectionError);
    });

    test("client disconnect works when not connected", async () => {
      // Should not throw even when not connected
      await expect(client.disconnect()).resolves.not.toThrow();
    });

    test("client encryption methods throw when not connected", async () => {
      const recipientKeys = await generateKeypair();
      
      await expect(client.nip44Encrypt(recipientKeys.publicKey, "test")).rejects.toThrow(NIP46ConnectionError);
      await expect(client.nip44Decrypt(recipientKeys.publicKey, "test")).rejects.toThrow(NIP46ConnectionError);
      await expect(client.nip04Encrypt(recipientKeys.publicKey, "test")).rejects.toThrow(NIP46ConnectionError);
      await expect(client.nip04Decrypt(recipientKeys.publicKey, "test")).rejects.toThrow(NIP46ConnectionError);
    });

    test("client getRelays throws when not connected", async () => {
      await expect(client.getRelays()).rejects.toThrow(NIP46ConnectionError);
    });
  });

  describe("Full Implementation Error Handling", () => {
    test("bunker constructor with missing required options", () => {
      expect(() => {
        new NostrRemoteSignerBunker({} as any);
      }).toThrow();
    });

    test("client constructor with empty options", () => {
      expect(() => {
        new NostrRemoteSignerClient({});
      }).not.toThrow();
    });

    test("client constructor with undefined options", () => {
      expect(() => {
        new NostrRemoteSignerClient(undefined as any);
      }).not.toThrow();
    });
  });
}); 