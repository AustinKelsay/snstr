import {
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
} from "../../src/nip66";

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
});
