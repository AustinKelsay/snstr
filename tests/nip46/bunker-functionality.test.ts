import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerBunker,
  generateKeypair,
  verifySignature,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { NostrEvent } from "../../src/types/nostr";




describe("NIP-46 Bunker Functionality", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    // Start ephemeral relay for testing (use 0 to let OS assign free port)
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 50));
  }, 15000); // Increased timeout

  afterAll(async () => {
    if (relay) {
      await relay.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, 15000); // Increased timeout

  describe("Bunker Configuration", () => {
    test("Bunker with different user and signer keys", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping"]);

        await bunker.start();

        const connectionString = bunker.getConnectionString();
        expect(connectionString).toContain(signerKeypair.publicKey);

        // Test with client
        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        });

        try {
          await client.connect(connectionString);
          const publicKey = await client.getPublicKey();
          expect(publicKey).toBe(userKeypair.publicKey); // Should return user key, not signer key
        } finally {
          await client.disconnect().catch(() => {});
        }
      } finally {
        await bunker.stop().catch(() => {});
      }
    });

    test("Bunker with same user and signer keys", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        userKeypair.publicKey, // Same as user
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(userKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping"]);

        await bunker.start();

        const connectionString = bunker.getConnectionString();
        expect(connectionString).toContain(userKeypair.publicKey);

        // Test with client
        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        });

        try {
          await client.connect(connectionString);
          const publicKey = await client.getPublicKey();
          expect(publicKey).toBe(userKeypair.publicKey);
        } finally {
          await client.disconnect().catch(() => {});
        }
      } finally {
        await bunker.stop().catch(() => {});
      }
    });

    test("Bunker without signer key (defaults to user key)", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        undefined, // No signer key provided
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(userKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping"]);

        await bunker.start();

        const connectionString = bunker.getConnectionString();
        expect(connectionString).toContain(userKeypair.publicKey);
      } finally {
        await bunker.stop().catch(() => {});
      }
    });
  });

  describe("Permission System", () => {
    test("Granular event kind permissions", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions([
          "get_public_key",
          "ping",
          "sign_event:1", // Only kind 1 events
        ]);

        await bunker.start();

        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        });

        try {
          const connectionString = bunker.getConnectionString();
          await client.connect(connectionString);

          // Should be able to sign kind 1 events
          const kind1Event = await client.signEvent({
            kind: 1,
            content: "Kind 1 note",
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
          });
          expect(kind1Event.kind).toBe(1);

          // Should not be able to sign kind 4 events
          await expect(client.signEvent({
            kind: 4,
            content: "Kind 4 DM",
            created_at: Math.floor(Date.now() / 1000),
            tags: [["p", "recipient"]],
          })).rejects.toThrow(/permission|not authorized/i);
        } finally {
          await client.disconnect().catch(() => {});
        }
      } finally {
        await bunker.stop().catch(() => {});
      }
    });
  });

  describe("Event Signing Validation", () => {
    test("Bunker validates event structure", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping", "sign_event"]);

        await bunker.start();

        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        });

        try {
          const connectionString = bunker.getConnectionString();
          await client.connect(connectionString);

          // Valid event should work
          const validEvent = await client.signEvent({
            kind: 1,
            content: "Valid event",
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
          });
          expect(validEvent).toBeTruthy();
          expect(validEvent.pubkey).toBe(userKeypair.publicKey);

          // Verify signature is valid
          const isValid = await verifySignature(
            validEvent.id,
            validEvent.sig,
            validEvent.pubkey,
          );
          expect(isValid).toBe(true);
        } finally {
          await client.disconnect().catch(() => {});
        }
      } finally {
        await bunker.stop().catch(() => {});
      }
    });

    test("Multiple event signatures", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping", "sign_event"]);

        await bunker.start();

        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        });

        try {
          const connectionString = bunker.getConnectionString();
          await client.connect(connectionString);

          // Sign multiple events
          const events: NostrEvent[] = [];
          for (let i = 0; i < 3; i++) {
            const event = await client.signEvent({
              kind: 1,
              content: `Event ${i + 1}`,
              created_at: Math.floor(Date.now() / 1000) + i,
              tags: [],
            });
            events.push(event);
          }

          // All events should be different but valid
          expect(events.length).toBe(3);
          expect(new Set(events.map(e => e.id)).size).toBe(3); // All unique IDs
          expect(new Set(events.map(e => e.sig)).size).toBe(3); // All unique signatures

          // All signatures should be valid
          for (const event of events) {
            const isValid = await verifySignature(
              event.id,
              event.sig,
              event.pubkey,
            );
            expect(isValid).toBe(true);
          }
        } finally {
          await client.disconnect().catch(() => {});
        }
      } finally {
        await bunker.stop().catch(() => {});
      }
    });
  });

  describe("Bunker State Management", () => {
    test("Multiple start/stop cycles", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping"]);

        // First start/stop cycle
        await bunker.start();
        const connectionString1 = bunker.getConnectionString();
        expect(connectionString1).toBeTruthy();
        await bunker.stop();

        // Second start/stop cycle
        await bunker.start();
        const connectionString2 = bunker.getConnectionString();
        expect(connectionString2).toBeTruthy();
        await bunker.stop();

        // Connection strings should be the same (same keys)
        expect(connectionString1).toBe(connectionString2);
      } finally {
        await bunker.stop().catch(() => {});
      }
    });

    test("Bunker handles stop when not started", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: false, // Disabled for performance
          logLevel: LogLevel.ERROR, // Only errors for performance
        },
      );

      // Should not throw when stopping a bunker that was never started
      await expect(bunker.stop()).resolves.not.toThrow();
    });
  });

  describe("Bunker Initialization Security", () => {
    test("should validate bunker options on creation", () => {
      // Test empty userPubkey - should throw specific error
      expect(() => {
        new NostrRemoteSignerBunker({
          userPubkey: "", // Empty string
          relays: []
        });
      }).toThrow("User public key is required for bunker initialization");
      
      // Test invalid hex format - not hex characters
      expect(() => {
        new NostrRemoteSignerBunker({
          userPubkey: "G234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // Invalid character 'G'
          relays: []
        });
      }).toThrow("User public key must be 64 character hex string");
      
      // Test invalid length - too short
      expect(() => {
        new NostrRemoteSignerBunker({
          userPubkey: "1234567890abcdef123456789", // 25 characters, too short
          relays: []
        });
      }).toThrow("User public key must be 64 character hex string");
      
      // Test invalid length - too long
      expect(() => {
        new NostrRemoteSignerBunker({
          userPubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1", // 65 characters, too long
          relays: []
        });
      }).toThrow("User public key must be 64 character hex string");
      
      // Test invalid signer pubkey format when provided
      expect(() => {
        new NostrRemoteSignerBunker({
          userPubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          signerPubkey: "not-a-valid-pubkey", // Invalid format
          relays: []
        });
      }).toThrow("Signer public key must be 64 character hex string");
    });

    test("should enforce private key validation on start", async () => {
      const validKeypair = await generateKeypair();
      
      const bunker = new NostrRemoteSignerBunker({
        userPubkey: validKeypair.publicKey,
        relays: [relayUrl] // Use the ephemeral relay from test setup
      });
      
      // Should fail without private keys set - specific error about secure initialization
      await expect(bunker.start()).rejects.toThrow("User private key not properly initialized");
      
      // Set valid private keys
      bunker.setUserPrivateKey(validKeypair.privateKey);
      bunker.setSignerPrivateKey(validKeypair.privateKey);
      
      // Should succeed now that private keys are set with a working relay connection
      await expect(bunker.start()).resolves.not.toThrow();
      
      // Clean up
      await bunker.stop().catch(() => {});
    });

    test("should validate private keys when setting them", async () => {
      const validKeypair = await generateKeypair();
      
      const bunker = new NostrRemoteSignerBunker({
        userPubkey: validKeypair.publicKey,
        relays: []
      });
      
      // Test empty private key
      expect(() => {
        bunker.setUserPrivateKey(""); // Empty
      }).toThrow("cannot be an empty string");
      
      // Test invalid hex format
      expect(() => {
        bunker.setUserPrivateKey("G234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"); // Invalid character 'G'
      }).toThrow("is not a valid private key format or is outside curve order");
      
      // Test invalid length - too short
      expect(() => {
        bunker.setUserPrivateKey("1234567890abcdef"); // 16 characters, too short
      }).toThrow("is not a valid private key format or is outside curve order");
      
      // Test placeholder values that should be rejected
      expect(() => {
        bunker.setUserPrivateKey("undefined"); // Placeholder value
      }).toThrow();
      
      expect(() => {
        bunker.setUserPrivateKey("null"); // Placeholder value
      }).toThrow();
      
      // Test valid private key should not throw
      expect(() => {
        bunker.setUserPrivateKey(validKeypair.privateKey); // Valid
      }).not.toThrow();
    });
  });
}); 