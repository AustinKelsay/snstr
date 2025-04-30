// Increase default timeout for all tests in this file
jest.setTimeout(10000);

import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  LogLevel,
} from "../../src/nip46";
import { generateKeypair } from "../../src/utils/crypto";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

describe("NIP-46 Remote Signing", () => {
  let relay: NostrRelay;
  let client: SimpleNIP46Client;
  let bunker: SimpleNIP46Bunker;
  let userKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    // Start ephemeral relay with a different port
    relay = new NostrRelay(3333);
    await relay.start();

    // Generate test keypairs
    userKeypair = await generateKeypair();
    console.log("Test user keypair:", userKeypair.publicKey);
  }, 15000);

  beforeEach(async () => {
    // Create bunker instance with user key
    bunker = new SimpleNIP46Bunker(
      [relay.url],
      userKeypair.publicKey,
      undefined,
      {
        debug: true, // Enable debug mode
        logLevel: LogLevel.DEBUG,
      },
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(userKeypair.privateKey);

    // Set default permissions for all tests
    bunker.setDefaultPermissions([
      "sign_event",
      "nip04_encrypt",
      "nip04_decrypt",
    ]);

    await bunker.start();

    // Create client instance with longer timeout
    client = new SimpleNIP46Client([relay.url], {
      timeout: 3000,
      debug: true, // Enable debug mode
      logLevel: LogLevel.DEBUG,
    });
  }, 5000);

  afterAll(async () => {
    try {
      // First stop any active client and bunker
      if (client) {
        await client.disconnect().catch(() => {});
      }

      if (bunker) {
        await bunker.stop().catch(() => {});
      }

      // Then close the relay
      if (relay) {
        await relay.close().catch(() => {});
      }
    } catch (e) {
      console.error("Error in test cleanup:", e);
    }

    // Final delay to ensure everything is properly cleared
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 15000);

  afterEach(async () => {
    try {
      // Stop the bunker first
      if (bunker) {
        await bunker.stop().catch(() => {});
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    try {
      // Then disconnect the client
      if (client) {
        await client.disconnect().catch(() => {});
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    // Add a delay to ensure all connections are properly closed
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 5000);

  describe("Connection and Validation", () => {
    test("Basic connection and key retrieval", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const pubkey = await client.getPublicKey();
      expect(pubkey).toBe(userKeypair.publicKey);
    });
  });

  describe("Event Signing", () => {
    test("Basic event signing", async () => {
      const connectionString = bunker.getConnectionString();
      console.log("Connecting with:", connectionString);
      await client.connect(connectionString);

      try {
        const eventData = {
          kind: 1,
          content: "Hello from NIP-46 test!",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        };
        console.log("Sending event data:", JSON.stringify(eventData));

        const event = await client.signEvent(eventData);
        console.log("Received signed event:", JSON.stringify(event));

        expect(event).toBeDefined();
        expect(event.pubkey).toBe(userKeypair.publicKey);
        expect(event.content).toBe("Hello from NIP-46 test!");
      } catch (error) {
        console.error("Sign event error:", error);
        throw error;
      }
    });
  });

  describe("Encryption", () => {
    test("NIP-04 encryption and decryption", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      try {
        const thirdPartyPubkey = (await generateKeypair()).publicKey;
        const message = "Secret message for testing";
        console.log("Third party pubkey:", thirdPartyPubkey);
        console.log("Message to encrypt:", message);

        // Encrypt the message
        const encrypted = await client.nip04Encrypt(thirdPartyPubkey, message);
        console.log("Encrypted result:", encrypted);
        expect(encrypted).toBeTruthy();

        // Decrypt the message
        const decrypted = await client.nip04Decrypt(
          thirdPartyPubkey,
          encrypted,
        );
        console.log("Decrypted result:", decrypted);
        expect(decrypted).toBe(message);
      } catch (error) {
        console.error("Encryption error:", error);
        throw error;
      }
    });
  });

  describe("Utility Methods", () => {
    test("Ping works", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const response = await client.ping();
      expect(response).toBe(true);
    });
  });
});
