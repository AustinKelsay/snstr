import { Nostr } from "../src/client/nostr";
import { NostrEvent, RelayEvent } from "../src/types/nostr";
import { generateKeypair } from "../src/utils/crypto";
import { createTextNote } from "../src/utils/event";
import {
  startEphemeralRelay,
  stopEphemeralRelay,
} from "../src/utils/test-helpers";

describe("Nostr Client Integration", () => {
  let nostr: Nostr;
  let privateKey: string;
  let publicKey: string;
  let relayUrl: string;

  beforeAll(async () => {
    const port = 4444;
    relayUrl = `ws://localhost:${port}`;
    await startEphemeralRelay(port);
  });

  afterAll(async () => {
    await stopEphemeralRelay();
  });

  beforeEach(async () => {
    const keypair = await generateKeypair();
    privateKey = keypair.privateKey;
    publicKey = keypair.publicKey;

    nostr = new Nostr([relayUrl]);
    nostr.setPrivateKey(privateKey);
  });

  afterEach(async () => {
    // Make sure we disconnect and clean up resources
    try {
      // First unsubscribe from any active subscriptions to avoid callbacks during shutdown
      nostr.unsubscribeAll();

      // Then disconnect from relays
      await nostr.disconnectFromRelays();

      // Add a small delay to ensure all connections are properly closed
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Error during test cleanup:", error);
    }
  });

  describe("Connection Management", () => {
    it("should connect and disconnect from relays", async () => {
      await nostr.connectToRelays();
      await nostr.disconnectFromRelays();
    });

    it("should handle connection timeouts gracefully", async () => {
      // Create a new client with a non-routable address to force timeout
      const timeoutClient = new Nostr(["ws://10.255.255.255:8080"]);
      timeoutClient.setPrivateKey(privateKey);

      // Set a very short timeout to make test fast
      // Access the relay directly to set the timeout
      const relays = (timeoutClient as any).relays;
      for (const relay of relays.values()) {
        relay.setConnectionTimeout(500);
      }

      // Track connection errors
      let errorCount = 0;
      timeoutClient.on(RelayEvent.Error, () => {
        errorCount++;
      });

      // Connect should complete even with timeouts
      await timeoutClient.connectToRelays();

      // Should have at least one error
      expect(errorCount).toBeGreaterThan(0);

      // Clean up
      timeoutClient.disconnectFromRelays();
    });
  });

  describe("Event Publishing", () => {
    it("should publish text note events", async () => {
      await nostr.connectToRelays();

      const event = await nostr.publishTextNote("Hello, Nostr!", [
        ["t", "test"],
      ]);
      expect(event).toBeDefined();
      expect(event?.id).toBeDefined();
      expect(event?.sig).toBeDefined();
      expect(event?.pubkey).toBe(publicKey);
    });
  });

  describe("Event Subscription", () => {
    it("should receive events matching filters", async () => {
      await nostr.connectToRelays();

      // First publish a note
      const content = "Test note for subscription";
      await nostr.publishTextNote(content, [["t", "test"]]);

      const filter = {
        authors: [publicKey],
        kinds: [1],
        limit: 10,
      };

      const events: NostrEvent[] = [];
      const subId = nostr.subscribe([filter], (event) => {
        events.push(event);
      });

      // Wait longer for events
      await new Promise((resolve) => setTimeout(resolve, 2000));

      nostr.unsubscribe(subId);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].pubkey).toBe(publicKey);
      expect(events[0].content).toBe(content);
    });

    it("should handle multiple subscriptions", async () => {
      await nostr.connectToRelays();

      // Publish two different text notes with different tags
      await nostr.publishTextNote("Test note 1", [["t", "test"]]);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await nostr.publishTextNote("Test note 2", [["t", "different"]]);

      const filter1 = {
        authors: [publicKey],
        kinds: [1],
        "#t": ["test"],
        limit: 10,
      };

      const filter2 = {
        authors: [publicKey],
        kinds: [1],
        "#t": ["different"],
        limit: 10,
      };

      const events1: NostrEvent[] = [];
      const events2: NostrEvent[] = [];

      const subId1 = nostr.subscribe([filter1], (event) => {
        console.log(
          "Received event for sub1:",
          event.kind,
          event.id,
          JSON.stringify(event.tags),
        );
        events1.push(event);
      });

      const subId2 = nostr.subscribe([filter2], (event) => {
        console.log(
          "Received event for sub2:",
          event.kind,
          event.id,
          JSON.stringify(event.tags),
        );
        events2.push(event);
      });

      // Wait longer for events
      await new Promise((resolve) => setTimeout(resolve, 5000));

      nostr.unsubscribe(subId1);
      nostr.unsubscribe(subId2);

      console.log(
        "Events1 count:",
        events1.length,
        "Events2 count:",
        events2.length,
      );
      console.log(
        "Events1 tags:",
        events1.map((e) => e.tags),
      );
      console.log(
        "Events2 tags:",
        events2.map((e) => e.tags),
      );

      // We expect at least some events to be received by the subscriptions
      expect(events1.length + events2.length).toBeGreaterThan(0);
    });
  });
});
