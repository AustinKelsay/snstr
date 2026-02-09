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
const DEBUG = process.env["DEBUG"] === "true";
const VERBOSE = process.env["VERBOSE"] === "true" || DEBUG;

console.log("output mode:", DEBUG ? "debug" : VERBOSE ? "verbose" : "silent");

/* ================ [ Interfaces ] ================ */

// Using NostrFilter from types/nostr.ts
type EventFilter = NostrFilter;

// Using NostrEvent from types/nostr.ts
type SignedEvent = NostrEvent;

// Extended type for relay events that adds a subscription id in the middle
type NostrRelayEventMessage = ["EVENT", string, NostrEvent];

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

  private _wss: WebSocketServer | null;
  private _inMemoryServer: InMemoryWebSocketServer | null = null;
  private _usingInMemory = false;
  private _cache: SignedEvent[];
  private _isClosing: boolean = false;
  private _purgeTimer: NodeJS.Timeout | null = null;
  private _actualPort: number | null = null;

  public conn: number;

  constructor(port: number, purge_ival?: number) {
    this._cache = [];
    this._emitter = new EventEmitter();
    this._port = port;
    this._purge = purge_ival ?? null;
    this._subs = new Map();
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
    if (this._wss || this._inMemoryServer) {
      return this;
    }

    const handleConnection = (socket: WebSocket | EventEmitter) => {
      const instance = new ClientSession(this, socket as WebSocket);

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
      this._isClosing = false;
      if (this._purge !== null) {
        if (this._purgeTimer) {
          clearInterval(this._purgeTimer);
        }
        this._purgeTimer = setInterval(() => {
          this._cache = [];
        }, this._purge * 1000);
      }
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

    const startInMemory = () => {
      const { server, port } = registerInMemoryServer(
        this._port === 0 ? undefined : this._port,
      );

      this._usingInMemory = true;
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

    return new Promise<NostrRelay>((resolve, reject) => {
      try {
        const wss = new WebSocketServer({ port: this._port, host: "127.0.0.1" });
        this._wss = wss;
        this._usingInMemory = false;
        wss.on("connection", handleConnection);

        const cleanup = () => {
          wss.off("listening", onListening);
          wss.off("error", onError);
        };

        const onListening = () => {
          cleanup();
          const address = wss.address();
          if (address && typeof address === "object" && "port" in address) {
            this._actualPort = address.port;
          }

          DEBUG &&
            console.log(
              "[ relay ] running on port:",
              this._actualPort || this._port,
            );

          initialiseAfterStart();
          this._emitter.emit("connected");
          resolve(this);
        };

        const onError = (error: unknown) => {
          cleanup();
          if (shouldFallbackToInMemory(error)) {
            try {
              wss.removeAllListeners();
              wss.close();
            } catch (_closeError) {
              // Ignore close errors during fallback
            }
            this._wss = null;
            startInMemory().then(resolve).catch(reject);
          } else {
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

  close() {
    return new Promise<void>((resolve) => {
      if (this._isClosing) {
        DEBUG &&
          console.log(
            "[ relay ] already closing, skipping duplicate close call",
          );
        resolve();
        return;
      }

      this._isClosing = true;

      // Clear any listeners on the emitter
      this._emitter.removeAllListeners();

      if (this._purgeTimer) {
        clearInterval(this._purgeTimer);
        this._purgeTimer = null;
      }

      if (this._inMemoryServer) {
        const server = this._inMemoryServer;
        server.removeAllListeners();
        unregisterInMemoryServer(this._actualPort || this._port);
        this._inMemoryServer = null;
        this._wss = null;
        this._usingInMemory = false;
        this._subs.clear();
        this._cache = [];
        this._actualPort = null;
        this._purgeTimer && clearInterval(this._purgeTimer);
        this._purgeTimer = null;
        this._isClosing = false;
        resolve();
        return;
      } else if (this._wss) {
        // Clean up clients first
        if (this._wss.clients && this._wss.clients.size > 0) {
          // Keep track of clients to make sure they all close
          const clientsToClose = this._wss.clients.size;
          let closedClients = 0;

          this._wss.clients.forEach((client) => {
            try {
              // Add close handler to track when clients are closed
              client.once("close", () => {
                closedClients++;
                DEBUG &&
                  console.log(
                    `[ relay ] client closed (${closedClients}/${clientsToClose})`,
                  );
              });

              client.close(1000, "Server shutting down");
            } catch (e) {
              // Count error closures as closed
              closedClients++;
              DEBUG && console.log(`[ relay ] error closing client: ${e}`);
            }
          });
        }

        // Clear state
        this._subs.clear();
        this._cache = [];

        // Close server with timeout that self-cancels (unref)
        const timeout = setTimeout(() => {
          DEBUG &&
            console.log("[ relay ] server close timed out, forcing cleanup");
          this._wss = null;
          resolve();
        }, 1000).unref(); // Use unref to avoid keeping the process alive

        const wss = this._wss;
        this._wss = null;

        try {
          wss.close(() => {
            clearTimeout(timeout);

            // Final cleanup
            process.nextTick(() => {
              // Ensure everything is fully cleaned up before resolving
              try {
                wss.removeAllListeners();
              } catch (e) {
                // Ignore errors during cleanup
              }
              resolve();
            });
          });
        } catch (e) {
          // Handle errors during close
          DEBUG && console.log(`[ relay ] error during server close: ${e}`);
          clearTimeout(timeout);
          resolve();
        }
      } else {
        resolve();
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
        DEBUG &&
          console.log(
            `[ relay ] replacing existing events for kind ${event.kind}, pubkey ${event.pubkey} with new event ${event.id}.`,
          );
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
        DEBUG &&
          console.log(
            `[ relay ] replacing existing events for kind ${event.kind}, pubkey ${event.pubkey}, dTag ${dTagValue} with new event ${event.id}.`,
          );
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
      VERBOSE &&
        console.log(
          `[ relay ] Stored event ${event.id}. Cache size: ${this._cache.length}`,
        );
    } else {
      DEBUG &&
        console.log(
          `[ relay ] Discarding event ${event.id} as a newer version already exists or it's older.`,
        );
    }
  }
}

/* ================ [ Instance Class ] ================ */

class ClientSession {
  private _sid: string;
  private readonly _relay: NostrRelay;
  private readonly _socket: WebSocket;
  private readonly _subs: Set<string>;

  constructor(relay: NostrRelay, socket: WebSocket) {
    this._relay = relay;
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
        console.warn(
          "Using Math.random for session ID generation. For production use, ensure crypto module is available.",
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

  _cleanup(code: number) {
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

      this.relay.conn -= 1;
      this.log.client(
        `[ ${this._sid} ]`,
        "client disconnected with code:",
        code,
      );
    } catch (e) {
      DEBUG &&
        console.error(`[ client ][ ${this._sid} ]`, "error during cleanup:", e);
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
                DEBUG &&
                  console.log(
                    `[ ${this._sid} ]`,
                    "EVENT message missing params:",
                    parsed,
                  );
                return this.send([
                  "NOTICE",
                  "invalid: EVENT message missing params",
                ]);
              }
              return this._onevent(parsed[1] as SignedEvent);

            case "REQ":
              if (parsed.length < 2) {
                DEBUG &&
                  console.log(
                    `[ ${this._sid} ]`,
                    "REQ message missing params:",
                    parsed,
                  );
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
                DEBUG &&
                  console.log(
                    `[ ${this._sid} ]`,
                    "CLOSE message missing params:",
                    parsed,
                  );
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
            DEBUG && console.error("Error broadcasting message:", e);
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
      DEBUG && console.error("Error processing event:", e);
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

    DEBUG && this.log.debug(`sent ${count} matching events from cache`);

    // Send EOSE
    this.send(["EOSE", sub_id] as NostrEoseMessage);
  }

  get log() {
    return {
      client: (...msg: unknown[]) =>
        VERBOSE && console.log(`[ client ][ ${this._sid} ]`, ...msg),
      debug: (...msg: unknown[]) =>
        DEBUG && console.log(`[ debug  ][ ${this._sid} ]`, ...msg),
      info: (...msg: unknown[]) =>
        VERBOSE && console.log(`[ info   ][ ${this._sid} ]`, ...msg),
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
      DEBUG &&
        console.error(`Failed to send message to client ${this._sid}:`, e);
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
