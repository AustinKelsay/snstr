import { NostrEvent, NostrFilter } from "./nostr";
// RelayEvent is now imported in relay.ts directly from nostr.ts

/**
 * Message types for Nostr protocol communications as defined in NIP-01
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */

/** EVENT message: A client publishing an event to a relay */
export type NostrClientToServerEventMessage = ["EVENT", NostrEvent];

/** EVENT message: A relay sending an event to a client */
export type NostrServerToClientEventMessage = ["EVENT", string, NostrEvent];

/** Union type for EVENT messages */
export type NostrEventMessage =
  | NostrClientToServerEventMessage
  | NostrServerToClientEventMessage;

/** REQ message: A client subscribing to a set of events from a relay */
export type NostrReqMessage = ["REQ", string, ...NostrFilter[]];

/** CLOSE message: A client unsubscribing from a subscription */
export type NostrCloseMessage = ["CLOSE", string];

/** OK message: A relay indicating acceptance/rejection of an EVENT message */
export type NostrOkMessage = ["OK", string, boolean, string];

/** EOSE message: A relay indicating that all stored events matching a subscription have been sent */
export type NostrEoseMessage = ["EOSE", string];

/** NOTICE message: A human-readable message from a relay to a client */
export type NostrNoticeMessage = ["NOTICE", string];

/** AUTH message: A relay requesting client authentication (NIP-42) */
export type NostrAuthMessage =
  | ["AUTH", string] // relay ➜ client (challenge)
  | ["AUTH", NostrEvent]; // client ➜ relay   (response)

/** Union type of all possible message types */
export type NostrMessage =
  | NostrEventMessage
  | NostrReqMessage
  | NostrCloseMessage
  | NostrOkMessage
  | NostrEoseMessage
  | NostrNoticeMessage
  | NostrAuthMessage;

/**
 * Error type for Nostr protocol message parsing errors
 */
export class NostrMessageParseError extends Error {
  /** The original data that caused the error */
  public readonly data: unknown;

  constructor(message: string, data: unknown) {
    super(message);
    this.name = "NostrMessageParseError";
    this.data = data;
  }
}

/**
 * Parse a JSON string into a strongly-typed Nostr protocol message
 * @param data - The JSON string to parse
 * @returns A typed NostrMessage or null if parsing fails
 * @throws NostrMessageParseError if the message cannot be parsed
 */
export function parseMessage(data: string): NostrMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length < 1) {
      throw new NostrMessageParseError("Invalid message format", parsed);
    }

    const [messageType] = parsed;
    switch (messageType) {
      case "EVENT":
        // Client to Relay: ["EVENT", <NostrEvent>] (length 2)
        if (parsed.length === 2) {
          if (typeof parsed[1] !== "object" || parsed[1] === null) {
            throw new NostrMessageParseError(
              "EVENT message from client expects an event object as the second element",
              parsed,
            );
          }
          return ["EVENT", parsed[1] as NostrEvent];
        }
        // Relay to Client: ["EVENT", <subscription_id>, <NostrEvent>] (length 3)
        else if (parsed.length === 3) {
          if (typeof parsed[1] !== "string") {
            throw new NostrMessageParseError(
              "EVENT message from relay expects a subscription ID (string) as the second element",
              parsed,
            );
          }
          if (typeof parsed[2] !== "object" || parsed[2] === null) {
            throw new NostrMessageParseError(
              "EVENT message from relay expects an event object as the third element",
              parsed,
            );
          }
          return ["EVENT", parsed[1] as string, parsed[2] as NostrEvent];
        }
        throw new NostrMessageParseError(
          "Invalid EVENT message: expected 2 or 3 elements matching client or relay structure",
          parsed,
        );
      case "REQ": {
        if (parsed.length < 3)
          throw new NostrMessageParseError("Invalid REQ message", parsed);
        const [, subId, ...filters] = parsed;
        return ["REQ", subId, ...filters];
      }
      case "CLOSE":
        if (parsed.length !== 2)
          throw new NostrMessageParseError("Invalid CLOSE message", parsed);
        return ["CLOSE", parsed[1]];
      case "OK":
        if (parsed.length !== 4)
          throw new NostrMessageParseError("Invalid OK message", parsed);
        return ["OK", parsed[1], parsed[2], parsed[3]];
      case "EOSE":
        if (parsed.length !== 2)
          throw new NostrMessageParseError("Invalid EOSE message", parsed);
        return ["EOSE", parsed[1]];
      case "NOTICE":
        // More flexible parsing for NOTICE messages
        return ["NOTICE", parsed[1] || ""];
      case "AUTH":
        if (parsed.length !== 2)
          throw new NostrMessageParseError("Invalid AUTH message", parsed);
        return ["AUTH", parsed[1]];
      default:
        console.warn(`Unknown message type: ${messageType}`, parsed);
        return null;
    }
  } catch (error) {
    if (error instanceof NostrMessageParseError) {
      throw error;
    }
    console.error("Failed to parse message:", error);
    return null;
  }
}

/**
 * Serialize a NostrMessage object into a JSON string for transmission
 * @param message - The message to serialize
 * @returns A JSON string representation of the message
 */
export function serializeMessage(message: NostrMessage): string {
  // Remove undefined entries that appear in the middle/end of the tuple
  return JSON.stringify(
    Array.isArray(message) ? message.filter((v) => v !== undefined) : message,
  );
}

// Export RelayEvent from nostr.ts instead of redefining it here

/**
 * Interface for relay connection options
 */
export interface RelayConnectionOptions {
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Delay between buffering events and processing them (ms) */
  bufferFlushDelay?: number;
  /** Whether to automatically reconnect on disconnection */
  autoReconnect?: boolean;
  /** Maximum number of reconnection attempts (0 for unlimited) */
  maxReconnectAttempts?: number;
  /** Maximum delay between reconnection attempts (ms) */
  maxReconnectDelay?: number;
  /** Optional list of ephemeral subscriptions to initialize with */
  ephemeralSubscriptions?: Array<{
    filters: NostrFilter[];
    onEvent: (event: NostrEvent) => void;
    onEOSE?: () => void;
  }>;
}
