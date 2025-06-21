import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerBunker,
  generateKeypair,
  verifySignature,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

describe("NIP-46 Permission Handling", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: SimpleNIP46Bunker;
  let client: SimpleNIP46Client;

  beforeEach(async () => {
    // Start ephemeral relay for testing (use 0 to let OS assign free port)
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Create client
    client = new SimpleNIP46Client([relayUrl], {
      debug: true,
      logLevel: LogLevel.DEBUG,
    });

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 10000);

  afterEach(async () => {
    // Stop bunker and relay with timeouts
    if (bunker) {
      try {
        await Promise.race([
          bunker.stop(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Bunker stop timeout")), 2000),
          ),
        ]);
      } catch (error) {
        console.error("Error stopping bunker:", error);
      }
    }

    try {
      await Promise.race([
        relay.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Relay close timeout")), 5000),
        ),
      ]);
    } catch (error) {
      console.error("Error closing relay:", error);
    }

    // Ensure we've disconnected the client
    try {
      await client.disconnect();
    } catch (error) {
      // Ignore errors on disconnect
    }

    // Allow time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 15000);

  test("Bunker with default permissions allows specific kind", async () => {
    // Create bunker with default permissions for kind 1
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );

    // Set private keys
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Set default permissions for kind 1
    bunker.setDefaultPermissions(["sign_event:1"]);

    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Sign a kind 1 event (should be allowed)
    const eventToSign = {
      kind: 1,
      content: "Test note with permission",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    // This should succeed since kind 1 is allowed
    const signedEvent = await client.signEvent(eventToSign);

    // Verify signature
    expect(signedEvent.pubkey).toBe(userKeypair.publicKey);
    expect(signedEvent.kind).toBe(1);
    const valid = await verifySignature(
      signedEvent.id,
      signedEvent.sig,
      signedEvent.pubkey,
    );
    expect(valid).toBe(true);
  }, 10000);

  test("Bunker with default permissions rejects unauthorized kind", async () => {
    // Create bunker with default permissions for kind 1 only
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );

    // Set private keys
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Set default permissions for kind 1 only
    bunker.setDefaultPermissions(["sign_event:1"]);

    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Try to sign a kind 4 event (should be rejected)
    const eventToSign = {
      kind: 4,
      content: "Test DM with no permission",
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", "some-recipient-pubkey"]],
    };

    // This should fail since kind 4 is not allowed
    // Accept either "Permission denied" or "not authorized" in the error message
    await expect(client.signEvent(eventToSign)).rejects.toThrow(
      /permission|not authorized/i,
    );
  }, 5000);

  test("Bunker with wildcard permissions allows any kind", async () => {
    // Create bunker with wildcard permissions
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );

    // Set private keys
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Set default permissions allowing all events
    bunker.setDefaultPermissions(["sign_event"]);

    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Sign a kind 1 event
    const noteEvent = {
      kind: 1,
      content: "Test note",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const signedNote = await client.signEvent(noteEvent);
    expect(signedNote.kind).toBe(1);

    // Sign a kind 4 event
    const dmEvent = {
      kind: 4,
      content: "Test DM",
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", "some-recipient-pubkey"]],
    };

    const signedDM = await client.signEvent(dmEvent);
    expect(signedDM.kind).toBe(4);

    // Both should have valid signatures
    const validNote = await verifySignature(
      signedNote.id,
      signedNote.sig,
      signedNote.pubkey,
    );
    const validDM = await verifySignature(
      signedDM.id,
      signedDM.sig,
      signedDM.pubkey,
    );

    expect(validNote).toBe(true);
    expect(validDM).toBe(true);
  }, 7000);

  test("Bunker with NIP-44 encryption permissions (preferred)", async () => {
    // Create bunker with NIP-44 encryption permissions
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );

    // Set private keys
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Set default permissions for NIP-44 encryption
    bunker.setDefaultPermissions(["nip44_encrypt", "nip44_decrypt"]);

    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Create a test recipient
    const recipientKeys = await generateKeypair();

    // Test NIP-44 encrypt
    const plaintext = "This is a secret message";
    const encryptResult = await client.nip44Encrypt(
      recipientKeys.publicKey,
      plaintext,
    );

    // Verify encryption worked
    expect(encryptResult).toBeTruthy();
    expect(encryptResult).not.toBe(plaintext);

    // Test NIP-44 decrypt
    const decryptResult = await client.nip44Decrypt(
      recipientKeys.publicKey,
      encryptResult,
    );
    expect(decryptResult).toBe(plaintext);
  }, 7000);

  test("Bunker with NIP-04 encryption permissions (deprecated - use NIP-44 instead)", async () => {
    // Create bunker with NIP-04 encryption permissions  
    // Note: NIP-04 is considered deprecated due to security concerns, prefer NIP-44
    bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeypair.publicKey,
      signerKeypair.publicKey,
      {
        debug: true,
        logLevel: LogLevel.DEBUG,
      },
    );

    // Set private keys
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Set default permissions for NIP-04 encryption (explicitly enabled for this legacy test)
    bunker.setDefaultPermissions(["nip04_encrypt", "nip04_decrypt"]);

    await bunker.start();

    // Connect client
    const connectionString = bunker.getConnectionString();
    await client.connect(connectionString);

    // Create a test recipient
    const recipientKeys = await generateKeypair();

    // Test NIP-04 encrypt (legacy support)
    const plaintext = "This is a secret message";
    const encryptResult = await client.nip04Encrypt(
      recipientKeys.publicKey,
      plaintext,
    );

    // Verify encryption worked
    expect(encryptResult).toBeTruthy();
    expect(encryptResult).not.toBe(plaintext);

    // Test NIP-04 decrypt (legacy support)
    const decryptResult = await client.nip04Decrypt(
      recipientKeys.publicKey,
      encryptResult,
    );
    expect(decryptResult).toBe(plaintext);
  }, 7000);

  describe("Custom Permission Handler", () => {
    let customBunker: NostrRemoteSignerBunker;
    let customClient: SimpleNIP46Client;

    beforeEach(async () => {
      customBunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relayUrl],
        defaultPermissions: ["get_public_key", "ping", "sign_event"],
        debug: true,
      });

      customBunker.setUserPrivateKey(userKeypair.privateKey);
      customBunker.setSignerPrivateKey(signerKeypair.privateKey);

      await customBunker.start();

      customClient = new SimpleNIP46Client([relayUrl], {
        timeout: 5000,
        debug: true,
      });
    });

    afterEach(async () => {
      // Disconnect client first
      try {
        if (customClient) {
          await customClient.disconnect();
          customClient = null as unknown as SimpleNIP46Client;
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Stop bunker second
      try {
        if (customBunker) {
          await customBunker.stop();
          customBunker = null as unknown as NostrRemoteSignerBunker;
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Give time for all resources to cleanup
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    test("Custom permission handler allows specific operations", async () => {
      // Set up custom permission handler that only allows kind 1 events
      customBunker.setPermissionHandler((_clientPubkey, method, params) => {
        if (method === "sign_event") {
          try {
            const eventData = JSON.parse(params[0]);
            return eventData.kind === 1; // Only allow kind 1 (text notes)
          } catch {
            return false;
          }
        }
        return null; // Use default permission checking for other methods
      });

      const connectionString = customBunker.getConnectionString();
      await customClient.connect(connectionString);

      // Should allow kind 1 event
      const kind1Event = await customClient.signEvent({
        kind: 1,
        content: "This should work",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      });
      expect(kind1Event.kind).toBe(1);

      // Should reject kind 4 event
      await expect(
        customClient.signEvent({
          kind: 4,
          content: "This should fail",
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", "recipient"]],
        })
      ).rejects.toThrow();
    });

    test("Custom permission handler can be cleared", async () => {
      // Set strict handler
      customBunker.setPermissionHandler(() => false);

      const connectionString = customBunker.getConnectionString();
      await customClient.connect(connectionString);

      // Should reject everything
      await expect(
        customClient.signEvent({
          kind: 1,
          content: "Should fail",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        })
      ).rejects.toThrow();

      // Clear handler and add default permissions
      customBunker.clearPermissionHandler();
      customBunker.setPermissionHandler((_clientPubkey, method, _params) => {
        if (method === "sign_event") return true;
        return null;
      });

      // Should now work
      const event = await customClient.signEvent({
        kind: 1,
        content: "Should work now",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      });
      expect(event.kind).toBe(1);
    });
  });
});
