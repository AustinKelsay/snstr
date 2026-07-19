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
import { diagnosticFailureType } from "../../src/utils/diagnostics";
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

class ControlledWebSocket {
  static latest: ControlledWebSocket | undefined;
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor() {
    ControlledWebSocket.latest = this;
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
    this.onclose?.({});
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }
}

describe("shared production diagnostic seam", () => {
  afterEach(() => {
    ControlledWebSocket.latest = undefined;
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

  test("does not forward unknown relay wire types into warning context", async () => {
    const logger = createLogger();
    const secret = "secret-token";
    useWebSocketImplementation(
      ControlledWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://relay.example", {
      autoReconnect: false,
      logger,
    });

    const connection = relay.connect();
    ControlledWebSocket.latest?.open();
    await expect(connection).resolves.toBe(true);
    ControlledWebSocket.latest?.receive(
      JSON.stringify([secret, "untrusted payload"]),
    );

    expect(logger.warn).toHaveBeenCalledWith("Unknown relay message type", {
      itemCount: 1,
      messageType: "unknown",
      relay: "wss://relay.example",
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(secret);
    relay.disconnect();
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

  test("applies a replacement logger when RelayPool reconfigures an existing Relay", async () => {
    const originalLogger = createLogger();
    const replacementLogger = createLogger();
    useWebSocketImplementation(
      ThrowingWebSocket as unknown as typeof WebSocket,
    );
    const pool = new RelayPool([], { logger: originalLogger });

    pool.addRelay("wss://relay.example", { autoReconnect: false });
    const relay = pool.addRelay("wss://relay.example", {
      logger: replacementLogger,
    });
    await expect(relay.connect()).resolves.toBe(false);

    expect(replacementLogger.error).toHaveBeenCalledWith(
      "Connection failed",
      expect.objectContaining({ relay: "wss://relay.example" }),
    );
    expect(originalLogger.error).not.toHaveBeenCalled();
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

  test("bounds Error names before using them as failure metadata", () => {
    const safeError = new Error("not forwarded");
    safeError.name = "NostrValidationError";
    const unsafeError = new Error("not forwarded");
    unsafeError.name = "secret-token";
    const overlongError = new Error("not forwarded");
    overlongError.name = `${"A".repeat(64)}Error`;

    expect(diagnosticFailureType(safeError)).toBe("NostrValidationError");
    expect(diagnosticFailureType(unsafeError)).toBe("Error");
    expect(diagnosticFailureType(overlongError)).toBe("Error");
  });

  test("propagates default parent logger policies to child Relays", async () => {
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    useWebSocketImplementation(
      ThrowingWebSocket as unknown as typeof WebSocket,
    );

    const pool = new RelayPool();
    const pooledRelay = pool.addRelay("wss://pool.example", {
      autoReconnect: false,
    });
    await expect(pooledRelay.connect()).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[RelayPool] Connection failed"),
      expect.any(Object),
    );

    error.mockClear();
    const client = new Nostr(["wss://nostr.example"], {
      relayOptions: { autoReconnect: false },
    });
    await client.connectToRelays();
    expect(error).not.toHaveBeenCalled();
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
