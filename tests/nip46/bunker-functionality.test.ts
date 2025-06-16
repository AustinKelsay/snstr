import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
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
    // Start ephemeral relay for testing
    relay = new NostrRelay(3794);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 10000);

  afterAll(async () => {
    if (relay) {
      relay.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, 10000);

  describe("Bunker Configuration", () => {
    test("Bunker with different user and signer keys", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping", "sign_event"]);

        await bunker.start();

        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
        },
      );

      try {
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        bunker.setDefaultPermissions(["get_public_key", "ping", "sign_event"]);

        await bunker.start();

        const client = new SimpleNIP46Client([relayUrl], {
          timeout: 5000,
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
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
          debug: true,
          logLevel: LogLevel.DEBUG,
        },
      );

      // Should not throw when stopping a bunker that was never started
      await expect(bunker.stop()).resolves.not.toThrow();
    });
  });
}); 