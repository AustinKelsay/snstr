// Load the web entry at runtime so this test exercises the published platform entry.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webEntry = require("../../src/entries/index.web") as typeof import("../../src/entries/index.web");

import {
  RELAY_LIST_KIND,
  createRelayListEvent,
  getReadRelays,
  getWriteRelays,
  parseRelayList,
} from "../../src/nip65";
import {
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  createRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayDiscoveryEvent,
  parseRelayMonitorAnnouncement,
} from "../../src/nip66";

describe("web entry relay metadata exports", () => {
  it("re-exports NIP-65 helpers and constants", () => {
    expect(webEntry.RELAY_LIST_KIND).toBe(RELAY_LIST_KIND);
    expect(webEntry.createRelayListEvent).toBe(createRelayListEvent);
    expect(webEntry.parseRelayList).toBe(parseRelayList);
    expect(webEntry.getReadRelays).toBe(getReadRelays);
    expect(webEntry.getWriteRelays).toBe(getWriteRelays);
  });

  it("re-exports NIP-66 helpers and constants", () => {
    expect(webEntry.RELAY_DISCOVERY_KIND).toBe(RELAY_DISCOVERY_KIND);
    expect(webEntry.RELAY_MONITOR_KIND).toBe(RELAY_MONITOR_KIND);
    expect(webEntry.createRelayDiscoveryEvent).toBe(createRelayDiscoveryEvent);
    expect(webEntry.parseRelayDiscoveryEvent).toBe(parseRelayDiscoveryEvent);
    expect(webEntry.createRelayMonitorAnnouncement).toBe(
      createRelayMonitorAnnouncement,
    );
    expect(webEntry.parseRelayMonitorAnnouncement).toBe(
      parseRelayMonitorAnnouncement,
    );
  });
});
