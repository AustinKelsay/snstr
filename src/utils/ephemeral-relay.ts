import EventEmitter from "events";
import { NostrEvent } from "../types/nostr";
import { protectDiagnosticLogger } from "./diagnostics";
import { maybeUnref } from "./timers";
import { notifyRelayDisconnectObservers } from "./websocket";
import { DiagnosticLogger, Logger } from "./logger";
import {
  createClientSession,
  RelaySession,
  RelaySessionHost,
  RelaySubscription,
} from "./ephemeral-relay/client-session";
import {
  createRelayTransport,
  RelayTransport,
} from "./ephemeral-relay/transport";

/* ================ [ Configuration ] ================ */

// Prefer 127.0.0.1 over localhost to avoid IPv6 resolution issues in CI.
const HOST = "ws://127.0.0.1";

/* ================ [ Interfaces ] ================ */

/** Optional lifecycle settings for the public ephemeral Relay. */
export interface NostrRelayOptions {
  /** Seconds between cache purges. */
  purgeInterval?: number;
  /** Receives Relay lifecycle and protocol diagnostics. Quiet by default. */
  logger?: DiagnosticLogger;
}

/* ================ [ Server Class ] ================ */

export class NostrRelay {
  private readonly _emitter: EventEmitter;
  private readonly _port: number;
  private readonly _purge: number | null;
  private readonly _subs: Map<string, RelaySubscription>;
  private readonly _logger: DiagnosticLogger;
  private readonly _sessions: Set<RelaySession>;
  private readonly _sessionHost: RelaySessionHost;

  private _transport: RelayTransport | null = null;
  private _cache: NostrEvent[];
  private _closePromise: Promise<void> | null = null;
  private _purgeTimer: NodeJS.Timeout | null = null;

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
    this._logger = protectDiagnosticLogger(
      options.logger ?? new Logger({ silent: true }),
    );
    this._sessions = new Set();
    this._sessionHost = {
      cachedEvents: () => this._cache,
      subscriptions: () => this._subs,
      store: (event) => this.store(event),
      broadcast: (message, sender) =>
        this._transport?.broadcast(message, sender),
      clientDisconnected: () => {
        this.conn = Math.max(0, this.conn - 1);
      },
    };
    this.conn = 0;
  }

  get cache() {
    return this._cache;
  }

  get subs() {
    return this._subs;
  }

  get url() {
    const port = this._transport?.actualPort || this._port;
    return `${HOST}:${port}`;
  }

  get wss() {
    if (!this._transport) {
      throw new Error("websocket server not initialized");
    }
    return this._transport.server;
  }

  async start() {
    if (this._closePromise) {
      await this._closePromise;
    }

    if (this._transport) {
      return this;
    }

    const transport = createRelayTransport({
      port: this._port,
      logger: this._logger,
      onConnection: (socket) => {
        const instance = createClientSession(
          this._sessionHost,
          socket,
          this._logger,
        );
        this._sessions.add(instance);
        void instance.closed.then(() => this._sessions.delete(instance));

        this.conn += 1;
      },
    });
    this._transport = transport;

    try {
      await transport.start();
    } catch (error) {
      if (this._transport === transport) this._transport = null;
      throw error;
    }

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
    this._emitter.emit("connected");
    return this;
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
    const closedUrl = this.url;
    const transport = this._transport;
    const sessions = [...this._sessions];

    this._emitter.removeAllListeners();
    if (this._purgeTimer) clearInterval(this._purgeTimer);
    this._purgeTimer = null;
    this._transport = null;
    this._subs.clear();
    this._cache = [];

    if (transport) {
      await transport.close(
        async () => {
          await Promise.all(sessions.map((session) => session.close()));
        },
        () => sessions.forEach((session) => session.forceClose()),
      );
      notifyRelayDisconnectObservers(closedUrl);
    }

    this._sessions.clear();
    this.conn = 0;
    this._logger.info("Relay closed", { url: closedUrl });
  }

  store(event: NostrEvent) {
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
