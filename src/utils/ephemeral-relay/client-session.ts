import { WebSocket } from "ws";
import { validateEvent } from "../../nip01/event";
import type { NostrEvent, NostrFilter } from "../../types/nostr";
import type {
  NostrEoseMessage,
  NostrOkMessage,
  NostrRelayMessage,
} from "../../types/protocol";
import { asDiagnosticArgument } from "../diagnostics";
import { isValidPublicKeyPoint } from "../key-validation";
import type { DiagnosticLogger } from "../logger";
import {
  safeArrayAccess,
  SecurityValidationError,
  validateArrayAccess,
  validateFilters,
} from "../security-validator";
import { isHexOfLength } from "../wire-validation";
import { matchesFilter } from "./filter-match";

function isValid32ByteHex(hex: string): boolean {
  return isHexOfLength(hex, 64);
}

function isValid64ByteHex(hex: string): boolean {
  return isHexOfLength(hex, 128);
}

/** Lifecycle and protocol operations exposed to the Relay composition root. */
export interface RelaySession {
  readonly closed: Promise<void>;
  close(): Promise<void>;
  forceClose(): void;
  send(message: NostrRelayMessage): void;
  sendMatchedEvent(subscriptionId: string, event: NostrEvent): void;
}

/** Subscription state shared between active client sessions. */
export interface RelaySubscription {
  filters: NostrFilter[];
  instance: RelaySession;
  subscriptionId: string;
}

/** Narrow Relay capabilities required by one client session. */
export interface RelaySessionHost {
  cachedEvents(): readonly NostrEvent[];
  subscriptions(): Map<string, RelaySubscription>;
  store(event: NostrEvent): void;
  broadcast(message: string, sender: WebSocket): void;
  clientDisconnected(): void;
}

/** Create a client session and attach its socket event handlers. */
export function createClientSession(
  host: RelaySessionHost,
  socket: WebSocket,
  logger: DiagnosticLogger,
): RelaySession {
  const session = new ClientSession(host, socket, logger);

  socket.on("message", (message: unknown) =>
    session.handleMessage(
      typeof message === "string" || message instanceof String
        ? message.toString()
        : Buffer.isBuffer(message)
          ? message.toString()
          : JSON.stringify(message),
    ),
  );
  socket.on("error", (error: unknown) =>
    session.handleError(
      error instanceof Error
        ? error
        : new Error(String(error ?? "Unknown error")),
    ),
  );
  socket.on("close", (code: number) => session.cleanup(code));

  return session;
}

/** Owns one client's wire protocol, subscriptions, and socket lifecycle. */
class ClientSession implements RelaySession {
  private _sid: string;
  private readonly _host: RelaySessionHost;
  private readonly _socket: WebSocket;
  private readonly _subs: Set<string>;
  private readonly _logger: DiagnosticLogger;
  private readonly _closed: Promise<void>;
  private _resolveClosed!: () => void;
  private _cleaned = false;

  constructor(
    host: RelaySessionHost,
    socket: WebSocket,
    logger: DiagnosticLogger,
  ) {
    this._host = host;
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

  get host() {
    return this._host;
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
        this.cleanup(1000);
      }
    } catch (error) {
      this._logger.warn("Relay client close failed", {
        sessionId: this._sid,
        error: asDiagnosticArgument(error),
      });
      this.cleanup(1006);
    }

    return this._closed;
  }

  forceClose(): void {
    try {
      this.socket.terminate();
    } catch {
      // Cleanup below is authoritative even when the transport cannot terminate.
    }
    this.cleanup(1006);
  }

  cleanup(code: number): void {
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

      this.host.clientDisconnected();
      this.log.client(
        `[ ${this._sid} ]`,
        "client disconnected with code:",
        code,
      );
    } catch (e) {
      this._logger.error("Relay client cleanup failed", {
        sessionId: this._sid,
        error: asDiagnosticArgument(e),
      });
    } finally {
      this._resolveClosed();
    }
  }

  handleMessage(message: string): void {
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
              void this.handleEvent(parsed[1] as NostrEvent);
              return;

            case "REQ":
              if (parsed.length < 2) {
                this.log.debug("REQ message missing params:", parsed);
                return this.send([
                  "NOTICE",
                  "invalid: REQ message missing params",
                ]);
              }
              {
                const subscriptionId = parsed[1];
                if (typeof subscriptionId !== "string") {
                  return this.send([
                    "NOTICE",
                    "invalid: REQ subscription id must be a string",
                  ]);
                }
                let filters: NostrFilter[];
                try {
                  filters = validateFilters(parsed.slice(2));
                } catch (error) {
                  if (error instanceof SecurityValidationError) {
                    return this.send(["NOTICE", "invalid: REQ filters"]);
                  }
                  throw error;
                }
                return this.handleRequest(subscriptionId, filters);
              }

            case "CLOSE":
              if (parsed.length !== 2) {
                this.log.debug("CLOSE message missing params:", parsed);
                return this.send([
                  "NOTICE",
                  "invalid: CLOSE message missing params",
                ]);
              }
              return this.handleClose(parsed[1] as string);
          }
        } else {
          // This could be a direct NIP-46 message, broadcast it to other clients
          try {
            this.host.broadcast(message, this.socket);
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

  private handleClose(subscriptionId: string): void {
    this.log.info("closed subscription:", subscriptionId);
    this.remSub(subscriptionId);
  }

  handleError(err: Error): void {
    this.log.info("socket encountered an error:\n\n", err);
  }

  private async handleEvent(event: NostrEvent): Promise<void> {
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

        this.host.store(event);

        // Find subscriptions that match this event
        for (const [uid, sub] of this.host.subscriptions().entries()) {
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
                  if (typeof subId !== "string") {
                    continue;
                  }
                  sub.instance.send(["EVENT", subId, event]);
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
      this.host.store(event);

      for (const { filters, instance, subscriptionId } of this.host
        .subscriptions()
        .values()) {
        for (const filter of filters) {
          if (matchesFilter(event, filter)) {
            instance.sendMatchedEvent(subscriptionId, event);
          }
        }
      }
    } catch (e) {
      this.log.error("Error processing event:", e);
    }
  }

  private handleRequest(subscriptionId: string, filters: NostrFilter[]): void {
    if (filters.length === 0) {
      this.log.client("request has no filters");
      return;
    }

    this.log.client("received subscription request:", subscriptionId);
    this.log.debug("filters:", filters);

    // Add subscription
    this.addSub(subscriptionId, ...filters);

    // For each filter
    let count = 0;
    for (const filter of filters) {
      // Set the limit count, if any
      let limitCount = filter.limit;

      for (const event of this.host.cachedEvents()) {
        // If limit is reached, stop sending events
        if (limitCount !== undefined && limitCount <= 0) break;

        // Check if event matches filter
        if (matchesFilter(event, filter)) {
          this.send(["EVENT", subscriptionId, event]);
          count++;
          this.log.client(`event matched in cache: ${event.id}`);
          this.log.client(`event matched subscription: ${subscriptionId}`);

          // Update limit counter
          if (limitCount !== undefined) limitCount--;
        }
      }
    }

    this.log.debug(`sent ${count} matching events from cache`);

    // Send EOSE
    this.send(["EOSE", subscriptionId] as NostrEoseMessage);
  }

  get log() {
    const write = (
      level: "error" | "info" | "debug" | "trace",
      messages: unknown[],
    ) => {
      const [message = "", ...args] = messages;
      this._logger[level](
        `[Relay client ${this._sid}] ${String(message)}`,
        ...args.map(asDiagnosticArgument),
      );
    };

    return {
      client: (...msg: unknown[]) => write("trace", msg),
      debug: (...msg: unknown[]) => write("debug", msg),
      info: (...msg: unknown[]) => write("info", msg),
      error: (...msg: unknown[]) => write("error", msg),
    };
  }

  addSub(subscriptionId: string, ...filters: NostrFilter[]) {
    const uid = `${this.sid}/${subscriptionId}`;
    this.host.subscriptions().set(uid, {
      filters,
      instance: this,
      subscriptionId,
    });
    this._subs.add(subscriptionId);
  }

  remSub(subId: string) {
    try {
      const uid = `${this.sid}/${subId}`;
      this.host.subscriptions().delete(uid);
      this._subs.delete(subId);
    } catch (e) {
      // Ignore errors
    }
  }

  send(message: NostrRelayMessage) {
    try {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    } catch (e) {
      this.log.error("Failed to send message:", e);
    }
  }

  sendMatchedEvent(subscriptionId: string, event: NostrEvent): void {
    this.log.client(`event matched subscription: ${subscriptionId}`);
    this.send(["EVENT", subscriptionId, event]);
  }

  // Method to validate NIP-46 events
  async validateNIP46Event(event: NostrEvent): Promise<boolean> {
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
