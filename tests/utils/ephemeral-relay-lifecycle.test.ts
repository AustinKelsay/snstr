import type { DiagnosticLogger } from "../../src/utils/logger";
import type { NostrEvent } from "../../src/types/nostr";
import { Relay } from "../../src/nip01/relay";
import { RelayEvent } from "../../src/types/nostr";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createEvent, createSignedEvent } from "../../src/nip01/event";
import { getPublicKey } from "../../src/utils/crypto";

const PRIVATE_KEY = "1".repeat(64);

async function createRelayEvent(content: string): Promise<NostrEvent> {
  const event = createEvent(
    {
      kind: 1,
      tags: [],
      content,
      created_at: Math.floor(Date.now() / 1000),
    },
    getPublicKey(PRIVATE_KEY),
  );

  return createSignedEvent(event, PRIVATE_KEY);
}

function createDiagnosticLogger() {
  const error = jest.fn();
  const warn = jest.fn();
  const info = jest.fn();
  const debug = jest.fn();
  const trace = jest.fn();
  const logger: DiagnosticLogger = { error, warn, info, debug, trace };

  return { logger, error, warn, info, debug, trace };
}

function createThrowingDiagnosticLogger(): DiagnosticLogger {
  const throwDiagnosticError = () => {
    throw new Error("diagnostic logger failed");
  };

  return {
    error: jest.fn(throwDiagnosticError),
    warn: jest.fn(throwDiagnosticError),
    info: jest.fn(throwDiagnosticError),
    debug: jest.fn(throwDiagnosticError),
    trace: jest.fn(throwDiagnosticError),
  };
}

function spyOnConsoleDiagnostics() {
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});

  return {
    log,
    warn,
    error,
    restore: () => {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    },
  };
}

async function withInMemoryTransport(run: () => Promise<void>): Promise<void> {
  const globals = globalThis as typeof globalThis & { Bun?: unknown };
  const isBun = typeof globals.Bun !== "undefined";
  const hadBun = Object.prototype.hasOwnProperty.call(globals, "Bun");
  const previousBun = globals.Bun;
  if (!isBun) globals.Bun = {};

  try {
    await run();
  } finally {
    if (!isBun) {
      if (hadBun) globals.Bun = previousBun;
      else delete globals.Bun;
    }
  }
}

async function waitFor(
  condition: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for public Relay behavior");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function expectRestartClearsTransientState(): Promise<void> {
  const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
  const relay = new NostrRelay(0);
  await relay.start();
  const publisher = new Relay(relay.url, {
    autoReconnect: false,
    connectionTimeout: 1000,
  });
  const oldSubscriber = new Relay(relay.url, {
    autoReconnect: false,
    connectionTimeout: 1000,
  });
  let restartedClient: Relay | null = null;

  try {
    expect(await publisher.connect()).toBe(true);
    expect(await oldSubscriber.connect()).toBe(true);
    const eventsOnOldSubscription: NostrEvent[] = [];
    oldSubscriber.subscribe([{ kinds: [1] }], (event) =>
      eventsOnOldSubscription.push(event),
    );

    const eventBeforeClose = await createRelayEvent("removed during shutdown");
    await expect(
      publisher.publish(eventBeforeClose, { timeout: 1000 }),
    ).resolves.toMatchObject({ success: true });
    await waitFor(() => eventsOnOldSubscription.length === 1);

    await relay.close();
    await relay.start();
    restartedClient = new Relay(relay.url, {
      autoReconnect: false,
      connectionTimeout: 1000,
    });
    expect(await restartedClient.connect()).toBe(true);

    const eventAfterRestart = await createRelayEvent("new lifecycle");
    await expect(
      restartedClient.publish(eventAfterRestart, { timeout: 1000 }),
    ).resolves.toMatchObject({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(eventsOnOldSubscription.map((event) => event.id)).toEqual([
      eventBeforeClose.id,
    ]);

    const restoredEvents: NostrEvent[] = [];
    const endOfStoredEvents = new Promise<void>((resolve) => {
      restartedClient!.subscribe(
        [{ ids: [eventBeforeClose.id] }],
        (event) => restoredEvents.push(event),
        resolve,
      );
    });
    await endOfStoredEvents;
    expect(restoredEvents).toEqual([]);
  } finally {
    publisher.disconnect();
    oldSubscriber.disconnect();
    restartedClient?.disconnect();
    await relay.close();
  }
}

describe("NostrRelay lifecycle", () => {
  test("construction is quiet by default", async () => {
    const consoleDiagnostics = spyOnConsoleDiagnostics();

    try {
      const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
      new NostrRelay(0);

      expect(consoleDiagnostics.log).not.toHaveBeenCalled();
      expect(consoleDiagnostics.warn).not.toHaveBeenCalled();
      expect(consoleDiagnostics.error).not.toHaveBeenCalled();
    } finally {
      consoleDiagnostics.restore();
    }
  });

  test("lifecycle and protocol use stay quiet without an injected logger", async () => {
    const previousDebug = process.env["DEBUG"];
    const consoleDiagnostics = spyOnConsoleDiagnostics();
    const event = await createRelayEvent("quiet lifecycle");

    try {
      process.env["DEBUG"] = "true";
      const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
      const relay = new NostrRelay(0);
      let client: Relay | null = null;

      try {
        await relay.start();
        client = new Relay(relay.url, {
          autoReconnect: false,
          connectionTimeout: 1000,
        });
        expect(await client.connect()).toBe(true);
        await expect(
          client.publish(event, { timeout: 1000 }),
        ).resolves.toMatchObject({ success: true });
      } finally {
        client?.disconnect();
        await relay.close();
      }

      expect(consoleDiagnostics.log).not.toHaveBeenCalled();
      expect(consoleDiagnostics.warn).not.toHaveBeenCalled();
      expect(consoleDiagnostics.error).not.toHaveBeenCalled();
    } finally {
      if (previousDebug === undefined) {
        delete process.env["DEBUG"];
      } else {
        process.env["DEBUG"] = previousDebug;
      }
      consoleDiagnostics.restore();
    }
  });

  test("reports lifecycle diagnostics only through an injected logger", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const { logger, info } = createDiagnosticLogger();
    const relay = new NostrRelay(0, { logger });

    await relay.start();
    await relay.close();

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "Relay started",
      "Relay closed",
    ]);
  });

  test("a throwing diagnostic logger cannot alter Relay lifecycle behavior", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const relay = new NostrRelay(0, {
      logger: createThrowingDiagnosticLogger(),
    });
    const event = await createRelayEvent("throwing diagnostics");
    let client: Relay | null = null;

    try {
      await expect(relay.start()).resolves.toBe(relay);
      client = new Relay(relay.url, {
        autoReconnect: false,
        connectionTimeout: 1000,
      });
      expect(await client.connect()).toBe(true);
      await expect(
        client.publish(event, { timeout: 1000 }),
      ).resolves.toMatchObject({ success: true });
      await expect(relay.close()).resolves.toBeUndefined();
    } finally {
      client?.disconnect();
      await relay.close();
    }
  });

  test("a failed fixed-port start can retry after the port is released", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === "string") {
      throw new Error("Fixed-port blocker has no TCP port");
    }
    const relay = new NostrRelay(address.port);

    try {
      await expect(relay.start()).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await expect(relay.start()).resolves.toBe(relay);
      expect(relay.wss.address()).not.toBeNull();
    } finally {
      if (blocker.listening) {
        await new Promise<void>((resolve) => blocker.close(() => resolve()));
      }
      await relay.close();
    }
  });

  test("the legacy numeric purge interval remains compatible", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const relay = new NostrRelay(0, 0.01);
    const event = await createRelayEvent("legacy purge interval");

    try {
      await relay.start();
      relay.store(event);
      await waitFor(() => relay.cache.length === 0);

      expect(relay.cache).toEqual([]);
    } finally {
      await relay.close();
    }
  });

  test("a repeated close waits for the active shutdown", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const relay = new NostrRelay(0);
    await relay.start();

    let shutdownComplete = false;
    const shutdown = relay.close().then(() => {
      shutdownComplete = true;
    });

    await relay.close();

    expect(shutdownComplete).toBe(true);
    await shutdown;
  });

  test("close disconnects an active Relay before it resolves", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const relay = new NostrRelay(0);
    await relay.start();
    const client = new Relay(relay.url, {
      autoReconnect: false,
      connectionTimeout: 1000,
    });
    let disconnected = false;
    client.on(RelayEvent.Disconnect, () => {
      disconnected = true;
    });

    try {
      expect(await client.connect()).toBe(true);
      await relay.close();

      expect(disconnected).toBe(true);
      expect(relay.conn).toBe(0);
    } finally {
      client.disconnect();
      await relay.close();
    }
  });

  test("shutdown does not accept a new Relay connection", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const relay = new NostrRelay(0);
    await relay.start();
    const firstClient = new Relay(relay.url, {
      autoReconnect: false,
      connectionTimeout: 1000,
    });
    const lateClients: Relay[] = [];

    try {
      expect(await firstClient.connect()).toBe(true);
      const relayUrl = relay.url;
      const shutdown = relay.close();
      const lateConnections = Array.from({ length: 4 }, () => {
        const client = new Relay(relayUrl, {
          autoReconnect: false,
          connectionTimeout: 500,
        });
        lateClients.push(client);
        return client.connect();
      });

      const results = await Promise.all(lateConnections);
      await shutdown;

      expect(results).toEqual([false, false, false, false]);
      expect(relay.conn).toBe(0);
    } finally {
      firstClient.disconnect();
      lateClients.forEach((client) => client.disconnect());
      await relay.close();
    }
  });

  test("in-memory close waits for observable Relay cleanup", async () => {
    await withInMemoryTransport(async () => {
      const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
      const relay = new NostrRelay(0);
      let disconnected = false;

      try {
        await relay.start();
        const inMemoryClient = new Relay(relay.url, {
          autoReconnect: false,
          connectionTimeout: 1000,
        });
        inMemoryClient.on(RelayEvent.Disconnect, () => {
          disconnected = true;
        });
        expect(await inMemoryClient.connect()).toBe(true);

        await relay.close();

        expect(disconnected).toBe(true);
        expect(relay.conn).toBe(0);
        inMemoryClient.disconnect();
      } finally {
        await relay.close();
      }
    });
  });

  test("restart waits for shutdown and accepts a new Relay connection", async () => {
    const { NostrRelay } = await import("../../src/utils/ephemeral-relay");
    const { logger, info } = createDiagnosticLogger();
    const relay = new NostrRelay(0, { logger });
    await relay.start();

    const firstClient = new Relay(relay.url, {
      autoReconnect: false,
      connectionTimeout: 1000,
    });
    expect(await firstClient.connect()).toBe(true);
    info.mockClear();

    const shutdown = relay.close();
    const restarted = relay.start();
    await restarted;
    await shutdown;

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "Relay closed",
      "Relay started",
    ]);

    const secondClient = new Relay(relay.url, {
      autoReconnect: false,
      connectionTimeout: 1000,
    });
    expect(await secondClient.connect()).toBe(true);

    firstClient.disconnect();
    secondClient.disconnect();
    await relay.close();
  });

  test("restart does not expose Nostr Events stored before close", async () => {
    await expectRestartClearsTransientState();
  });

  test("in-memory restart clears subscriptions and stored Nostr Events", async () => {
    await withInMemoryTransport(expectRestartClearsTransientState);
  });

  test("a purge interval does not keep an in-memory Relay process alive", async () => {
    const script = [
      "globalThis.Bun = {};",
      "const { NostrRelay } = require('./src/utils/ephemeral-relay');",
      "new NostrRelay(0, { purgeInterval: 0.01 }).start();",
    ].join("\n");
    const child = spawn(
      process.execPath,
      ["-r", "ts-node/register/transpile-only", "-e", script],
      { cwd: process.cwd(), stdio: "ignore" },
    );

    const exitCode = await new Promise<number | null>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
        resolve(null);
      }, 2000);

      child.once("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    expect(exitCode).toBe(0);
  });
});
