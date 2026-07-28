import { readFileSync } from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("public behavior test seams", () => {
  test("removes the shared Nostr and Relay private-shape adapters", () => {
    const testSupport = read("tests/types/index.ts");
    const behaviorTests = [
      "tests/integration.test.ts",
      "tests/nip01/event/addressable-events.test.ts",
      "tests/nip01/event/event-ordering-integration.test.ts",
      "tests/nip01/event/nostr-publish.test.ts",
      "tests/nip01/nostr.test.ts",
      "tests/nip01/relay/filters.test.ts",
      "tests/nip01/relay/relay-reconnect.test.ts",
      "tests/nip01/relay/relay.test.ts",
      "tests/nip01/relay/relayEventStore.test.ts",
    ]
      .map(read)
      .join("\n");

    for (const legacyAdapter of [
      "NostrInternals",
      "getNostrInternals",
      "RelayTestAccess",
      "asTestRelay",
      "NostrPrivateMembers",
      "asTestable",
    ]) {
      expect(testSupport).not.toContain(legacyAdapter);
      expect(behaviorTests).not.toContain(legacyAdapter);
    }
  });

  test("removes named broad private-shape casts from targeted NIP tests", () => {
    const targetedTests = [
      "tests/nip46/core-functionality.test.ts",
      "tests/nip46/performance-security.test.ts",
      "tests/nip46/protocol-core.test.ts",
      "tests/nip47/client-encryption-tracking-simple.test.ts",
      "tests/nip47/nip47.test.ts",
    ]
      .map(read)
      .join("\n");

    for (const privateShape of [
      "BunkerWithInternals",
      "ClientWithInternals",
      "ClientWithPrivateMethods",
      "ClientInitializationState",
      "ServiceWithMockAccess",
      "ServiceWithPrivates",
      "clientWithInternals",
      "clientWithPrivates",
      "engineInternals",
      "serviceWithPrivates",
    ]) {
      expect(targetedTests).not.toContain(privateShape);
    }
  });

  test("keeps testing-entrypoint controls narrow and behavior-oriented", () => {
    const testingEntrypoints = [
      "src/testing/behavior-controls.ts",
      "src/testing/index.ts",
    ]
      .map(read)
      .join("\n");

    for (const broadControl of [
      "installNip47ClientInitializationHooks",
      "NIP47ClientInitializationHooks",
      "NIP47ClientInitializationTransport",
      "processNip47ServiceRequest",
      "encryptionRetained",
      "requestEncryption.has",
    ]) {
      expect(testingEntrypoints).not.toContain(broadControl);
    }
  });
});
