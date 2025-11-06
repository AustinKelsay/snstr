/**********************************************************************
 * In-memory WebSocket transport used for environments where creating
 * actual TCP listeners is not permitted (e.g., sandboxed CI). This
 * module provides a minimal subset of the `ws` server/client behaviour
 * that the SNSTR test suite relies on:
 *   - Server side emits `connection`, `message`, `close`, `error`
 *   - Client side exposes the DOM-style WebSocket callbacks
 * The implementation is intentionally lightweight and only supports
 * text frames (strings), which is sufficient for Nostr messages.
 *********************************************************************/

import { EventEmitter } from "events";

export interface InMemoryServerSocket extends EventEmitter {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
}

export interface InMemoryClientSocket {
  readonly readyState: number;
  onopen: ((event: { type: "open" }) => void) | null;
  onclose: ((event: { type: "close"; code?: number; reason?: string }) => void) | null;
  onerror: ((event: { type: "error"; error: Error }) => void) | null;
  onmessage: ((event: { type: "message"; data: string }) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

class ServerSideSocket extends EventEmitter implements InMemoryServerSocket {
  public readyState = OPEN;
  private peer: ClientSideSocket | null = null;

  constructor(private readonly server: InMemoryWebSocketServer) {
    super();
  }

  attachPeer(peer: ClientSideSocket) {
    this.peer = peer;
  }

  receiveFromClient(data: string) {
    if (this.readyState !== OPEN) {
      return;
    }
    this.emit("message", data);
  }

  send(data: string) {
    if (this.readyState !== OPEN) {
      return;
    }
    const peer = this.peer;
    if (!peer) return;
    queueMicrotask(() => peer.receiveFromServer(data));
  }

  close(code = 1000, reason = "Server closing") {
    if (this.readyState === CLOSED) {
      return;
    }
    this.readyState = CLOSING;
    const peer = this.peer;
    queueMicrotask(() => {
      this.readyState = CLOSED;
      this.emit("close", code, reason);
      if (peer) {
        peer.handleServerClosure(code, reason);
      }
      this.server.deregister(this);
    });
  }

  terminate = () => {
    this.close(1006, "Server terminated");
  };
}

class ClientSideSocket implements InMemoryClientSocket {
  public readyState = CONNECTING;
  public onopen: ((event: { type: "open" }) => void) | null = null;
  public onclose: ((event: { type: "close"; code?: number; reason?: string }) => void) | null = null;
  public onerror: ((event: { type: "error"; error: Error }) => void) | null = null;
  public onmessage: ((event: { type: "message"; data: string }) => void) | null = null;

  constructor(private readonly serverSocket: ServerSideSocket) {
    this.serverSocket.attachPeer(this);
    queueMicrotask(() => {
      if (this.readyState !== CONNECTING) {
        return;
      }
      this.readyState = OPEN;
      this.onopen?.({ type: "open" });
    });
  }

  send(data: string) {
    if (this.readyState !== OPEN) {
      this.onerror?.({
        type: "error",
        error: new Error("Cannot send on closed WebSocket"),
      });
      return;
    }
    this.serverSocket.receiveFromClient(data);
  }

  close(code = 1000, reason = "Client closing") {
    if (this.readyState === CLOSED) {
      return;
    }
    if (this.readyState === CONNECTING) {
      this.readyState = CLOSING;
      this.serverSocket.close(code, reason);
      return;
    }
    this.readyState = CLOSING;
    this.serverSocket.close(code, reason);
  }

  receiveFromServer(data: string) {
    if (this.readyState !== OPEN) {
      return;
    }
    this.onmessage?.({ type: "message", data });
  }

  handleServerClosure(code = 1000, reason = "Server closed") {
    if (this.readyState === CLOSED) {
      return;
    }
    this.readyState = CLOSED;
    this.onclose?.({ type: "close", code, reason });
  }

  handleServerError(error: Error) {
    this.onerror?.({ type: "error", error });
  }
}

export class InMemoryWebSocketServer extends EventEmitter {
  public clients: Set<ServerSideSocket> = new Set();
  public readonly port: number;

  constructor(port: number) {
    super();
    this.port = port;
  }

  connectClient(): InMemoryClientSocket {
    const serverSocket = new ServerSideSocket(this);
    const clientSocket = new ClientSideSocket(serverSocket);
    this.clients.add(serverSocket);
    queueMicrotask(() => this.emit("connection", serverSocket));
    return clientSocket;
  }

  close() {
    for (const client of [...this.clients]) {
      client.close(1000, "Server shutting down");
    }
    this.emit("close");
  }

  deregister(socket: ServerSideSocket) {
    this.clients.delete(socket);
  }
}

const serverRegistry = new Map<number, InMemoryWebSocketServer>();
let nextDynamicPort = 64000;

function getNextPort(): number {
  while (serverRegistry.has(nextDynamicPort)) {
    nextDynamicPort++;
  }
  return nextDynamicPort++;
}

export function registerInMemoryServer(requestedPort?: number) {
  let port =
    typeof requestedPort === "number" && requestedPort > 0
      ? requestedPort
      : getNextPort();

  if (serverRegistry.has(port)) {
    port = getNextPort();
  }

  const server = new InMemoryWebSocketServer(port);
  serverRegistry.set(port, server);
  return { port, server };
}

export function getInMemoryServer(port: number): InMemoryWebSocketServer | undefined {
  return serverRegistry.get(port);
}

export function unregisterInMemoryServer(port: number) {
  const server = serverRegistry.get(port);
  if (server) {
    server.close();
    serverRegistry.delete(port);
  }
}

export function createInMemoryWebSocket(url: string): InMemoryClientSocket | undefined {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const normalizedHostname =
      hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
    const protocol = parsed.protocol;
    if (
      normalizedHostname !== "127.0.0.1" &&
      normalizedHostname !== "localhost" &&
      normalizedHostname !== "::1"
    ) {
      return undefined;
    }
    let port: number;
    if (parsed.port) {
      port = Number(parsed.port);
    } else if (protocol === "ws:") {
      port = 80;
    } else if (protocol === "wss:") {
      port = 443;
    } else {
      return undefined;
    }
    if (!Number.isFinite(port) || port <= 0) {
      return undefined;
    }
    const server = getInMemoryServer(port);
    if (!server) {
      return undefined;
    }
    return server.connectClient();
  } catch (_error) {
    return undefined;
  }
}
