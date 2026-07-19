import { EventEmitter } from "events";
import { WebSocket, WebSocketServer } from "ws";
import {
  InMemoryWebSocketServer,
  registerInMemoryServer,
  unregisterInMemoryServer,
} from "../inMemoryWebSocket";
import type { DiagnosticLogArgument, DiagnosticLogger } from "../logger";
import { maybeUnref } from "../timers";

export interface RelayTransport {
  readonly actualPort: number | null;
  readonly server: WebSocketServer;
  start(): Promise<void>;
  close(
    closeSessions: () => Promise<void>,
    forceSessions: () => void,
  ): Promise<void>;
}

interface RelayTransportOptions {
  port: number;
  logger: DiagnosticLogger;
  onConnection(socket: WebSocket): void;
}

function toDiagnosticArgument(value: unknown): DiagnosticLogArgument {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "object"
  ) {
    return value;
  }

  return String(value);
}

export function createRelayTransport(
  options: RelayTransportOptions,
): RelayTransport {
  return new ManagedRelayTransport(options);
}

class ManagedRelayTransport implements RelayTransport {
  private readonly port: number;
  private readonly logger: DiagnosticLogger;
  private readonly onConnection: (socket: WebSocket) => void;
  private webSocketServer: WebSocketServer | null = null;
  private inMemoryServer: InMemoryWebSocketServer | null = null;
  private acceptingConnections = false;
  private boundPort: number | null = null;

  constructor(options: RelayTransportOptions) {
    this.port = options.port;
    this.logger = options.logger;
    this.onConnection = options.onConnection;
  }

  get actualPort(): number | null {
    return this.boundPort;
  }

  get server(): WebSocketServer {
    if (!this.webSocketServer) {
      throw new Error("websocket server not initialized");
    }
    return this.webSocketServer;
  }

  async start(): Promise<void> {
    // Bun on Linux CI has shown flakiness with real TCP listeners (port 0 /
    // ephemeral ports). Prefer the in-memory transport for deterministic tests.
    if (
      this.port === 0 &&
      typeof (globalThis as unknown as { Bun?: unknown }).Bun !== "undefined"
    ) {
      await this.startInMemory();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const server = new WebSocketServer({
          port: this.port,
          host: "127.0.0.1",
        });
        this.webSocketServer = server;
        server.on("connection", (socket) => this.accept(socket));

        const cleanup = () => {
          server.off("listening", onListening);
          server.off("error", onError);
        };

        const onListening = () => {
          cleanup();
          const address = server.address();
          if (address && typeof address === "object" && "port" in address) {
            this.boundPort =
              typeof address.port === "number" && address.port > 0
                ? address.port
                : null;
          }

          // Some compatibility runtimes can bind port 0 without reporting the
          // selected port. Use the in-memory transport instead of exposing :0.
          if (this.port === 0 && !this.boundPort) {
            this.resetFailedWebSocketServer(server);
            this.startInMemory().then(resolve).catch(reject);
            return;
          }

          this.acceptingConnections = true;
          resolve();
        };

        const onError = (error: unknown) => {
          cleanup();
          if (this.shouldFallbackToInMemory(error)) {
            this.resetFailedWebSocketServer(server);
            this.startInMemory().then(resolve).catch(reject);
          } else {
            this.resetFailedWebSocketServer(server);
            reject(error);
          }
        };

        server.once("listening", onListening);
        server.once("error", onError);
      } catch (error) {
        if (this.shouldFallbackToInMemory(error)) {
          this.startInMemory().then(resolve).catch(reject);
        } else {
          reject(error);
        }
      }
    });
  }

  async close(
    closeSessions: () => Promise<void>,
    forceSessions: () => void,
  ): Promise<void> {
    this.acceptingConnections = false;

    const inMemoryServer = this.inMemoryServer;
    const webSocketServer = inMemoryServer ? null : this.webSocketServer;
    const transportShutdown = webSocketServer
      ? this.closeWebSocketTransport(webSocketServer)
      : Promise.resolve();

    if (inMemoryServer) {
      unregisterInMemoryServer(this.boundPort || this.port);
      await closeSessions();
      inMemoryServer.removeAllListeners();
    } else if (webSocketServer) {
      const sessionShutdown = closeSessions();
      let sessionTimeout: NodeJS.Timeout | null = null;
      const timedOut = new Promise<boolean>((resolve) => {
        sessionTimeout = setTimeout(() => resolve(true), 1000);
        maybeUnref(sessionTimeout);
      });
      const sessionsClosed = sessionShutdown.then(() => false);

      if (await Promise.race([sessionsClosed, timedOut])) {
        this.logger.warn("Relay client close timed out; forcing cleanup");
        forceSessions();
        await sessionShutdown;
      }
      if (sessionTimeout) clearTimeout(sessionTimeout);

      await transportShutdown;
      webSocketServer.removeAllListeners();
    }

    this.inMemoryServer = null;
    this.webSocketServer = null;
    this.boundPort = null;
  }

  private accept(socket: WebSocket): void {
    if (!this.acceptingConnections) {
      try {
        socket.terminate();
      } catch {
        try {
          socket.close(1001, "Relay shutting down");
        } catch {
          // The Relay is already closing; there is no session state to retain.
        }
      }
      return;
    }

    this.onConnection(socket);
  }

  private startInMemory(): Promise<void> {
    const { server, port } = registerInMemoryServer(
      this.port === 0 ? undefined : this.port,
    );

    this.inMemoryServer = server;
    this.webSocketServer = server as unknown as WebSocketServer;
    this.boundPort = port;
    server.on("connection", (socket: EventEmitter) =>
      this.accept(socket as WebSocket),
    );
    this.acceptingConnections = true;

    return new Promise((resolve) => queueMicrotask(resolve));
  }

  private shouldFallbackToInMemory(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const code =
      "code" in error && typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
    const message =
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
    // In restricted runtimes, binding to port 0 may report EADDRINUSE even
    // though no specific port was requested; fall back to in-memory relay.
    const isDynamicPortConflict =
      this.port === 0 &&
      (code === "EADDRINUSE" || message.includes("EADDRINUSE"));
    return (
      isDynamicPortConflict ||
      code === "EACCES" ||
      code === "EPERM" ||
      code === "EADDRNOTAVAIL" ||
      message.includes("EPERM") ||
      message.includes("EACCES") ||
      message.includes("EADDRNOTAVAIL")
    );
  }

  private resetFailedWebSocketServer(server: WebSocketServer): void {
    server.removeAllListeners();
    try {
      server.close();
    } catch {
      // A listener that failed to bind may already be fully closed.
    }
    if (this.webSocketServer === server) this.webSocketServer = null;
    this.boundPort = null;
    this.acceptingConnections = false;
  }

  private closeWebSocketTransport(server: WebSocketServer): Promise<void> {
    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout | null = null;
      const finish = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        resolve();
      };

      timeout = setTimeout(() => {
        this.logger.warn("Relay transport close timed out; forcing cleanup");
        finish();
      }, 1000);
      maybeUnref(timeout);

      try {
        // Calling close immediately stops the transport accepting new sockets;
        // its callback still waits for tracked sessions to drain.
        server.close(finish);
      } catch (error) {
        this.logger.warn("Relay transport close failed", {
          error: toDiagnosticArgument(error),
        });
        finish();
      }
    });
  }
}
