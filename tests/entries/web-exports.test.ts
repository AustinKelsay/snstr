// Load the web entry at runtime so this test exercises the published platform entry.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webEntry = require("../../src/entries/index.web") as typeof import("../../src/entries/index.web");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeEntry = require("../../src/index") as typeof import("../../src/index");
import packageJson from "../../package.json";

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
  it("uses the shared web entry for browser and React Native targets", () => {
    const rootExports = packageJson.exports["."] as {
      browser: { default: string; types: string };
      import: string;
      "react-native": { default: string; types: string };
      require: string;
    };

    expect(rootExports["react-native"]).toEqual(rootExports.browser);
    const conditionOrder = Object.keys(rootExports);
    for (const platform of ["browser", "react-native"]) {
      expect(conditionOrder.indexOf(platform)).toBeLessThan(
        conditionOrder.indexOf("import"),
      );
      expect(conditionOrder.indexOf(platform)).toBeLessThan(
        conditionOrder.indexOf("require"),
      );
    }

    const nip04Exports = packageJson.exports["./nip04"] as typeof rootExports;
    expect(nip04Exports["react-native"]).toEqual(nip04Exports.browser);
    const nip04ConditionOrder = Object.keys(nip04Exports);
    for (const platform of ["browser", "react-native"]) {
      expect(nip04ConditionOrder.indexOf(platform)).toBeLessThan(
        nip04ConditionOrder.indexOf("import"),
      );
      expect(nip04ConditionOrder.indexOf(platform)).toBeLessThan(
        nip04ConditionOrder.indexOf("require"),
      );
    }
  });

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

describe("platform entry export policy", () => {
  it("keeps runtime drift limited to reviewed Node-only modules", () => {
    const nodeKeys = Object.keys(nodeEntry);
    const webKeys = Object.keys(webEntry);

    expect(webKeys.filter((key) => !nodeKeys.includes(key)).sort()).toEqual([]);
    expect(nodeKeys.filter((key) => !webKeys.includes(key)).sort()).toEqual([
      "NostrRemoteSignerBunker",
      "NostrRemoteSignerClient",
      "NostrWalletConnectClient",
      "NostrWalletService",
      "SimpleNIP46Bunker",
      "SimpleNIP46Client",
      "generateNWCURL",
      "isValidAuthUrl",
      "parseNWCURL",
    ]);
  });
});
