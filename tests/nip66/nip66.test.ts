import {
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
} from "../../src/nip66";
import { NostrEvent } from "../../src/types/nostr";

/**
 * Tests for NIP-66 relay discovery utilities
 */

describe("NIP-66", () => {
  test("createRelayDiscoveryEvent should create proper event", () => {
    const event = createRelayDiscoveryEvent(
      { relay: "wss://relay.example.com", rttOpen: 100 },
      "pubkey",
    );
    expect(event.kind).toBe(RELAY_DISCOVERY_KIND);
    expect(event.tags).toContainEqual(["d", "wss://relay.example.com"]);
    expect(event.tags).toContainEqual(["rtt-open", "100"]);
  });

  test("parseRelayDiscoveryEvent should parse tags", () => {
    const event = createRelayDiscoveryEvent(
      {
        relay: "wss://relay.example.com",
        network: "clearnet",
        supportedNips: [1],
      },
      "pubkey",
    );

    const parsed = parseRelayDiscoveryEvent({
      ...event,
      id: "1",
      sig: "sig",
      pubkey: "pubkey",
    });

    expect(parsed?.relay).toBe("wss://relay.example.com");
    expect(parsed?.network).toBe("clearnet");
    expect(parsed?.supportedNips).toContain("1");
  });

  test("createRelayMonitorAnnouncement should create announcement", () => {
    const event = createRelayMonitorAnnouncement(
      { frequency: 3600, checks: ["ws"] },
      "pubkey",
    );
    expect(event.kind).toBe(RELAY_MONITOR_KIND);
    expect(event.tags).toContainEqual(["frequency", "3600"]);
    expect(event.tags).toContainEqual(["c", "ws"]);
  });

  describe("Bounds checking for malformed tags", () => {
    test("parseRelayDiscoveryEvent should handle malformed tags gracefully", () => {
      const malformedEvent: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_DISCOVERY_KIND,
        tags: [
          // Valid tags
          ["d", "wss://relay.example.com"],
          ["n", "clearnet"],
          // Malformed tags - should be skipped
          [], // Empty array
          ["T"], // Missing value
          ["N"], // Missing value
          ["rtt-open"], // Missing value
          ["rtt-read", "invalid"], // Invalid number
          ["rtt-write", ""], // Empty string
          // Non-array tag (should be filtered by bounds checking)
          "invalid-tag" as any,
          // Valid tags that should work
          ["R", "auth"],
          ["t", "topic1"],
          ["rtt-open", "150"],
        ],
        content: "{}",
        sig: "testsig",
      };

      // Should not throw an error
      expect(() => parseRelayDiscoveryEvent(malformedEvent)).not.toThrow();
      
      const parsed = parseRelayDiscoveryEvent(malformedEvent);
      expect(parsed).not.toBeNull();
      expect(parsed?.relay).toBe("wss://relay.example.com");
      expect(parsed?.network).toBe("clearnet");
      expect(parsed?.requirements).toContain("auth");
      expect(parsed?.topics).toContain("topic1");
      expect(parsed?.rttOpen).toBe(150);
      // Invalid values should be undefined
      expect(parsed?.rttRead).toBeUndefined();
      expect(parsed?.rttWrite).toBeUndefined();
    });

    test("parseRelayMonitorAnnouncement should handle malformed tags gracefully", () => {
      const malformedEvent: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [
          // Valid tags
          ["frequency", "3600"],
          ["c", "ws"],
          // Malformed tags - should be skipped
          [], // Empty array
          ["frequency"], // Missing value
          ["timeout"], // Missing value
          ["timeout", "invalid"], // Invalid number
          ["timeout", ""], // Empty string
          ["timeout", "5000", "test"], // Valid timeout with test
          ["timeout", "2000"], // Valid timeout without test
          // Non-array tag
          "invalid-tag" as any,
          // Valid tags
          ["g", "9q8yy"],
        ],
        content: "Monitor announcement",
        sig: "testsig",
      };

      // Should not throw an error
      expect(() => parseRelayMonitorAnnouncement(malformedEvent)).not.toThrow();
      
      const parsed = parseRelayMonitorAnnouncement(malformedEvent);
      expect(parsed).not.toBeNull();
      expect(parsed?.frequency).toBe(3600);
      expect(parsed?.checks).toContain("ws");
      expect(parsed?.geohash).toBe("9q8yy");
      // Should have valid timeouts only
      expect(parsed?.timeouts).toHaveLength(2);
      expect(parsed?.timeouts[0]).toEqual({ value: 5000, test: "test" });
      expect(parsed?.timeouts[1]).toEqual({ value: 2000, test: undefined });
    });

    test("parseRelayDiscoveryEvent should handle empty tags array", () => {
      const eventWithEmptyTags: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_DISCOVERY_KIND,
        tags: [],
        content: "{}",
        sig: "testsig",
      };

      const parsed = parseRelayDiscoveryEvent(eventWithEmptyTags);
      expect(parsed).not.toBeNull();
      expect(parsed?.relay).toBe(""); // Default empty string
      expect(parsed?.supportedNips).toEqual([]);
      expect(parsed?.requirements).toEqual([]);
      expect(parsed?.topics).toEqual([]);
      expect(parsed?.kinds).toEqual([]);
    });

    test("parseRelayMonitorAnnouncement should handle empty tags array", () => {
      const eventWithEmptyTags: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [],
        content: "Test content",
        sig: "testsig",
      };

      const parsed = parseRelayMonitorAnnouncement(eventWithEmptyTags);
      expect(parsed).not.toBeNull();
      expect(parsed?.frequency).toBe(0); // Default value
      expect(parsed?.timeouts).toEqual([]);
      expect(parsed?.checks).toEqual([]);
      expect(parsed?.content).toBe("Test content");
    });
  });
});
