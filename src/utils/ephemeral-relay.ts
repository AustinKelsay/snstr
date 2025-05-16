import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import EventEmitter from "events";
import { WebSocket, WebSocketServer } from "ws";
import { NostrEvent, NostrFilter } from "../types/nostr";
import {
  NostrMessage,
  NostrOkMessage,
  NostrEoseMessage,
} from "../types/protocol";

/* ================ [ Configuration ] ================ */

const HOST = "ws://localhost";
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
  private _cache: SignedEvent[];
  private _isClosing: boolean = false;

  public conn: number;

  constructor(port: number, purge_ival?: number) {
    this._cache = [];
    this._emitter = new EventEmitter();
    this._port = port;
    this._purge = purge_ival ?? null;
    this._subs = new Map();
    this._wss = null;
    this.conn = 0;
  }

  get cache() {
    return this._cache;
  }

  get subs() {
    return this._subs;
  }

  get url() {
    return `${HOST}:${this._port}`;
  }

  get wss() {
    if (this._wss === null) {
      throw new Error("websocket server not initialized");
    }
    return this._wss;
  }

  async start() {
    this._wss = new WebSocketServer({ port: this._port });
    this._isClosing = false;

    DEBUG && console.log("[ relay ] running on port:", this._port);

    this.wss.on("connection", (socket) => {
      const instance = new ClientSession(this, socket);

      socket.on("message", (msg) => instance._handler(msg.toString()));
      socket.on("error", (err) => instance._onerr(err));
      socket.on("close", (code) => instance._cleanup(code));

      this.conn += 1;
    });

    return new Promise<NostrRelay>((res) => {
      this.wss.on("listening", () => {
        if (this._purge !== null) {
          DEBUG &&
            console.log(
              `[ relay ] purging events every ${this._purge} seconds`,
            );
          setInterval(() => {
            this._cache = [];
          }, this._purge * 1000);
        }
        this._emitter.emit("connected");
        res(this);
      });
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

      if (this._wss) {
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
    // Add the event to the cache and sort according to NIP-01:
    // 1. created_at timestamp (descending - newer events first)
    // 2. event id (lexical ascending) if timestamps are the same
    this._cache = this._cache.concat(event).sort((a, b) => {
      // Sort by created_at (descending - newer events first)
      if (a.created_at !== b.created_at) {
        return b.created_at - a.created_at;
      }
      // If created_at is the same, sort by id (descending lexical order)
      return b.id.localeCompare(a.id);
    });
  }
}

/* ================ [ Instance Class ] ================ */

class ClientSession {
  private readonly _sid: string;
  private readonly _relay: NostrRelay;
  private readonly _socket: WebSocket;
  private readonly _subs: Set<string>;

  constructor(relay: NostrRelay, socket: WebSocket) {
    this._relay = relay;
    this._sid = Math.random().toString().slice(2, 8);
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

  _onevent(event: SignedEvent) {
    try {
      // Special handling for NIP-46 events (kind 24133)
      if (event.kind === 24133) {
        // Validate basic structure but with NIP-46 specific validation
        if (!this.validateNIP46Event(event)) {
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
              // Check for #p tag filter
              const pTags = event.tags
                .filter((tag) => tag[0] === "p")
                .map((tag) => tag[1]);
              const pFilters = filter["#p"] || [];

              // If there's a #p filter, make sure the event matches it
              if (
                pFilters.length > 0 &&
                !pTags.some((tag) => pFilters.includes(tag))
              ) {
                continue;
              }

              // Send to matching subscription
              const [_clientId, subId] = uid.split("/");
              sub.instance.send([
                "EVENT",
                subId,
                event,
              ] as NostrRelayEventMessage);
              break;
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

      if (!verify_event(event)) {
        this.log.debug("event failed validation:", event);
        this.send([
          "OK",
          event.id,
          false,
          "event failed validation",
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
  validateNIP46Event(event: SignedEvent): boolean {
    // Check required fields exist with proper types
    if (!event.id || typeof event.id !== "string" || event.id.length !== 64) {
      this.log.debug("NIP-46 validation failed: invalid id");
      return false;
    }

    if (
      !event.pubkey ||
      typeof event.pubkey !== "string" ||
      event.pubkey.length !== 64
    ) {
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
    const hasPTag = event.tags.some(
      (tag: string[]) =>
        Array.isArray(tag) &&
        tag.length >= 2 &&
        tag[0] === "p" &&
        typeof tag[1] === "string" &&
        tag[1].length === 64 &&
        /^[0-9a-f]{64}$/.test(tag[1]),
    );

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
      event.sig.length !== 128
    ) {
      this.log.debug("NIP-46 validation failed: invalid signature");
      return false;
    }

    // Verify signature for NIP-46 events
    try {
      if (!verify_event(event)) {
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

    // For NIP-46, we've passed all the validation checks
    return true;
  }
}

/* ================ [ Methods ] ================ */

function match_filter(event: SignedEvent, filter: EventFilter = {}): boolean {
  const { authors, ids, kinds, since, until, ...rest } = filter;

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
  } else if (tag_filters.length > 0) {
    return match_tags(tag_filters, event.tags);
  } else {
    return true;
  }
}

function match_tags(filters: string[][], tags: string[][]): boolean {
  // For each filter, we need to find at least one match in event tags
  for (const [key, ...terms] of filters) {
    let filterMatched = false;

    // Skip empty filter terms
    if (terms.length === 0) {
      filterMatched = true;
      continue;
    }

    // For each tag that matches the filter key
    for (const [tag, ...params] of tags) {
      if (tag !== key) continue;

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
    }

    // If no match was found for this filter condition, event doesn't match
    if (!filterMatched) return false;
  }

  // All filter conditions were satisfied
  return true;
}

function verify_event(event: SignedEvent) {
  const { content, created_at, id, kind, pubkey, sig, tags } = event;
  const pimg = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
  const dig = bytesToHex(sha256(pimg));
  if (dig !== id) return false;
  return schnorr.verify(sig, id, pubkey);
}
