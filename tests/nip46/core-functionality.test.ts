import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerClient,
  NostrRemoteSignerBunker,
  generateKeypair,
  verifySignature,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { invokeNip46BunkerConnect, NostrRelay } from "../../src/testing";
import {
  NIP46ConnectionError,
  NIP46Method,
} from "../../src/nip46/types";
import { validateSecureInitialization } from "../../src/nip46/utils/security";

jest.setTimeout(60000); // 60 second timeout for NIP-46 operations to handle full test suite load

describe("NIP-46 Core Functionality (Optimized)", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker;
  let client: SimpleNIP46Client;
  const activeClients: NostrRemoteSignerClient[] = [];

  beforeAll(async () => {
    // Start ephemeral relay for testing
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs once for all tests
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Longer relay startup delay for full test suite stability
    await new Promise((resolve) => setTimeout(resolve, 100).unref());
  }, 15000);

  afterAll(async () => {
    // Clean up active clients in parallel
    await Promise.all(
      activeClients.map(async (activeClient) => {
        try {
          await activeClient.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }),
    );

    // Clean up bunker and client in parallel
    await Promise.all([
      bunker?.stop().catch(() => {}),
      client?.disconnect().catch(() => {}),
    ]);

    if (relay) {
      await relay.close().catch(() => {});
    }

    // Longer cleanup delay for full test suite stability
    await new Promise((resolve) => setTimeout(resolve, 50).unref());
  }, 15000);

  beforeEach(async () => {
    // Create bunker with minimal logging for performance
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: false,
        logLevel: LogLevel.ERROR,
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
      "nip04_encrypt",
      "nip04_decrypt",
    ]);

    await bunker.start();

    // Create client with minimal logging and slightly relaxed timeout for CI variance
    client = new SimpleNIP46Client([relayUrl], {
      timeout: 2500,
      debug: false,
      logLevel: LogLevel.ERROR,
    });
  });

  afterEach(async () => {
    // Fast parallel cleanup
    await Promise.all([
      client?.disconnect().catch(() => {}),
      bunker?.stop().catch(() => {}),
    ]);

    // Minimal cleanup delay
    await new Promise((resolve) => setTimeout(resolve, 10).unref());
  });

  describe("Essential Core Tests", () => {
    test("Complete client lifecycle: connect, operations, disconnect", async () => {
      // Test connection
      const connectionString = bunker.getConnectionString();
      const userPubkey = await client.connect(connectionString);
      expect(userPubkey).toBe(userKeypair.publicKey);

      // Test basic operations
      expect(await client.getPublicKey()).toBe(userKeypair.publicKey);
      expect(await client.ping()).toBe(true);

      // Test event signing with multiple kinds
      const eventKinds = [0, 1, 4];
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

        // Verify signature for one event to save time
        if (kind === 1) {
          const valid = await verifySignature(
            signedEvent.id,
            signedEvent.sig,
            signedEvent.pubkey,
          );
          expect(valid).toBe(true);
        }
      }

      // Test disconnect
      await client.disconnect();

      // Verify operations fail after disconnect
      await expect(client.getPublicKey()).rejects.toThrow(NIP46ConnectionError);
      await expect(client.ping()).resolves.toBe(false);
    });

    test("NIP-44 and NIP-04 encryption support", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const recipientKeys = await generateKeypair();
      const message = "Test encryption message";

      // Test NIP-44 (preferred)
      const nip44Encrypted = await client.nip44Encrypt(
        recipientKeys.publicKey,
        message,
      );
      expect(nip44Encrypted).toBeTruthy();
      expect(nip44Encrypted).not.toBe(message);

      const nip44Decrypted = await client.nip44Decrypt(
        recipientKeys.publicKey,
        nip44Encrypted,
      );
      expect(nip44Decrypted).toBe(message);

      const nip04Encrypted = await client.nip04Encrypt(
        recipientKeys.publicKey,
        message,
      );
      expect(nip04Encrypted).toBeTruthy();
      expect(nip04Encrypted).not.toBe(message);
      expect(nip04Encrypted).not.toBe(nip44Encrypted); // Different encryption methods

      const nip04Decrypted = await client.nip04Decrypt(
        recipientKeys.publicKey,
        nip04Encrypted,
      );
      expect(nip04Decrypted).toBe(message);

      // Test edge cases
      await expect(
        client.nip44Encrypt(recipientKeys.publicKey, ""),
      ).rejects.toThrow();
      await expect(
        client.nip04Encrypt(recipientKeys.publicKey, ""),
      ).rejects.toThrow();
    });

    test("Error handling and edge cases", async () => {
      // Test operations without connection
      await expect(client.getPublicKey()).rejects.toThrow(NIP46ConnectionError);
      await expect(
        client.signEvent({
          kind: 1,
          content: "test",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        }),
      ).rejects.toThrow(NIP46ConnectionError);

      // Test invalid connection strings
      await expect(client.connect("invalid://string")).rejects.toThrow();
      await expect(
        client.connect(
          `bunker://invalid?relay=${encodeURIComponent(relayUrl)}`,
        ),
      ).rejects.toThrow();

      // Test malformed event data after connecting
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      await expect(
        client.signEvent({
          kind: 1,
          // Missing content
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        } as unknown as Parameters<typeof client.signEvent>[0]),
      ).rejects.toThrow();

      // Test multiple connect calls work
      const userPubkey2 = await client.connect(connectionString);
      expect(userPubkey2).toBe(userKeypair.publicKey);

      // Test double disconnect doesn't throw
      await client.disconnect();
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    test("Complex event tags and bunker permissions", async () => {
      // Create a fresh client with longer timeout for this test
      const testClient = new SimpleNIP46Client([relayUrl], {
        timeout: 10000, // Increase timeout to handle test suite load
        logLevel: LogLevel.ERROR,
      });

      try {
        const connectionString = bunker.getConnectionString();
        await testClient.connect(connectionString);

        // Test event with complex tags
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

        const signedEvent = await testClient.signEvent(eventData);
        expect(signedEvent.tags).toEqual(eventData.tags);

        // Test bunker connection string format
        expect(connectionString).toMatch(/^bunker:\/\/[a-f0-9]{64}\?/);
        expect(connectionString).toContain(
          `relay=${encodeURIComponent(relayUrl)}`,
        );

        // Test multiple pings work
        const results = await Promise.all([
          testClient.ping(),
          testClient.ping(),
          testClient.ping(),
        ]);
        expect(results).toEqual([true, true, true]);
      } finally {
        await testClient.disconnect().catch(() => {});
      }
    });
  });

  describe("Advanced Features", () => {
    test("NostrRemoteSignerClient integration", async () => {
      const fullClient = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 2000,
        debug: false,
      });
      activeClients.push(fullClient);

      try {
        const connectionString = bunker.getConnectionString();
        await fullClient.connect(connectionString);

        // Test core operations
        const userPubkey = await fullClient.getUserPublicKey();
        expect(userPubkey).toBe(userKeypair.publicKey);

        const pingResult = await fullClient.ping();
        expect(pingResult).toBe("pong");

        // Test event signing
        const event = await fullClient.signEvent({
          kind: 1,
          content: "Test from full client",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        });
        expect(event.kind).toBe(1);
        expect(event.pubkey).toBe(userKeypair.publicKey);

        // Test disconnect cleanup
        await fullClient.disconnect();

        await expect(fullClient.ping()).rejects.toThrow(NIP46ConnectionError);
      } finally {
        await fullClient.disconnect().catch(() => {});
      }
    });

    test("Static methods and connection strings", async () => {
      const clientKeypair = await generateKeypair();

      // Test generateConnectionString
      const connectionString = NostrRemoteSignerClient.generateConnectionString(
        clientKeypair.publicKey,
        {
          relays: [relayUrl],
          secret: "test-secret",
          name: "Test Client",
          permissions: ["sign_event", "nip44_encrypt"],
        },
      );

      expect(connectionString).toMatch(/^nostrconnect:\/\//);
      expect(connectionString).toContain(clientKeypair.publicKey);
      expect(connectionString).toContain("test-secret");

      // Test invalid pubkey throws
      expect(() =>
        NostrRemoteSignerClient.generateConnectionString(""),
      ).toThrow(NIP46ConnectionError);

      // Test timeout handling
      const shortTimeoutClient = new SimpleNIP46Client([relayUrl], {
        timeout: 50, // Very short timeout
        debug: false,
        logLevel: LogLevel.ERROR,
      });

      await bunker.stop(); // Stop bunker to cause timeout

      await expect(
        shortTimeoutClient.connect(bunker.getConnectionString()),
      ).rejects.toThrow(/Request timed out/i);
      await shortTimeoutClient.disconnect().catch(() => {});
    });

    test("Race condition and cleanup fixes", async () => {
      const testClient = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 10000, // Increase timeout to handle test suite load
        debug: false,
      });
      activeClients.push(testClient);

      try {
        const connectionString = bunker.getConnectionString();
        await testClient.connect(connectionString);

        // Test multiple operations
        const requests = [
          testClient.ping(),
          testClient.ping(),
          testClient.ping(),
        ];
        await Promise.all(requests);

        // Disconnect immediately
        await testClient.disconnect();

        // New requests should be rejected
        await expect(testClient.ping()).rejects.toThrow(NIP46ConnectionError);

        // Multiple disconnects should be safe
        await testClient.disconnect();
        await testClient.disconnect();
      } finally {
        await testClient.disconnect().catch(() => {});
      }
    });
  });

  describe("Spec Compliance and Security", () => {
    test("NIP-46 spec compliance", async () => {
      const testUserKeypair = await generateKeypair();
      const testSignerKeypair = await generateKeypair();

      const testBunker = new NostrRemoteSignerBunker({
        userPubkey: testUserKeypair.publicKey,
        signerPubkey: testSignerKeypair.publicKey,
        relays: [relayUrl],
      });

      testBunker.setPrivateKeys(
        testUserKeypair.privateKey,
        testSignerKeypair.privateKey,
      );

      const connectionString = testBunker.getConnectionString();

      // connect() should return "ack", not the user pubkey (spec compliance)
      expect(connectionString).not.toContain(testUserKeypair.publicKey);
      expect(connectionString).toContain(testSignerKeypair.publicKey);

      // Test validation
      expect(() => {
        validateSecureInitialization({
          userKeypair: testUserKeypair,
          signerKeypair: testSignerKeypair,
        });
      }).not.toThrow();

      await testBunker.stop().catch(() => {});
    });

    test("Authentication challenge system", async () => {
      const testUserKeypair = await generateKeypair();
      const testSignerKeypair = await generateKeypair();

      const authBunker = new NostrRemoteSignerBunker({
        relays: [relayUrl],
        userPubkey: testUserKeypair.publicKey,
        signerPubkey: testSignerKeypair.publicKey,
        requireAuthChallenge: true,
        authUrl: "https://example.com/auth",
        authTimeout: 2000,
        debug: false,
      });

      authBunker.setUserPrivateKey(testUserKeypair.privateKey);
      authBunker.setSignerPrivateKey(testSignerKeypair.privateKey);

      try {
        // Test challenge resolution
        const resolved = authBunker.resolveAuthChallenge(
          testUserKeypair.publicKey,
        );
        expect(typeof resolved).toBe("boolean");

        // Test auth challenge format
        const connectRequest = {
          id: "test-connect-id",
          method: NIP46Method.CONNECT,
          params: [
            testSignerKeypair.publicKey,
            "",
            "sign_event:1,get_public_key",
          ],
        };

        const response = await invokeNip46BunkerConnect(
          authBunker,
          connectRequest,
          testUserKeypair.publicKey,
        );
        expect(response.id).toBe("test-connect-id");
        expect(response.auth_url).toContain("https://example.com/auth");
      } finally {
        await authBunker.stop().catch(() => {});
      }
    });

    test("Unit test coverage for core classes", async () => {
      const testUserKeypair = await generateKeypair();
      const testSignerKeypair = await generateKeypair();

      // Test NostrRemoteSignerBunker unit methods
      const unitBunker = new NostrRemoteSignerBunker({
        userPubkey: testUserKeypair.publicKey,
        signerPubkey: testSignerKeypair.publicKey,
        relays: [relayUrl],
        debug: false,
      });

      unitBunker.setUserPrivateKey(testUserKeypair.privateKey);
      unitBunker.setSignerPrivateKey(testSignerKeypair.privateKey);

      expect(unitBunker).toBeDefined();
      expect(unitBunker.getConnectionString()).toContain("bunker://");
      expect(unitBunker.getSignerPubkey()).toBe(testSignerKeypair.publicKey);

      // Test permission handlers
      expect(() => unitBunker.setPermissionHandler(() => true)).not.toThrow();
      expect(() => unitBunker.clearPermissionHandler()).not.toThrow();

      // Test NostrRemoteSignerClient unit methods
      const unitClient = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 2000,
        debug: false,
      });
      activeClients.push(unitClient);

      expect(unitClient).toBeDefined();

      // Test methods throw when not connected
      await expect(unitClient.getPublicKey()).rejects.toThrow(
        NIP46ConnectionError,
      );
      await expect(unitClient.ping()).rejects.toThrow(NIP46ConnectionError);

      // Test disconnect when not connected
      await expect(unitClient.disconnect()).resolves.toBeUndefined();

      // Test generateConnectionString
      const connStr = NostrRemoteSignerClient.generateConnectionString(
        testUserKeypair.publicKey,
        {
          relays: [relayUrl],
          secret: "test",
        },
      );
      expect(connStr).toContain("nostrconnect://");

      await unitClient.disconnect().catch(() => {});
      await unitBunker.stop().catch(() => {});
    });
  });
});
