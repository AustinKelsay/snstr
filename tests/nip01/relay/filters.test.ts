/**
 * Tests for enhanced filter types in NostrFilter
 * Tests that verify the functionality of the expanded filter types from NIP-01
 */

import {
  NostrFilter,
  Filter,
  NostrEvent,
  NostrKind,
} from "../../../src/types/nostr";
import { Relay } from "../../../src/nip01/relay";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";
import { createSignedEvent } from "../../../src/nip01/event";
import { generateKeypair } from "../../../src/utils/crypto";
import { testUtils } from "../../types";

// Helper function to wait for events
const waitForEvents = (
  relay: Relay,
  filter: Filter,
  expectedCount: number,
): Promise<NostrEvent[]> => {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    let subId = "";

    subId = relay.subscribe([filter], (event) => {
      events.push(event);
      if (events.length === expectedCount) {
        relay.unsubscribe(subId);
        resolve(events);
      }
    });
  });
};

describe("Enhanced NostrFilter Types", () => {
  let ephemeralRelay: NostrRelay;
  let relay: Relay;
  let keypair: { privateKey: string; publicKey: string };

  beforeAll(async () => {
    // Start ephemeral relay
    ephemeralRelay = new NostrRelay(0);
    await ephemeralRelay.start();

    // Connect to the relay
    relay = new Relay(ephemeralRelay.url, { connectionTimeout: 1000 });

    // Generate keypair for test events
    keypair = await generateKeypair();

    // Connect
    await relay.connect();
  });

  afterAll(async () => {
    relay.disconnect();
    await ephemeralRelay.close();
  });

  // Test 1: Type validation for filters with new tag types
  describe("Filter Type Validation", () => {
    test("should accept filters with all defined tag types", () => {
      // This test verifies TypeScript accepts the expanded type definition
      // Create a filter with all the standard tag types
      const filter: NostrFilter = {
        kinds: [NostrKind.ShortNote],
        "#e": ["event1", "event2"], // event references
        "#p": ["pubkey1", "pubkey2"], // pubkey references
        "#a": ["address1", "address2"], // address references for addressable events (NIP-01)
        "#d": ["d-tag1", "d-tag2"], // d-tag for replaceable events
        "#t": ["topic1", "topic2"], // topics/hashtags
        "#r": ["reference1", "reference2"], // references/URLs
        "#g": ["geohash1", "geohash2"], // geohash locations
        "#u": ["url1", "url2"], // URLs
        "#c": ["nsfw", "violence"], // content warnings
        "#l": ["en", "es"], // languages
        "#m": ["text/plain", "image/png"], // MIME types
        "#s": ["subject1", "subject2"], // subjects
        since: Math.floor(Date.now() / 1000) - 86400,
        until: Math.floor(Date.now() / 1000),
        limit: 10,
      };

      // TypeScript verification happens at compile time
      // At runtime, we just check the properties exist
      expect(filter["#e"]).toHaveLength(2);
      expect(filter["#p"]).toHaveLength(2);
      expect(filter["#a"]).toHaveLength(2);
      expect(filter["#d"]).toHaveLength(2);
      expect(filter["#t"]).toHaveLength(2);
      expect(filter["#r"]).toHaveLength(2);
      expect(filter["#g"]).toHaveLength(2);
      expect(filter["#u"]).toHaveLength(2);
      expect(filter["#c"]).toHaveLength(2);
      expect(filter["#l"]).toHaveLength(2);
      expect(filter["#m"]).toHaveLength(2);
      expect(filter["#s"]).toHaveLength(2);
      expect(filter.since).toBeDefined();
      expect(filter.until).toBeDefined();
      expect(filter.limit).toBe(10);
    });

    test("should allow combining multiple tag filters", () => {
      // Create a filter with multiple tag filters
      const filter: NostrFilter = {
        kinds: [NostrKind.ShortNote, 30023],
        "#t": ["topic1", "topic2", "topic3"],
        "#p": ["pubkey1", "pubkey2"],
        limit: 5,
      };

      // Verify type checking and value access
      expect(filter["#t"]).toHaveLength(3);
      expect(filter["#p"]).toHaveLength(2);
      expect(filter.kinds).toContain(NostrKind.ShortNote);
      expect(filter.kinds).toContain(30023);
    });
  });

  // Test 2: Ensure backward compatibility for existing code
  describe("Backward Compatibility", () => {
    test("should work with existing filter objects using only #e and #p", () => {
      // Create a traditional filter with only #e and #p
      const filter: NostrFilter = {
        kinds: [NostrKind.ShortNote],
        "#e": ["event1", "event2"],
        "#p": ["pubkey1", "pubkey2"],
        limit: 10,
      };

      // Verify access to the traditional fields
      expect(filter["#e"]).toHaveLength(2);
      expect(filter["#p"]).toHaveLength(2);
      expect(filter.kinds).toContain(NostrKind.ShortNote);
      expect(filter.limit).toBe(10);
    });

    test("should allow accessing filters with index notation", () => {
      // Create a filter
      const filter: Filter = {
        kinds: [NostrKind.ShortNote],
        "#t": ["topic1", "topic2"],
      };

      // Test accessing with index notation
      expect(filter["#t"]).toEqual(["topic1", "topic2"]);

      // Test adding with index notation
      filter["#z"] = ["custom-tag-value"];
      expect(filter["#z"]).toEqual(["custom-tag-value"]);

      // Create with index notation
      const dynamicFilter: Filter = {
        kinds: [NostrKind.ShortNote],
      };

      // Add tags dynamically
      const tagName = "#x";
      dynamicFilter[tagName] = ["dynamic-value"];
      expect(dynamicFilter["#x"]).toEqual(["dynamic-value"]);
    });

    test("should work with custom filter properties via indexed access", () => {
      // Create a filter with a non-standard tag filter
      const filter: Filter = {
        kinds: [NostrKind.ShortNote],
        "#custom-tag": ["custom-value"],
      };

      // Access the custom tag
      expect(filter["#custom-tag"]).toEqual(["custom-value"]);
    });
  });

  // Test 3: Test event filtering with new tag types
  describe("Event Filtering with New Tag Types", () => {
    beforeEach(async () => {
      // Clear the internal cache using the test utility function
      testUtils.clearRelayCache(ephemeralRelay);
    });

    test("should filter events by #t tag", async () => {
      // Create events with #t tag
      const topic = "test-topic-filter";

      // Event with matching tag
      const event1 = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with test topic",
          tags: [["t", topic]],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Event without matching tag
      const event2 = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event without test topic",
          tags: [["t", "other-topic"]],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Publish events
      await relay.publish(event1);
      await relay.publish(event2);

      // Create filter
      const filter: Filter = {
        kinds: [1],
        "#t": [topic],
      };

      // Subscribe and collect events
      const receivedEvents = await waitForEvents(relay, filter, 1);

      // Verify only the matching event was received
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(event1.id);
    });

    test("should filter events with multiple tags of the same type", async () => {
      // Create an event with multiple t tags
      const event = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with multiple topics",
          tags: [
            ["t", "topic1"],
            ["t", "topic2"],
            ["t", "topic3"],
          ],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Publish event
      await relay.publish(event);

      // Test filters matching different topics
      const filter1: Filter = {
        kinds: [1],
        "#t": ["topic1"],
      };

      const filter2: Filter = {
        kinds: [1],
        "#t": ["topic2"],
      };

      const filter3: Filter = {
        kinds: [1],
        "#t": ["topic3"],
      };

      // Subscribe and collect events for each filter
      const events1 = await waitForEvents(relay, filter1, 1);
      const events2 = await waitForEvents(relay, filter2, 1);
      const events3 = await waitForEvents(relay, filter3, 1);

      // Verify the event was received for each filter
      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
      expect(events3.length).toBe(1);

      expect(events1[0].id).toBe(event.id);
      expect(events2[0].id).toBe(event.id);
      expect(events3[0].id).toBe(event.id);
    });

    test("should filter events with multiple different tag types", async () => {
      // Create event with multiple tag types
      const event = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with multiple tag types",
          tags: [
            ["t", "specific-topic"],
            ["g", "specific-geohash"],
            ["r", "specific-reference"],
          ],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Create event with only some matching tags
      const partialEvent = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with partial match",
          tags: [
            ["t", "specific-topic"],
            ["g", "different-geohash"],
            ["r", "different-reference"],
          ],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Publish events
      await relay.publish(event);
      await relay.publish(partialEvent);

      // Filter requiring all tags to match
      const filter: Filter = {
        kinds: [1],
        "#t": ["specific-topic"],
        "#g": ["specific-geohash"],
        "#r": ["specific-reference"],
      };

      // Subscribe and collect events
      const receivedEvents = await waitForEvents(relay, filter, 1);

      // Verify only the fully matching event was received
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(event.id);
    });

    test("should filter by a combination of standard and extended tag types", async () => {
      // Create an event with various tag types
      const event = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with standard and extended tags",
          tags: [
            ["t", "tag-topic"],
            ["l", "en"], // language tag
            ["c", "nsfw"], // content warning
            ["s", "testing"], // subject
          ],
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Publish the event
      await relay.publish(event);

      // Filter by multiple tag types
      const filter: Filter = {
        kinds: [1],
        "#t": ["tag-topic"],
        "#l": ["en"],
        "#c": ["nsfw"],
        "#s": ["testing"],
      };

      // Subscribe and collect events
      const receivedEvents = await waitForEvents(relay, filter, 1);

      // Verify the event was matched
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(event.id);
    });
  });

  // Test 4: Edge cases and error handling
  describe("Edge Cases and Error Handling", () => {
    test("should handle empty tag arrays", async () => {
      // Create a filter with an empty tag array
      const filter: Filter = {
        kinds: [1],
        "#t": [],
      };

      // This should not throw an error
      expect(() => {
        relay.subscribe([filter], () => {});
      }).not.toThrow();
    });

    test("should handle very large number of tags", async () => {
      // Create an event with many tags
      const manyTags = Array(50)
        .fill(0)
        .map((_, i) => ["t", `topic-${i}`]);

      const event = await createSignedEvent(
        {
          pubkey: keypair.publicKey,
          kind: 1,
          content: "Event with many tags",
          tags: manyTags,
          created_at: Math.floor(Date.now() / 1000),
        },
        keypair.privateKey,
      );

      // Publish the event
      await relay.publish(event);

      // Create a filter matching one of the tags
      const filter: Filter = {
        kinds: [1],
        "#t": ["topic-25"],
      };

      // Subscribe and collect events
      const receivedEvents = await waitForEvents(relay, filter, 1);

      // Verify the event was received
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(event.id);
    });

    test("should handle numeric since/until/limit values", async () => {
      const now = Math.floor(Date.now() / 1000);

      // Create a filter with min/max numeric values
      const filter: Filter = {
        kinds: [1],
        since: now - 3600, // 1 hour ago
        until: now,
        limit: 10,
      };

      // Shouldn't throw an error
      expect(() => {
        relay.subscribe([filter], () => {});
      }).not.toThrow();
    });
  });
});
