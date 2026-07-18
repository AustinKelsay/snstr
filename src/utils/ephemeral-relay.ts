import EventEmitter from "events";
import { WebSocket, WebSocketServer } from "ws";
import { NostrEvent, NostrFilter } from "../types/nostr";
import {
  NostrMessage,
  NostrOkMessage,
  NostrEoseMessage,
} from "../types/protocol";
import { validateEvent } from "../nip01/event";
import { isValidPublicKeyPoint } from "../nip44";
import {
  validateArrayAccess,
  safeArrayAccess,
  SecurityValidationError,
} from "./security-validator";
import {
  InMemoryWebSocketServer,
  registerInMemoryServer,
  unregisterInMemoryServer,
} from "./inMemoryWebSocket";
import { maybeUnref } from "./timers";
import { notifyRelayDisconnectObservers } from "./websocket";
import {
  DiagnosticLogArgument,
  DiagnosticLogger,
  Logger,
} from "./logger";

/**
 * Validates if a string is a valid 32-byte hex string (case-insensitive).
 * Unlike isValidPublicKeyPoint, this accepts both uppercase and lowercase hex.
 */
function isValid32ByteHex(hex: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(hex);
}

/**
 * Validates if a string is a valid 64-byte hex string (case-insensitive).
 * Unlike isValidPublicKeyPoint, this accepts both uppercase and lowercase hex.
 */
function isValid64ByteHex(hex: string): boolean {
  return /^[0-9a-fA-F]{128}$/.test(hex);
}

/* ================ [ Configuration ] ================ */

// Prefer 127.0.0.1 over localhost to avoid IPv6 resolution issues in CI.
const HOST = "ws://127.0.0.1";

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

function createNonThrowingDiagnosticLogger(
  logger: DiagnosticLogger,
): DiagnosticLogger {
  const write = (
    level: keyof DiagnosticLogger,
    message: string,
    args: DiagnosticLogArgument[],
  ) => {
    try {
      logger[level](message, ...args);
    } catch {
      // Diagnostics are observational and must not alter Relay behavior.
    }
  };

  return {
    error: (message, ...args) => write("error", message, args),
    warn: (message, ...args) => write("warn", message, args),
    info: (message, ...args) => write("info", message, args),
    debug: (message, ...args) => write("debug", message, args),
    trace: (message, ...args) => write("trace", message, args),
  };
}

/* ================ [ Interfaces ] ================ */

// Using NostrFilter from types/nostr.ts
type EventFilter = NostrFilter;

// Using NostrEvent from types/nostr.ts
type SignedEvent = NostrEvent;

// Extended type for relay events that adds a subscription id in the middle
type NostrRelayEventMessage = ["EVENT", string, NostrEvent];

/** Optional lifecycle settings for the public ephemeral Relay. */
export interface NostrRelayOptions {
  /** Seconds between cache purges. */
  purgeInterval?: number;
  /** Receives Relay lifecycle and protocol diagnostics. Quiet by default. */
  logger?: DiagnosticLogger;
}

interface Subscription {
  filters: EventFilter[];
  instance: ClientSession;
  sub_id: string;
}

/* ================ [ Server Class ] ================ */

export class NostrRelay {
  private readonly _emitter: EventEmitter;
  private readonly _port: number;
  private readonly _purge: number | null;
  private readonly _subs: Map<string, Subscription>;
  private readonly _logger: DiagnosticLogger;
  private readonly _sessions: Set<ClientSession>;

  private _wss: WebSocketServer | null;
  private _inMemoryServer: InMemoryWebSocketServer | null = null;
  private _cache: SignedEvent[];
  private _closePromise: Promise<void> | null = null;
  private _purgeTimer: NodeJS.Timeout | null = null;
  private _actualPort: number | null = null;
  private _acceptingConnections = false;

  public conn: number;

  constructor(
    port: number,
    purgeIntervalOrOptions?: number | NostrRelayOptions,
  ) {
    const options =
      typeof purgeIntervalOrOptions === "number"
        ? { purgeInterval: purgeIntervalOrOptions }
        : (purgeIntervalOrOptions ?? {});

    this._cache = [];
    this._emitter = new EventEmitter();
    this._port = port;
    this._purge = options.purgeInterval ?? null;
    this._subs = new Map();
    this._logger = createNonThrowingDiagnosticLogger(
      options.logger ?? new Logger({ silent: true }),
    );
    this._sessions = new Set();
    this._wss = null;
    this.conn = 0;
    this._actualPort = null;
  }

  get cache() {
    return this._cache;
  }

  get subs() {
    return this._subs;
  }

  get url() {
    const port = this._actualPort || this._port;
    return `${HOST}:${port}`;
  }

  get wss() {
    if (this._wss === null) {
      throw new Error("websocket server not initialized");
    }
    return this._wss;
  }

  async start() {
    if (this._closePromise) {
      await this._closePromise;
    }

    if (this._wss || this._inMemoryServer) {
      return this;
    }

    const handleConnection = (socket: WebSocket | EventEmitter) => {
      if (!this._acceptingConnections) {
        const closingSocket = socket as WebSocket;
        try {
          closingSocket.terminate();
        } catch {
          try {
            closingSocket.close(1001, "Relay shutting down");
          } catch {
            // The Relay is already closing; there is no session state to retain.
          }
        }
        return;
      }

      const instance = new ClientSession(
        this,
        socket as WebSocket,
        this._logger,
      );
      this._sessions.add(instance);
      void instance.closed.then(() => this._sessions.delete(instance));

      socket.on("message", (msg: unknown) =>
        instance._handler(
          typeof msg === "string" || msg instanceof String
            ? msg.toString()
            : Buffer.isBuffer(msg)
              ? msg.toString()
              : JSON.stringify(msg),
        ),
      );
      socket.on("error", (err: unknown) =>
        instance._onerr(
          err instanceof Error
            ? err
            : new Error(String(err ?? "Unknown error")),
        ),
      );
      socket.on("close", (code: number) => instance._cleanup(code));

      this.conn += 1;
    };

    const initialiseAfterStart = () => {
      this._acceptingConnections = true;
      if (this._purge !== null) {
        if (this._purgeTimer) {
          clearInterval(this._purgeTimer);
        }
        this._purgeTimer = setInterval(() => {
          this._cache = [];
        }, this._purge * 1000);
        maybeUnref(this._purgeTimer);
      }
      this._logger.info("Relay started", { url: this.url });
    };

    const shouldFallbackToInMemory = (error: unknown) => {
      if (!error || typeof error !== "object") {
        return false;
      }
      const code =
        "code" in error && typeof (error as { code: unknown }).code === "string"
          ? ((error as { code: string }).code as string)
          : "";
      const message =
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
          ? ((error as { message: string }).message as string)
          : "";
      // In restricted runtimes, binding to port 0 may report EADDRINUSE even
      // though no specific port was requested; fall back to in-memory relay.
      const isDynamicPortConflict =
        this._port === 0 &&
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
    };

    const resetFailedWebSocketServer = (wss: WebSocketServer) => {
      wss.removeAllListeners();
      try {
        wss.close();
      } catch {
        // A listener that failed to bind may already be fully closed.
      }
      if (this._wss === wss) this._wss = null;
      this._actualPort = null;
      this._acceptingConnections = false;
    };

    const startInMemory = () => {
      const { server, port } = registerInMemoryServer(
        this._port === 0 ? undefined : this._port,
      );

      this._inMemoryServer = server;
      this._wss = server as unknown as WebSocketServer;
      this._actualPort = port;

      server.on(
        "connection",
        handleConnection as (socket: EventEmitter) => void,
      );

      initialiseAfterStart();

      return new Promise<NostrRelay>((res) => {
        queueMicrotask(() => {
          this._emitter.emit("connected");
          res(this);
        });
      });
    };

    // Bun on Linux CI has shown flakiness with real TCP listeners (port 0 / ephemeral ports).
    // Prefer the in-memory transport in Bun to keep the test suite deterministic.
    if (this._port === 0 && typeof (globalThis as unknown as { Bun?: unknown }).Bun !== "undefined") {
      return startInMemory();
    }

    return new Promise<NostrRelay>((resolve, reject) => {
      try {
        const wss = new WebSocketServer({ port: this._port, host: "127.0.0.1" });
        this._wss = wss;
        wss.on("connection", handleConnection);

        const cleanup = () => {
          wss.off("listening", onListening);
          wss.off("error", onError);
        };

        const onListening = () => {
          cleanup();
          const address = wss.address();
          if (address && typeof address === "object" && "port" in address) {
            const port =
              typeof address.port === "number" && address.port > 0
                ? address.port
                : null;
            this._actualPort = port;
          }
          // If we couldn't determine a usable port (e.g. Bun/compat oddities with port 0),
          // fall back to in-memory transport rather than returning a ws://...:0 URL.
          if (this._port === 0 && !this._actualPort) {
            resetFailedWebSocketServer(wss);
            startInMemory().then(resolve).catch(reject);
            return;
          }

          initialiseAfterStart();
          this._emitter.emit("connected");
          resolve(this);
        };

        const onError = (error: unknown) => {
          cleanup();
          if (shouldFallbackToInMemory(error)) {
            resetFailedWebSocketServer(wss);
            startInMemory().then(resolve).catch(reject);
          } else {
            resetFailedWebSocketServer(wss);
            reject(error);
          }
        };

        wss.once("listening", onListening);
        wss.once("error", onError);
      } catch (error) {
        if (shouldFallbackToInMemory(error)) {
          startInMemory().then(resolve).catch(reject);
        } else {
          reject(error);
        }
      }
    });
  }

  onconnect(cb: () => void) {
    this._emitter.on("connected", cb);
  }

  close(): Promise<void> {
    if (this._closePromise) {
      return this._closePromise;
    }

    const closePromise = this.performClose();

    this._closePromise = closePromise;
    const clearClosePromise = () => {
      if (this._closePromise === closePromise) this._closePromise = null;
    };
    void closePromise.then(clearClosePromise, clearClosePromise);

    return closePromise;
  }

  private async performClose(): Promise<void> {
    this._acceptingConnections = false;
    const closedUrl = this.url;
    const inMemoryServer = this._inMemoryServer;
    const wss = inMemoryServer ? null : this._wss;
    const ownedTransport = inMemoryServer !== null || wss !== null;
    const sessions = [...this._sessions];
    const transportShutdown = wss
      ? this.closeWebSocketTransport(wss)
      : Promise.resolve();

    this._emitter.removeAllListeners();
    if (this._purgeTimer) clearInterval(this._purgeTimer);
    this._purgeTimer = null;
    this._inMemoryServer = null;
    this._wss = null;
    this._subs.clear();
    this._cache = [];

    const sessionShutdown = Promise.all(
      sessions.map((session) => session.close()),
    );

    if (inMemoryServer) {
      unregisterInMemoryServer(this._actualPort || this._port);
      await sessionShutdown;
      inMemoryServer.removeAllListeners();
    } else if (wss) {
      let sessionTimeout: NodeJS.Timeout | null = null;
      const timedOut = new Promise<boolean>((resolve) => {
        sessionTimeout = setTimeout(() => resolve(true), 1000);
        maybeUnref(sessionTimeout);
      });
      const sessionsClosed = sessionShutdown.then(() => false);

      if (await Promise.race([sessionsClosed, timedOut])) {
        this._logger.warn("Relay client close timed out; forcing cleanup");
        sessions.forEach((session) => session.forceClose());
        await sessionShutdown;
      }
      if (sessionTimeout) clearTimeout(sessionTimeout);

      await transportShutdown;
      wss.removeAllListeners();
    }

    if (ownedTransport) {
      notifyRelayDisconnectObservers(closedUrl);
    }

    this._sessions.clear();
    this.conn = 0;
    this._actualPort = null;
    this._logger.info("Relay closed", { url: closedUrl });
  }

  private closeWebSocketTransport(wss: WebSocketServer): Promise<void> {
    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout | null = null;
      const finish = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        resolve();
      };

      timeout = setTimeout(() => {
        this._logger.warn(
          "Relay transport close timed out; forcing cleanup",
        );
        finish();
      }, 1000);
      maybeUnref(timeout);

      try {
        // Calling close immediately stops the transport accepting new sockets;
        // its callback still waits for the tracked sessions to drain below.
        wss.close(finish);
      } catch (error) {
        this._logger.warn("Relay transport close failed", {
          error: toDiagnosticArgument(error),
        });
        finish();
      }
    });
  }

  store(event: SignedEvent) {
    const isSimpleReplaceable =
      event.kind === 0 ||
      event.kind === 3 ||
      (event.kind >= 10000 && event.kind < 20000);
    const isParameterizedReplaceable =
      event.kind >= 30000 && event.kind < 40000;

    let shouldAddEvent = true;

    if (isSimpleReplaceable) {
      // Check if a newer or equally new (by ID) event already exists
      for (const cachedEvent of this._cache) {
        if (
          cachedEvent.pubkey === event.pubkey &&
          cachedEvent.kind === event.kind
        ) {
          if (cachedEvent.created_at > event.created_at) {
            shouldAddEvent = false; // Cached is strictly newer
            break;
          }
          if (
            cachedEvent.created_at === event.created_at &&
            cachedEvent.id > event.id // Cached has larger ID (is newer)
          ) {
            shouldAddEvent = false; // Cached is same age but wins by ID
            break;
          }
        }
      }

      if (shouldAddEvent) {
        // Remove all existing events of this kind and pubkey before adding the new one
        this._cache = this._cache.filter(
          (cachedEvent) =>
            !(
              cachedEvent.pubkey === event.pubkey &&
              cachedEvent.kind === event.kind
            ),
        );
        this._logger.debug("Replacing cached replaceable Nostr Events", {
          kind: event.kind,
          pubkey: event.pubkey,
          eventId: event.id,
        });
      }
    } else if (isParameterizedReplaceable) {
      const dTagValue = event.tags.find((tag) => tag[0] === "d")?.[1] || "";

      for (const cachedEvent of this._cache) {
        if (
          cachedEvent.pubkey === event.pubkey &&
          cachedEvent.kind === event.kind
        ) {
          const cachedDTagValue =
            cachedEvent.tags.find((tag) => tag[0] === "d")?.[1] || "";
          if (cachedDTagValue === dTagValue) {
            if (cachedEvent.created_at > event.created_at) {
              shouldAddEvent = false; // Cached is strictly newer
              break;
            }
            if (
              cachedEvent.created_at === event.created_at &&
              cachedEvent.id > event.id // Cached has larger ID (is newer)
            ) {
              shouldAddEvent = false; // Cached is same age but wins by ID
              break;
            }
          }
        }
      }

      if (shouldAddEvent) {
        // Remove all existing events of this kind, pubkey, and dTagValue
        this._cache = this._cache.filter(
          (cachedEvent) =>
            !(
              cachedEvent.pubkey === event.pubkey &&
              cachedEvent.kind === event.kind &&
              (cachedEvent.tags.find((tag) => tag[0] === "d")?.[1] || "") ===
                dTagValue
            ),
        );
        this._logger.debug("Replacing cached addressable Nostr Events", {
          kind: event.kind,
          pubkey: event.pubkey,
          dTag: dTagValue,
          eventId: event.id,
        });
      }
    }

    if (shouldAddEvent) {
      this._cache.push(event);
      // Sort the cache:
      // 1. created_at timestamp (descending - newer events first)
      // 2. event id (lexicographically larger for ties - NIP-01 tie-breaking)
      this._cache.sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return b.created_at - a.created_at; // Newer events first
        }
        // If created_at is the same, sort by id (lexicographically larger id is newer)
        return b.id.localeCompare(a.id);
      });
      this._logger.trace("Stored Nostr Event", {
        eventId: event.id,
        cacheSize: this._cache.length,
      });
    } else {
      this._logger.debug("Discarded stale Nostr Event", {
        eventId: event.id,
      });
    }
  }
}

/* ================ [ Instance Class ] ================ */

class ClientSession {
  private _sid: string;
  private readonly _relay: NostrRelay;
  private readonly _socket: WebSocket;
  private readonly _subs: Set<string>;
  private readonly _logger: DiagnosticLogger;
  private readonly _closed: Promise<void>;
  private _resolveClosed!: () => void;
  private _cleaned = false;

  constructor(
    relay: NostrRelay,
    socket: WebSocket,
    logger: DiagnosticLogger,
  ) {
    this._relay = relay;
    this._logger = logger;
    this._closed = new Promise((resolve) => {
      this._resolveClosed = resolve;
    });
    // Generate cryptographically secure session ID
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const array = new Uint8Array(3);
      crypto.getRandomValues(array);
      this._sid = Array.from(array, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    } else if (
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node
    ) {
      try {
        // Try to use require for CommonJS environments
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require("crypto");
        this._sid = nodeCrypto.randomBytes(3).toString("hex");
      } catch (requireError) {
        // If require fails (ESM environment), generate a fallback ID
        // that will remain immutable for the session lifetime
        const tempArray = new Uint8Array(3);
        // Use Math.random as permanent fallback
        for (let i = 0; i < tempArray.length; i++) {
          tempArray[i] = Math.floor(Math.random() * 256);
        }
        this._sid = Array.from(tempArray, (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");

        // Log warning but keep the generated ID immutable
        this._logger.warn(
          "Using Math.random for session ID generation; provide crypto for stronger identifiers",
        );
      }
    } else {
      // As a last resort, use Math.random with a timestamp component
      // to ensure uniqueness even without crypto
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 0xffffff);
      this._sid = ((timestamp & 0xffffff) ^ random)
        .toString(16)
        .padStart(6, "0");
    }
    this._socket = socket;
    this._subs = new Set();

    this.log.client("client connected");
  }

  get sid() {
    return this._sid;
  }

  get relay() {
    return this._relay;
  }

  get socket() {
    return this._socket;
  }

  get closed(): Promise<void> {
    return this._closed;
  }

  close(): Promise<void> {
    if (this._cleaned) return this._closed;

    try {
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close(1000, "Relay shutting down");
      } else if (this.socket.readyState === WebSocket.CLOSED) {
        this._cleanup(1000);
      }
    } catch (error) {
      this._logger.warn("Relay client close failed", {
        sessionId: this._sid,
        error: toDiagnosticArgument(error),
      });
      this._cleanup(1006);
    }

    return this._closed;
  }

  forceClose(): void {
    try {
      this.socket.terminate();
    } catch {
      // Cleanup below is authoritative even when the transport cannot terminate.
    }
    this._cleanup(1006);
  }

  _cleanup(code: number) {
    if (this._cleaned) return;
    this._cleaned = true;

    try {
      // First remove all subscriptions associated with this client
      for (const subId of this._subs) {
        this.remSub(subId);
      }
      this._subs.clear();

      // Close the socket if it's still open
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }

      this.relay.conn = Math.max(0, this.relay.conn - 1);
      this.log.client(
        `[ ${this._sid} ]`,
        "client disconnected with code:",
        code,
      );
    } catch (e) {
      this._logger.error("Relay client cleanup failed", {
        sessionId: this._sid,
        error: toDiagnosticArgument(e),
      });
    } finally {
      this._resolveClosed();
    }
  }

  _handler(message: string) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(message);

      // Handle NIP-46 messages (which might not follow standard Nostr format)
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        // Check if it's a standard Nostr message
        if (["EVENT", "REQ", "CLOSE"].includes(parsed[0])) {
          const verb = parsed[0];

          switch (verb) {
            case "EVENT":
              if (parsed.length !== 2) {
                this.log.debug("EVENT message missing params:", parsed);
                return this.send([
                  "NOTICE",
                  "invalid: EVENT message missing params",
                ]);
              }
              return this._onevent(parsed[1] as SignedEvent);

            case "REQ":
              if (parsed.length < 2) {
                this.log.debug("REQ message missing params:", parsed);
                return this.send([
                  "NOTICE",
                  "invalid: REQ message missing params",
                ]);
              }
              {
                const sub_id = parsed[1] as string;
                const filters = parsed.slice(2) as EventFilter[];
                return this._onreq(sub_id, filters);
              }

            case "CLOSE":
              if (parsed.length !== 2) {
                this.log.debug("CLOSE message missing params:", parsed);
                return this.send([
                  "NOTICE",
                  "invalid: CLOSE message missing params",
                ]);
              }
              return this._onclose(parsed[1] as string);
          }
        } else {
          // This could be a direct NIP-46 message, broadcast it to other clients
          try {
            this.relay.wss.clients.forEach((client) => {
              if (
                client !== this.socket &&
                client.readyState === WebSocket.OPEN
              ) {
                client.send(message);
              }
            });
            return;
          } catch (e) {
            this.log.error("Error broadcasting message:", e);
            return;
          }
        }
      }

      this.log.debug("unhandled message format:", message);
      return this.send(["NOTICE", "Unable to handle message"]);
    } catch (e) {
      this.log.debug("failed to parse message:\n\n", message);
      return this.send(["NOTICE", "Unable to parse message"]);
    }
  }

  _onclose(sub_id: string) {
    this.log.info("closed subscription:", sub_id);
    this.remSub(sub_id);
  }

  _onerr(err: Error) {
    this.log.info("socket encountered an error:\n\n", err);
  }

  async _onevent(event: SignedEvent) {
    try {
      // Special handling for NIP-46 events (kind 24133)
      if (event.kind === 24133) {
        // Validate basic structure but with NIP-46 specific validation
        if (!(await this.validateNIP46Event(event))) {
          this.log.debug("NIP-46 event failed validation:", event);
          this.send([
            "OK",
            event.id,
            false,
            "NIP-46 event failed validation",
          ] as NostrOkMessage);
          return;
        }

        this.relay.store(event);

        // Find subscriptions that match this event
        for (const [uid, sub] of this.relay.subs.entries()) {
          for (const filter of sub.filters) {
            if (filter.kinds?.includes(24133)) {
              // Check for #p tag filter - safe array access
              const pTags = event.tags
                .filter((tag) => {
                  try {
                    return (
                      validateArrayAccess(tag, 0) &&
                      safeArrayAccess(tag, 0) === "p"
                    );
                  } catch {
                    return false;
                  }
                })
                .map((tag) => {
                  try {
                    return safeArrayAccess(tag, 1);
                  } catch {
                    return null;
                  }
                })
                .filter((val): val is string => typeof val === "string");
              const pFilters = filter["#p"] || [];

              // If there's a #p filter, make sure the event matches it
              if (
                pFilters.length > 0 &&
                !pTags.some((tag) => pFilters.includes(tag))
              ) {
                continue;
              }

              // Send to matching subscription - safe array access
              try {
                const uidParts = uid.split("/");
                if (validateArrayAccess(uidParts, 1)) {
                  const subId = safeArrayAccess(uidParts, 1);
                  sub.instance.send([
                    "EVENT",
                    subId,
                    event,
                  ] as NostrRelayEventMessage);
                  break;
                }
              } catch (error) {
                if (error instanceof SecurityValidationError) {
                  this.log.debug(
                    `Bounds checking error in subscription routing: ${error.message}`,
                  );
                }
                continue;
              }
            }
          }
        }

        // Send OK message
        this.send(["OK", event.id, true, ""] as NostrOkMessage);
        return;
      }

      // Standard event processing
      this.log.client("received event id:", event.id);
      this.log.debug("event:", event);

      // Standard event processing - wrap validateEvent in try-catch
      try {
        if (!(await validateEvent(event))) {
          this.log.debug("event failed validation (returned false):", event);
          this.send([
            "OK",
            event.id,
            false,
            "event failed validation: validateEvent returned false",
          ] as NostrOkMessage);
          return;
        }
      } catch (validationError) {
        // If validateEvent itself throws (e.g. NostrValidationError from getEventHash)
        let errorMessage = "event validation error";
        if (validationError instanceof Error) {
          errorMessage = validationError.message;
        }
        this.log.debug(
          `event failed validation (threw error): ${errorMessage}`,
          event,
        );
        this.send([
          "OK",
          event.id,
          false,
          `invalid: ${errorMessage}`,
        ] as NostrOkMessage);
        return;
      }

      this.send(["OK", event.id, true, ""] as NostrOkMessage);
      this.relay.store(event);

      for (const { filters, instance, sub_id } of this.relay.subs.values()) {
        for (const filter of filters) {
          if (match_filter(event, filter)) {
            instance.log.client(`event matched subscription: ${sub_id}`);
            instance.send(["EVENT", sub_id, event] as NostrRelayEventMessage);
          }
        }
      }
    } catch (e) {
      this.log.error("Error processing event:", e);
    }
  }

  _onreq(sub_id: string, filters: EventFilter[]): void {
    if (filters.length === 0) {
      this.log.client("request has no filters");
      return;
    }

    this.log.client("received subscription request:", sub_id);
    this.log.debug("filters:", filters);

    // Add subscription
    this.addSub(sub_id, ...filters);

    // For each filter
    let count = 0;
    for (const filter of filters) {
      // Set the limit count, if any
      let limitCount = filter.limit;

      for (const event of this.relay.cache) {
        // If limit is reached, stop sending events
        if (limitCount !== undefined && limitCount <= 0) break;

        // Check if event matches filter
        if (match_filter(event, filter)) {
          this.send(["EVENT", sub_id, event] as NostrRelayEventMessage);
          count++;
          this.log.client(`event matched in cache: ${event.id}`);
          this.log.client(`event matched subscription: ${sub_id}`);

          // Update limit counter
          if (limitCount !== undefined) limitCount--;
        }
      }
    }

    this.log.debug(`sent ${count} matching events from cache`);

    // Send EOSE
    this.send(["EOSE", sub_id] as NostrEoseMessage);
  }

  get log() {
    const write = (
      level: "error" | "info" | "debug" | "trace",
      messages: unknown[],
    ) => {
      const [message = "", ...args] = messages;
      this._logger[level](
        `[Relay client ${this._sid}] ${String(message)}`,
        ...args.map(toDiagnosticArgument),
      );
    };

    return {
      client: (...msg: unknown[]) => write("trace", msg),
      debug: (...msg: unknown[]) => write("debug", msg),
      info: (...msg: unknown[]) => write("info", msg),
      error: (...msg: unknown[]) => write("error", msg),
    };
  }

  addSub(sub_id: string, ...filters: EventFilter[]) {
    const uid = `${this.sid}/${sub_id}`;
    this.relay.subs.set(uid, { filters, instance: this, sub_id });
    this._subs.add(sub_id);
  }

  remSub(subId: string) {
    try {
      const uid = `${this.sid}/${subId}`;
      this.relay.subs.delete(uid);
      this._subs.delete(subId);
    } catch (e) {
      // Ignore errors
    }
  }

  send(message: NostrMessage | NostrRelayEventMessage) {
    try {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    } catch (e) {
      this.log.error("Failed to send message:", e);
    }
  }

  // Method to validate NIP-46 events
  async validateNIP46Event(event: SignedEvent): Promise<boolean> {
    // Check required fields exist with proper types
    if (!isValidPublicKeyPoint(event.pubkey)) {
      this.log.debug("NIP-46 validation failed: invalid pubkey");
      return false;
    }

    if (!event.created_at || typeof event.created_at !== "number") {
      this.log.debug("NIP-46 validation failed: invalid created_at");
      return false;
    }

    if (event.kind !== 24133) {
      this.log.debug("NIP-46 validation failed: invalid kind");
      return false;
    }

    if (!Array.isArray(event.tags)) {
      this.log.debug("NIP-46 validation failed: invalid tags");
      return false;
    }

    // For NIP-46, we need to have at least one p tag with a valid pubkey
    const hasPTag = event.tags.some((tag: string[]) => {
      try {
        return (
          Array.isArray(tag) &&
          validateArrayAccess(tag, 0) &&
          validateArrayAccess(tag, 1) &&
          safeArrayAccess(tag, 0) === "p" &&
          typeof safeArrayAccess(tag, 1) === "string" &&
          isValidPublicKeyPoint(safeArrayAccess(tag, 1) as string)
        );
      } catch (error) {
        // If bounds checking fails, this tag is invalid
        return false;
      }
    });

    if (!hasPTag) {
      // For debugging, log the tags structure
      this.log.debug(
        "NIP-46 validation failed: no valid p tag found",
        JSON.stringify(event.tags),
      );
      return false;
    }

    if (typeof event.content !== "string") {
      this.log.debug("NIP-46 validation failed: invalid content");
      return false;
    }

    if (
      !event.sig ||
      typeof event.sig !== "string" ||
      !isValid64ByteHex(event.sig)
    ) {
      this.log.debug("NIP-46 validation failed: invalid signature");
      return false;
    }

    // Verify signature for NIP-46 events using the canonical validateEvent
    try {
      if (!(await validateEvent(event))) {
        this.log.debug(
          "NIP-46 validation failed: invalid signature verification",
        );
        return false;
      }
    } catch (error) {
      this.log.debug(
        "NIP-46 validation failed: error during signature verification",
        error,
      );
      return false;
    }

    // Validate event.id: must be 64-char hex (case-insensitive)
    if (!isValid32ByteHex(event.id)) {
      this.log.debug("NIP-46 validation failed: invalid id format");
      return false;
    }

    // For NIP-46, we've passed all the validation checks
    return true;
  }
}

/* ================ [ Methods ] ================ */

function match_filter(event: SignedEvent, filter: EventFilter = {}): boolean {
  const { authors, ids, kinds, since, until, search, ...rest } = filter;

  // Extract all tag filters from rest
  const tag_filters: string[][] = Object.entries(rest)
    .filter((e) => e[0].startsWith("#"))
    .map((e) => [e[0].slice(1), ...(e[1] as string[])]);

  if (ids !== undefined && !ids.includes(event.id)) {
    return false;
  } else if (since !== undefined && event.created_at < since) {
    return false;
  } else if (until !== undefined && event.created_at > until) {
    return false;
  } else if (authors !== undefined && !authors.includes(event.pubkey)) {
    return false;
  } else if (kinds !== undefined && !kinds.includes(event.kind)) {
    return false;
  } else if (search !== undefined && search.length > 0) {
    const query = search.toLowerCase();
    const contentMatch = event.content.toLowerCase().includes(query);
    const tagMatch = event.tags.some((tag) =>
      tag.some((v) => v.toLowerCase().includes(query)),
    );
    if (!contentMatch && !tagMatch) return false;
    return tag_filters.length > 0 ? match_tags(tag_filters, event.tags) : true;
  } else if (tag_filters.length > 0) {
    return match_tags(tag_filters, event.tags);
  } else {
    return true;
  }
}

function match_tags(filters: string[][], tags: string[][]): boolean {
  // For each filter, we need to find at least one match in event tags
  for (const filter of filters) {
    let filterMatched = false;

    // Safe access to filter elements
    try {
      if (!validateArrayAccess(filter, 0)) {
        filterMatched = true; // Empty filter matches everything
        continue;
      }

      const key = safeArrayAccess(filter, 0);
      const terms = filter.slice(1);

      // Skip empty filter terms
      if (terms.length === 0) {
        filterMatched = true;
        continue;
      }

      // For each tag that matches the filter key
      for (const tag of tags) {
        try {
          if (!validateArrayAccess(tag, 0) || safeArrayAccess(tag, 0) !== key) {
            continue;
          }

          const params = tag.slice(1);

          // For each term in the filter
          for (const term of terms) {
            // If any term matches any parameter, this filter condition is satisfied
            if (params.includes(term)) {
              filterMatched = true;
              break;
            }
          }

          // If we found a match for this filter, we can stop checking tags
          if (filterMatched) break;
        } catch (error) {
          // Skip malformed tags
          continue;
        }
      }
    } catch (error) {
      // Skip malformed filters
      continue;
    }

    // If no match was found for this filter condition, event doesn't match
    if (!filterMatched) return false;
  }

  // All filter conditions were satisfied
  return true;
}
