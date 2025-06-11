import {
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  NipNumber,
  EventKind,
  RelayDiscoveryEventOptions,
  RelayMonitorAnnouncementOptions,
} from "../../src/nip66";
import { NostrEvent } from "../../src/types/nostr";

// Test types that allow invalid inputs for validation testing
type TestRelayDiscoveryOptions = {
  relay?: string | null | undefined;
  content?: string | Record<string, unknown> | number | object;
  network?: string | number;
  relayType?: string | number;
  supportedNips?: unknown;
  requirements?: unknown;
  topics?: unknown;
  kinds?: unknown;
  geohash?: string | number;
  rttOpen?: number | string;
  rttRead?: number | string;
  rttWrite?: number | string;
  additionalTags?: unknown;
};

type TestRelayMonitorOptions = {
  frequency?: number | string | null | undefined;
  timeouts?: unknown;
  checks?: unknown;
  geohash?: string | number;
  content?: string | number | object;
  additionalTags?: unknown;
};

/**
 * Tests for NIP-66 relay discovery utilities
 */

// Valid test pubkey (64-character hex string)
const validPubkey = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

describe("NIP-66", () => {
  test("createRelayDiscoveryEvent should create proper event", () => {
    const event = createRelayDiscoveryEvent(
      { relay: "wss://relay.example.com", rttOpen: 100 },
      validPubkey,
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
      validPubkey,
    );

    const parsed = parseRelayDiscoveryEvent({
      ...event,
      id: "1",
      sig: "sig",
      pubkey: validPubkey,
    });

    expect(parsed?.relay).toBe("wss://relay.example.com");
    expect(parsed?.network).toBe("clearnet");
    expect(parsed?.supportedNips).toContain("1");
  });

  test("createRelayMonitorAnnouncement should create announcement", () => {
    const event = createRelayMonitorAnnouncement(
      { frequency: 3600, checks: ["ws"] },
      validPubkey,
    );
    expect(event.kind).toBe(RELAY_MONITOR_KIND);
    expect(event.tags).toContainEqual(["frequency", "3600"]);
    expect(event.tags).toContainEqual(["c", "ws"]);
  });

  describe("Type alias behavior and data transformation", () => {
    test("supportedNips should accept both numbers and strings (NipNumber type)", () => {
      const mixedNips: NipNumber[] = [1, "2", 4, "17"];
      
      const options: RelayDiscoveryEventOptions = {
        relay: "wss://relay.example.com",
        supportedNips: mixedNips,
      };
      
      // Should not throw an error
      expect(() => createRelayDiscoveryEvent(options, validPubkey)).not.toThrow();
      
      const event = createRelayDiscoveryEvent(options, validPubkey);
      
      // All NIP numbers should be converted to strings in tags
      expect(event.tags).toContainEqual(["N", "1"]);
      expect(event.tags).toContainEqual(["N", "2"]);
      expect(event.tags).toContainEqual(["N", "4"]);
      expect(event.tags).toContainEqual(["N", "17"]);
    });

    test("kinds should accept both numbers and strings (EventKind type)", () => {
      const mixedKinds: EventKind[] = [0, "1", 3, "10000"];
      
      const options: RelayDiscoveryEventOptions = {
        relay: "wss://relay.example.com",
        kinds: mixedKinds,
      };
      
      // Should not throw an error
      expect(() => createRelayDiscoveryEvent(options, validPubkey)).not.toThrow();
      
      const event = createRelayDiscoveryEvent(options, validPubkey);
      
      // All event kinds should be converted to strings in tags
      expect(event.tags).toContainEqual(["k", "0"]);
      expect(event.tags).toContainEqual(["k", "1"]);
      expect(event.tags).toContainEqual(["k", "3"]);
      expect(event.tags).toContainEqual(["k", "10000"]);
    });

    test("parsed events should always have supportedNips and kinds as strings", () => {
      const event = createRelayDiscoveryEvent(
        {
          relay: "wss://relay.example.com",
          supportedNips: [1, "2", 4], // Mixed input types
          kinds: [0, "1", 3], // Mixed input types
        },
        validPubkey,
      );

      const parsed = parseRelayDiscoveryEvent({
        ...event,
        id: "test",
        sig: "sig",
        pubkey: validPubkey,
      });

      expect(parsed).not.toBeNull();
      
      // All parsed values should be strings
      expect(parsed?.supportedNips).toEqual(["1", "2", "4"]);
      expect(parsed?.kinds).toEqual(["0", "1", "3"]);
      
      // Type check - these should be string arrays
      expect(typeof parsed?.supportedNips[0]).toBe("string");
      expect(typeof parsed?.kinds[0]).toBe("string");
    });

    test("round-trip conversion maintains data integrity", () => {
      const originalOptions: RelayDiscoveryEventOptions = {
        relay: "wss://relay.example.com",
        supportedNips: [1, "2", 4, "17"] as NipNumber[],
        kinds: [0, "1", 3, "10000"] as EventKind[],
        network: "clearnet",
        relayType: "paid",
      };
      
      // Create event
      const event = createRelayDiscoveryEvent(originalOptions, validPubkey);
      
      // Parse event
      const parsed = parseRelayDiscoveryEvent({
        ...event,
        id: "test",
        sig: "sig",
        pubkey: validPubkey,
      });

      expect(parsed).not.toBeNull();
      
      // Data should be preserved (as strings)
      expect(parsed?.supportedNips).toEqual(["1", "2", "4", "17"]);
      expect(parsed?.kinds).toEqual(["0", "1", "3", "10000"]);
      expect(parsed?.network).toBe("clearnet");
      expect(parsed?.relayType).toBe("paid");
      expect(parsed?.relay).toBe("wss://relay.example.com");
    });

    test("type aliases should be exported and usable", () => {
      // This test verifies that the type aliases are properly exported
      // and can be used in user code
      
      const nips: NipNumber[] = [1, "2", 4];
      const kinds: EventKind[] = [0, "1", 3];
      
      // Should be able to use these in function calls
      const options: RelayDiscoveryEventOptions = {
        relay: "wss://relay.example.com",
        supportedNips: nips,
        kinds: kinds,
      };
      
      expect(() => createRelayDiscoveryEvent(options, validPubkey)).not.toThrow();
      
      // Verify they work with mixed types
      expect(nips).toContain(1); // number
      expect(nips).toContain("2"); // string
      expect(kinds).toContain(0); // number  
      expect(kinds).toContain("1"); // string
    });
  });

  describe("Validation for createRelayDiscoveryEvent", () => {
    test("should throw error for missing options", () => {
      expect(() => createRelayDiscoveryEvent(null as unknown as RelayDiscoveryEventOptions, validPubkey)).toThrow("Options object is required");
      expect(() => createRelayDiscoveryEvent(undefined as unknown as RelayDiscoveryEventOptions, validPubkey)).toThrow("Options object is required");
    });

    test("should throw error for invalid pubkey", () => {
      const options: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      expect(() => createRelayDiscoveryEvent(options, "")).toThrow("Valid pubkey is required");
      expect(() => createRelayDiscoveryEvent(options, "   ")).toThrow("Valid pubkey is required");
      expect(() => createRelayDiscoveryEvent(options, null as unknown as string)).toThrow("Valid pubkey is required");
      expect(() => createRelayDiscoveryEvent(options, undefined as unknown as string)).toThrow("Valid pubkey is required");
    });

          test("should throw error for invalid relay URL", () => {
        expect(() => createRelayDiscoveryEvent({ relay: "" }, validPubkey)).toThrow("Valid relay URL is required");
        expect(() => createRelayDiscoveryEvent({ relay: "   " }, validPubkey)).toThrow("Valid relay URL is required");
        expect(() => createRelayDiscoveryEvent({ relay: null } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("Valid relay URL is required");
        expect(() => createRelayDiscoveryEvent({ relay: "http://example.com" }, validPubkey)).toThrow("Relay URL must start with ws:// or wss://");
        expect(() => createRelayDiscoveryEvent({ relay: "wss://invalid url" }, validPubkey)).toThrow(
          "Relay URL must start with ws:// or wss:// and be valid"
        );
      });

    test("should throw error for invalid RTT values", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, rttOpen: -1 }, validPubkey)).toThrow("rttOpen must be a non-negative number");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, rttOpen: "100" } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("rttOpen must be a non-negative number");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, rttOpen: Infinity }, validPubkey)).toThrow("rttOpen must be a non-negative number");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, rttRead: -5 }, validPubkey)).toThrow("rttRead must be a non-negative number");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, rttWrite: NaN }, validPubkey)).toThrow("rttWrite must be a non-negative number");
    });

    test("should throw error for invalid array fields", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, supportedNips: "not array" } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("supportedNips must be an array");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, requirements: {} } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("requirements must be an array");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, topics: "string" } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("topics must be an array");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, kinds: 123 } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("kinds must be an array");
    });

    test("should throw error for invalid geohash", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, geohash: "" }, validPubkey)).toThrow("geohash must be a non-empty string");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, geohash: "   " }, validPubkey)).toThrow("geohash must be a non-empty string");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, geohash: 123 } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("geohash must be a non-empty string");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, geohash: "invalid-chars!" }, validPubkey)).toThrow("geohash must be alphanumeric and at most 12 characters");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, geohash: "verylonggeohashvalue" }, validPubkey)).toThrow("geohash must be alphanumeric and at most 12 characters");
    });

    test("should throw error for invalid supportedNips values", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, supportedNips: [-1] }, validPubkey)).toThrow("supportedNips must contain valid positive integers");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, supportedNips: [1.5] }, validPubkey)).toThrow("supportedNips must contain valid positive integers");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, supportedNips: ["invalid"] }, validPubkey)).toThrow("supportedNips must contain valid positive integers or integer strings");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, supportedNips: [true] } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("supportedNips must contain numbers or strings");
    });

    test("should throw error for invalid kinds values", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, kinds: [-1] }, validPubkey)).toThrow("kinds must contain valid non-negative integers");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, kinds: [1.5] }, validPubkey)).toThrow("kinds must contain valid non-negative integers");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, kinds: [{}] } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("kinds must contain numbers or strings");
    });

    test("should throw error for invalid string arrays", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, requirements: [""] }, validPubkey)).toThrow("requirements must contain non-empty strings");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, requirements: [123] } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("requirements must contain non-empty strings");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, topics: ["   "] }, validPubkey)).toThrow("topics must contain non-empty strings");
    });

    test("should throw error for invalid additionalTags", () => {
      const baseOptions: RelayDiscoveryEventOptions = { relay: "wss://relay.example.com" };
      
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, additionalTags: ["not array"] } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("additionalTags must be an array of string arrays");
      expect(() => createRelayDiscoveryEvent({ ...baseOptions, additionalTags: [[123]] } as TestRelayDiscoveryOptions as RelayDiscoveryEventOptions, validPubkey)).toThrow("additionalTags must contain arrays of strings");
    });

    test("should accept valid options", () => {
      const validOptions: RelayDiscoveryEventOptions = {
        relay: "wss://relay.example.com",
        network: "clearnet",
        relayType: "paid",
        supportedNips: [1, "2", 4],
        requirements: ["auth", "payment"],
        topics: ["topic1", "topic2"],
        kinds: [0, 1, "3"],
        geohash: "9q8yy",
        rttOpen: 100,
        rttRead: 150,
        rttWrite: 200,
        additionalTags: [["custom", "value"]],
      };
      
      expect(() => createRelayDiscoveryEvent(validOptions, validPubkey)).not.toThrow();
    });
  });

  describe("Validation for createRelayMonitorAnnouncement", () => {
    test("should throw error for missing options", () => {
      expect(() => createRelayMonitorAnnouncement(null as unknown as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("Options object is required");
      expect(() => createRelayMonitorAnnouncement(undefined as unknown as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("Options object is required");
    });

    test("should throw error for invalid pubkey", () => {
      const options: RelayMonitorAnnouncementOptions = { frequency: 3600 };
      expect(() => createRelayMonitorAnnouncement(options, "")).toThrow("Valid pubkey is required");
      expect(() => createRelayMonitorAnnouncement(options, null as unknown as string)).toThrow("Valid pubkey is required");
    });

    test("should throw error for invalid frequency", () => {
      expect(() => createRelayMonitorAnnouncement({ frequency: undefined } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("frequency is required");
      expect(() => createRelayMonitorAnnouncement({ frequency: null } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("frequency is required");
      expect(() => createRelayMonitorAnnouncement({ frequency: 0 }, validPubkey)).toThrow("frequency must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ frequency: -1 }, validPubkey)).toThrow("frequency must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ frequency: 1.5 }, validPubkey)).toThrow("frequency must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ frequency: "3600" } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("frequency must be a positive integer");
    });

    test("should throw error for invalid timeouts", () => {
      const baseOptions: RelayMonitorAnnouncementOptions = { frequency: 3600 };
      
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: "not array" } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("timeouts must be an array");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [null] } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("timeouts must contain timeout definition objects");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [{ value: undefined }] } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("timeout value is required");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [{ value: 0 }] }, validPubkey)).toThrow("timeout value must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [{ value: -1 }] }, validPubkey)).toThrow("timeout value must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [{ value: 1.5 }] }, validPubkey)).toThrow("timeout value must be a positive integer");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, timeouts: [{ value: 5000, test: "" }] }, validPubkey)).toThrow("timeout test must be a non-empty string if provided");
    });

    test("should throw error for invalid checks", () => {
      const baseOptions: RelayMonitorAnnouncementOptions = { frequency: 3600 };
      
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, checks: "not array" } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("checks must be an array");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, checks: [""] }, validPubkey)).toThrow("checks must contain non-empty strings");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, checks: [123] } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("checks must contain non-empty strings");
    });

    test("should throw error for invalid geohash", () => {
      const baseOptions: RelayMonitorAnnouncementOptions = { frequency: 3600 };
      
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, geohash: "" }, validPubkey)).toThrow("geohash must be a non-empty string");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, geohash: "invalid-chars!" }, validPubkey)).toThrow("geohash must be alphanumeric and at most 12 characters");
    });

    test("should throw error for invalid content", () => {
      const baseOptions: RelayMonitorAnnouncementOptions = { frequency: 3600 };
      
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, content: 123 } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("content must be a string");
      expect(() => createRelayMonitorAnnouncement({ ...baseOptions, content: {} } as TestRelayMonitorOptions as RelayMonitorAnnouncementOptions, validPubkey)).toThrow("content must be a string");
    });

    test("should accept valid options", () => {
      const validOptions: RelayMonitorAnnouncementOptions = {
        frequency: 3600,
        timeouts: [
          { value: 5000, test: "connect" },
          { value: 3000 }
        ],
        checks: ["ws", "nip11"],
        geohash: "9q8yy",
        content: "Monitor announcement",
        additionalTags: [["custom", "value"]],
      };
      
      expect(() => createRelayMonitorAnnouncement(validOptions, validPubkey)).not.toThrow();
    });
  });

  describe("Enhanced parsing validation with bounds checking", () => {
    // Mock console.warn to capture warnings
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test("parseRelayMonitorAnnouncement should handle invalid timeout values gracefully", () => {
      const malformedEvent: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [
          ["frequency", "3600"],
          // Valid timeout
          ["timeout", "5000", "connect"],
          // Invalid timeouts - should be skipped with warnings
          ["timeout", ""], // Empty value
          ["timeout", "   "], // Whitespace only
          ["timeout", "invalid"], // Non-numeric
          ["timeout", "-1000"], // Negative value
          ["timeout", "0"], // Zero value (below minimum)
          ["timeout", "500000"], // Too large (above maximum)
          ["timeout", "1.5"], // Decimal (parseInt converts to 1, which is valid)
          ["timeout", "2000", ""], // Valid timeout but empty test
          ["timeout", "3000", 123 as unknown as string], // Valid timeout but invalid test type
          // Valid timeout without test
          ["timeout", "4000"],
        ],
        content: "Test content",
        sig: "testsig",
      };

      const parsed = parseRelayMonitorAnnouncement(malformedEvent);
      expect(parsed).not.toBeNull();
      
      // Should only have valid timeouts (note: "1.5" becomes 1 via parseInt, which is valid)
      expect(parsed?.timeouts).toHaveLength(3);
      expect(parsed?.timeouts[0]).toEqual({ value: 5000, test: "connect" });
      expect(parsed?.timeouts[1]).toEqual({ value: 1, test: undefined }); // "1.5" -> 1
      expect(parsed?.timeouts[2]).toEqual({ value: 4000, test: undefined });
      
      // Should have logged warnings for invalid entries
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping timeout tag with missing or empty value")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping timeout tag with invalid numeric value")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping timeout tag with value out of bounds")
      );
    });

    test("parseRelayMonitorAnnouncement should handle invalid frequency values gracefully", () => {
      const malformedEvent: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [
          // Invalid frequencies - should be skipped with warnings
          ["frequency", ""], // Empty value
          ["frequency", "invalid"], // Non-numeric
          ["frequency", "-1"], // Negative
          ["frequency", "0"], // Zero (below minimum)
          ["frequency", "100000"], // Too large (above maximum)
          // Valid frequency (should be used)
          ["frequency", "3600"],
        ],
        content: "Test content",
        sig: "testsig",
      };

      const parsed = parseRelayMonitorAnnouncement(malformedEvent);
      expect(parsed).not.toBeNull();
      
      // Should use the valid frequency (last valid one wins)
      expect(parsed?.frequency).toBe(3600);
      
      // Should have logged warnings for invalid entries
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping frequency tag with missing or empty value")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping frequency tag with invalid numeric value")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NIP-66: Skipping frequency tag with value out of bounds")
      );
    });

    test("parseRelayMonitorAnnouncement should handle edge case timeout values correctly", () => {
      const edgeCaseEvent: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [
          ["frequency", "3600"],
          // Edge cases that should be valid
          ["timeout", "1"], // Minimum valid value
          ["timeout", "300000"], // Maximum valid value
          ["timeout", "1000", "test"], // Valid with test
          // Edge cases that should be invalid
          ["timeout", "0"], // Below minimum
          ["timeout", "300001"], // Above maximum
        ],
        content: "Test content",
        sig: "testsig",
      };

      const parsed = parseRelayMonitorAnnouncement(edgeCaseEvent);
      expect(parsed).not.toBeNull();
      
      // Should only have valid timeouts
      expect(parsed?.timeouts).toHaveLength(3);
      expect(parsed?.timeouts[0]).toEqual({ value: 1, test: undefined });
      expect(parsed?.timeouts[1]).toEqual({ value: 300000, test: undefined });
      expect(parsed?.timeouts[2]).toEqual({ value: 1000, test: "test" });
    });

    test("parseRelayMonitorAnnouncement should handle exceptions gracefully", () => {
      // Create a malformed tag that might cause unexpected errors
      const event: NostrEvent = {
        id: "test",
        pubkey: "testkey",
        created_at: 1234567890,
        kind: RELAY_MONITOR_KIND,
        tags: [
          ["frequency", "3600"],
          ["timeout", "5000"],
          // This should be handled by existing bounds checking
          ["timeout", "NaN"],
        ],
        content: "Test content",
        sig: "testsig",
      };

      // Should not throw an error
      expect(() => parseRelayMonitorAnnouncement(event)).not.toThrow();
      
      const parsed = parseRelayMonitorAnnouncement(event);
      expect(parsed).not.toBeNull();
      expect(parsed?.timeouts).toHaveLength(1);
      expect(parsed?.timeouts[0]).toEqual({ value: 5000, test: undefined });
    });
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
          "invalid-tag" as unknown as string[],
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
          "invalid-tag" as unknown as string[],
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
