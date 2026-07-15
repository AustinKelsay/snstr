import { once } from "node:events";
import { createServer, type Server as HttpServer } from "node:http";
import type { Socket } from "node:net";
import {
  WebSocket as NativeWebSocket,
  WebSocketServer as NativeWebSocketServer,
} from "ws";
import {
  Relay,
  RelayEvent,
  resetWebSocketImplementation,
  useWebSocketImplementation,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

const isBunRuntime =
  typeof (globalThis as typeof globalThis & { Bun?: unknown }).Bun !==
  "undefined";

/**
 * Models a native transport whose peer close callback is delivered in the
 * next event-loop turn after the socket itself reports closed.
 */
class NextTurnCloseWebSocket extends NativeWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    let closeHandler: ((event: unknown) => void) | null = null;

    Object.defineProperty(this, "onclose", {
      configurable: true,
      get: () => closeHandler,
      set: (handler: ((event: unknown) => void) | null) => {
        closeHandler = handler;
      },
    });
    this.once("close", (code, reason) => {
      setImmediate(() => {
        closeHandler?.({ type: "close", code, reason: reason.toString() });
      });
    });
  }
}

async function waitForLateNativeClose(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function startNativeWebSocketServer(port = 0): Promise<{
  httpServer: HttpServer;
  port: number;
  server: NativeWebSocketServer;
  sockets: Set<Socket>;
  url: string;
}> {
  const httpServer = createServer();
  const sockets = new Set<Socket>();
  httpServer.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  const server = new NativeWebSocketServer({ server: httpServer });
  httpServer.listen(port, "127.0.0.1");
  await once(httpServer, "listening");
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Native WebSocket test server has no TCP port");
  }

  return {
    httpServer,
    port: address.port,
    server,
    sockets,
    url: `ws://127.0.0.1:${address.port}`,
  };
}

async function closeNativeWebSocketServer(
  server: NativeWebSocketServer,
  httpServer: HttpServer,
  sockets: Set<Socket>,
): Promise<void> {
  await Promise.all(
    [...server.clients].map(
      (client) =>
        new Promise<void>((resolve) => {
          if (client.readyState === NativeWebSocket.CLOSED) {
            resolve();
            return;
          }

          client.once("close", () => resolve());
          client.terminate();
        }),
    ),
  );
  if (server.address() !== null) {
    const closed = once(server, "close");
    server.close();
    await closed;
  }

  if (!httpServer.listening) return;
  await Promise.all(
    [...sockets].map(
      (socket) =>
        new Promise<void>((resolve) => {
          if (socket.destroyed) {
            resolve();
            return;
          }

          socket.once("close", () => resolve());
          socket.destroy();
        }),
    ),
  );
  httpServer.closeAllConnections();
  if (isBunRuntime) {
    httpServer.close();
    if (httpServer.listening || httpServer.address() !== null) {
      throw new Error("Native WebSocket test listener did not close");
    }
    return;
  }

  const listenerClosed = once(httpServer, "close");
  httpServer.close();
  await listenerClosed;
}

async function reserveNativeWebSocketPort(): Promise<number> {
  const { port, server, httpServer, sockets } =
    await startNativeWebSocketServer();
  await closeNativeWebSocketServer(server, httpServer, sockets);
  return port;
}

describe("NostrRelay close ordering", () => {
  afterEach(() => {
    resetWebSocketImplementation();
  });

  test("close waits for a next-turn peer disconnect notification", async () => {
    useWebSocketImplementation(
      NextTurnCloseWebSocket as unknown as typeof WebSocket,
    );
    const relay = new NostrRelay(0);
    let client: Relay | null = null;
    let disconnectCount = 0;

    try {
      await relay.start();
      client = new Relay(relay.url, {
        autoReconnect: false,
        connectionTimeout: 1000,
      });
      client.on(RelayEvent.Disconnect, () => {
        disconnectCount += 1;
      });
      expect(await client.connect()).toBe(true);

      await relay.close();

      expect(disconnectCount).toBe(1);
      expect(relay.conn).toBe(0);
      await waitForLateNativeClose();
      expect(disconnectCount).toBe(1);
    } finally {
      client?.disconnect();
      await relay.close();
      await waitForLateNativeClose();
    }
  });

  test("close notifies only Relay clients connected to its exact URL", async () => {
    useWebSocketImplementation(
      NextTurnCloseWebSocket as unknown as typeof WebSocket,
    );
    const firstRelay = new NostrRelay(0);
    const secondRelay = new NostrRelay(0);
    let firstClient: Relay | null = null;
    let secondClient: Relay | null = null;
    let firstDisconnects = 0;
    let secondDisconnects = 0;

    try {
      await Promise.all([firstRelay.start(), secondRelay.start()]);
      firstClient = new Relay(firstRelay.url, { autoReconnect: false });
      secondClient = new Relay(secondRelay.url, { autoReconnect: false });
      firstClient.on(RelayEvent.Disconnect, () => {
        firstDisconnects += 1;
      });
      secondClient.on(RelayEvent.Disconnect, () => {
        secondDisconnects += 1;
      });
      expect(
        await Promise.all([firstClient.connect(), secondClient.connect()]),
      ).toEqual([true, true]);

      await firstRelay.close();

      expect(firstDisconnects).toBe(1);
      expect(secondDisconnects).toBe(0);
      expect(await secondClient.connect()).toBe(true);

      await secondRelay.close();
      expect(secondDisconnects).toBe(1);
    } finally {
      firstClient?.disconnect();
      secondClient?.disconnect();
      await Promise.all([firstRelay.close(), secondRelay.close()]);
      await waitForLateNativeClose();
    }
  });

  test("manual disconnect unregisters coordinated close finalization", async () => {
    useWebSocketImplementation(
      NextTurnCloseWebSocket as unknown as typeof WebSocket,
    );
    const relay = new NostrRelay(0);
    let client: Relay | null = null;
    let disconnectCount = 0;

    try {
      await relay.start();
      client = new Relay(relay.url, { autoReconnect: false });
      client.on(RelayEvent.Disconnect, () => {
        disconnectCount += 1;
      });
      expect(await client.connect()).toBe(true);

      client.disconnect();
      expect(disconnectCount).toBe(1);
      await relay.close();
      await waitForLateNativeClose();

      expect(disconnectCount).toBe(1);
    } finally {
      client?.disconnect();
      await relay.close();
      await waitForLateNativeClose();
    }
  });

  test("close before start does not notify a foreign Relay at the same URL", async () => {
    useWebSocketImplementation(
      NativeWebSocket as unknown as typeof WebSocket,
    );
    const foreignTransport = await startNativeWebSocketServer();
    const dormantRelay = new NostrRelay(foreignTransport.port);
    const foreignClient = new Relay(foreignTransport.url, {
      autoReconnect: false,
    });
    let foreignDisconnects = 0;
    foreignClient.on(RelayEvent.Disconnect, () => {
      foreignDisconnects += 1;
    });

    try {
      expect(await foreignClient.connect()).toBe(true);

      await dormantRelay.close();

      expect(foreignDisconnects).toBe(0);
      expect(await foreignClient.connect()).toBe(true);
    } finally {
      foreignClient.disconnect();
      await dormantRelay.close();
      await closeNativeWebSocketServer(
        foreignTransport.server,
        foreignTransport.httpServer,
        foreignTransport.sockets,
      );
    }
  });

  test("repeated close does not notify a foreign Relay after port reuse", async () => {
    useWebSocketImplementation(
      NativeWebSocket as unknown as typeof WebSocket,
    );
    const port = await reserveNativeWebSocketPort();
    const relay = new NostrRelay(port);
    const firstClient = new Relay(relay.url, { autoReconnect: false });
    let firstDisconnects = 0;
    firstClient.on(RelayEvent.Disconnect, () => {
      firstDisconnects += 1;
    });
    let foreignTransport: Awaited<
      ReturnType<typeof startNativeWebSocketServer>
    > | null = null;
    let foreignClient: Relay | null = null;
    let foreignDisconnects = 0;

    try {
      await relay.start();
      expect(await firstClient.connect()).toBe(true);
      await relay.close();
      expect(firstDisconnects).toBe(1);

      foreignTransport = await startNativeWebSocketServer(port);
      foreignClient = new Relay(foreignTransport.url, {
        autoReconnect: false,
      });
      foreignClient.on(RelayEvent.Disconnect, () => {
        foreignDisconnects += 1;
      });
      expect(await foreignClient.connect()).toBe(true);

      await relay.close();

      expect(foreignDisconnects).toBe(0);
      expect(await foreignClient.connect()).toBe(true);
    } finally {
      firstClient.disconnect();
      foreignClient?.disconnect();
      await relay.close();
      if (foreignTransport) {
        await closeNativeWebSocketServer(
          foreignTransport.server,
          foreignTransport.httpServer,
          foreignTransport.sockets,
        );
      }
    }
  });

  test("restart coordinates only the Relay client from each lifecycle", async () => {
    useWebSocketImplementation(
      NextTurnCloseWebSocket as unknown as typeof WebSocket,
    );
    const port = await reserveNativeWebSocketPort();
    const relay = new NostrRelay(port);
    const expectedUrl = `ws://127.0.0.1:${port}`;
    let firstClient: Relay | null = null;
    let secondClient: Relay | null = null;
    let firstDisconnects = 0;
    let secondDisconnects = 0;

    try {
      await relay.start();
      expect(relay.url).toBe(expectedUrl);
      firstClient = new Relay(relay.url, { autoReconnect: false });
      firstClient.on(RelayEvent.Disconnect, () => {
        firstDisconnects += 1;
      });
      expect(await firstClient.connect()).toBe(true);
      await relay.close();
      expect(firstDisconnects).toBe(1);

      await relay.start();
      expect(relay.url).toBe(expectedUrl);
      secondClient = new Relay(relay.url, { autoReconnect: false });
      secondClient.on(RelayEvent.Disconnect, () => {
        secondDisconnects += 1;
      });
      expect(await secondClient.connect()).toBe(true);
      await relay.close();
      await waitForLateNativeClose();

      expect(firstDisconnects).toBe(1);
      expect(secondDisconnects).toBe(1);
    } finally {
      firstClient?.disconnect();
      secondClient?.disconnect();
      await relay.close();
      await waitForLateNativeClose();
    }
  });
});
