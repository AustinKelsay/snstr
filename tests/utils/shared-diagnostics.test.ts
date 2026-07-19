import fs from "fs";
import path from "path";
import {
  Nostr,
  Relay,
  RelayPool,
  resetWebSocketImplementation,
  useWebSocketImplementation,
} from "../../src";
import type { NostrEvent } from "../../src";
import type { DiagnosticLogger } from "../../src/utils/logger";
import { createRelayListEvent } from "../../src/nip65";
import { fetchRelayInformation } from "../../src/nip11";

function createLogger(): jest.Mocked<DiagnosticLogger> {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

class ThrowingWebSocket {
  constructor() {
    throw new TypeError("socket construction failed");
  }
}

describe("shared production diagnostic seam", () => {
  afterEach(() => {
    resetWebSocketImplementation();
    jest.restoreAllMocks();
  });

  test("keeps console ownership inside the canonical logger", () => {
    const sourceRoot = path.resolve(__dirname, "../../src");
    const loggerImplementation = path.join(sourceRoot, "utils/logger.ts");
    const offenders = sourceFiles(sourceRoot)
      .filter((filePath) => filePath !== loggerImplementation)
      .filter((filePath) =>
        /\bconsole\.(?:log|info|warn|error|debug|trace)\b/.test(
          fs.readFileSync(filePath, "utf8"),
        ),
      )
      .map((filePath) => path.relative(sourceRoot, filePath));

    expect(offenders).toEqual([]);
  });

  test("routes Relay connection failures through an injected non-throwing logger", async () => {
    const logger = createLogger();
    useWebSocketImplementation(
      ThrowingWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://relay.example", {
      autoReconnect: false,
      logger,
    });

    await expect(relay.connect()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith("Connection failed", {
      failureType: "TypeError",
      relay: "wss://relay.example",
    });

    logger.error.mockImplementation(() => {
      throw new Error("diagnostic sink unavailable");
    });
    await expect(relay.connect()).resolves.toBe(false);
  });

  test("uses one injected policy for RelayPool and its child Relays", async () => {
    const logger = createLogger();
    useWebSocketImplementation(
      ThrowingWebSocket as unknown as typeof WebSocket,
    );
    const pool = new RelayPool(["not a relay URL"], { logger });

    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to add relay during pool construction",
      expect.objectContaining({ failureType: expect.any(String) }),
    );

    const relay = pool.addRelay("wss://relay.example", {
      autoReconnect: false,
    });
    await expect(relay.connect()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "Connection failed",
      expect.objectContaining({ relay: "wss://relay.example" }),
    );
  });

  test("keeps Nostr public fallback behavior when its logger throws", async () => {
    const logger = createLogger();
    logger.warn.mockImplementation(() => {
      throw new Error("diagnostic sink unavailable");
    });
    const client = new Nostr([], { logger });
    const event = {
      id: "event-id",
      pubkey: "pubkey",
      created_at: 1,
      kind: 1,
      tags: [],
      content: "private content",
      sig: "signature",
    } as NostrEvent;

    await expect(client.publishEvent(event)).resolves.toEqual({
      success: false,
      event: null,
      relayResults: new Map(),
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "No relays configured for publishing",
      {
        eventId: "event-id",
        eventKind: 1,
        operation: "publishEvent",
      },
    );
  });

  test("configures stateless warning and error diagnostics without leaking inputs", async () => {
    const logger = createLogger();
    const secret = "secret-token";
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const relayList = createRelayListEvent(
      [{ url: `wss://user:${secret}@relay.example`, read: true, write: true }],
      "",
      logger,
    );
    await expect(
      fetchRelayInformation("not a websocket URL", { logger }),
    ).resolves.toBeNull();

    expect(relayList.tags).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify([logger.warn.mock.calls, logger.error.mock.calls]),
    ).not.toContain(secret);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test("keeps default stateless warnings visible through ConsoleLogger", () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    createRelayListEvent([{ url: "", read: true, write: true }]);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("keeps default Relay and RelayPool failures visible through ConsoleLogger", async () => {
    const secret = "secret-token";
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    useWebSocketImplementation(
      ThrowingWebSocket as unknown as typeof WebSocket,
    );

    new RelayPool(["not a relay URL"]);
    const relay = new Relay(
      `wss://user:${secret}@relay.example/private?token=${secret}`,
      { autoReconnect: false },
    );
    await expect(relay.connect()).resolves.toBe(false);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
  });
});
