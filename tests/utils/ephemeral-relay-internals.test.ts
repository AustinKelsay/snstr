import { readFileSync } from "fs";
import { resolve } from "path";

const facadeSource = readFileSync(
  resolve(process.cwd(), "src/utils/ephemeral-relay.ts"),
  "utf8",
);
const sessionSource = readFileSync(
  resolve(process.cwd(), "src/utils/ephemeral-relay/client-session.ts"),
  "utf8",
);
const packageManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { exports: Record<string, unknown> };

describe("ephemeral Relay internal ownership", () => {
  test("Subscription Filter matching is owned by its internal module", () => {
    expect(sessionSource).toContain('from "./filter-match"');
    expect(facadeSource).not.toMatch(/function match_filter\s*\(/);
    expect(facadeSource).not.toMatch(/function match_tags\s*\(/);
  });

  test("client-session protocol state is owned by its internal module", () => {
    expect(facadeSource).toContain('from "./ephemeral-relay/client-session"');
    expect(facadeSource).not.toMatch(/class ClientSession\s*{/);
  });

  test("client sessions depend on a narrow host instead of the Relay facade", () => {
    expect(sessionSource).toContain("export interface RelaySessionHost");
    expect(sessionSource).not.toContain('from "../ephemeral-relay"');
    expect(facadeSource).toContain("createClientSession");
    expect(facadeSource).not.toMatch(/instance\._(?:handler|onerr|cleanup)/);
  });

  test("connection lifecycle is owned by its internal transport module", () => {
    expect(facadeSource).toContain('from "./ephemeral-relay/transport"');
    expect(facadeSource).not.toContain("new WebSocketServer");
    expect(facadeSource).not.toContain("registerInMemoryServer");
    expect(facadeSource).not.toContain("unregisterInMemoryServer");
    expect(facadeSource).not.toContain("closeWebSocketTransport");
    expect(facadeSource).not.toContain("_acceptingConnections");
  });

  test("private Relay owners do not become package entrypoints", () => {
    expect(packageManifest.exports).not.toHaveProperty(
      "./utils/ephemeral-relay/client-session",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./utils/ephemeral-relay/filter-match",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./utils/ephemeral-relay/transport",
    );
  });
});
