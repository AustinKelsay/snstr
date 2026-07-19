import { NostrEvent, NostrFilter } from "./nostr";

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

/** CLOSED message: A relay indicating that a subscription ended */
export type NostrClosedMessage = ["CLOSED", string, string];

/** AUTH message: A relay requesting client authentication (NIP-42) */
export type NostrRelayAuthMessage = ["AUTH", string];

/** AUTH message: A client responding to a relay challenge (NIP-42) */
export type NostrClientAuthMessage = ["AUTH", NostrEvent];

/** Union type for AUTH messages in either direction */
export type NostrAuthMessage = NostrRelayAuthMessage | NostrClientAuthMessage;

/** Messages sent from a Nostr client to a relay */
export type NostrClientMessage =
  | NostrClientToServerEventMessage
  | NostrReqMessage
  | NostrCloseMessage
  | NostrClientAuthMessage;

/** Messages sent from a Nostr relay to a client */
export type NostrRelayMessage =
  | NostrServerToClientEventMessage
  | NostrOkMessage
  | NostrEoseMessage
  | NostrClosedMessage
  | NostrNoticeMessage
  | NostrRelayAuthMessage;

/** Union type of all possible message types */
export type NostrMessage = NostrClientMessage | NostrRelayMessage;

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
 * Interface for relay connection options
 */
export interface RelayConnectionOptions {
  /** Optional canonical diagnostic logger. */
  logger?: import("../utils/logger").DiagnosticLogger;
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
  /** Inbound relay EVENT validation settings */
  inboundValidation?: {
    /** Maximum allowed future timestamp deviation in seconds; values greater than 0 enable the check, while 0 or negative values disable it */
    maxFutureTimestampDrift?: number;
    /** Maximum allowed past timestamp deviation in seconds; values greater than 0 enable the check, while 0 or negative values disable it */
    maxPastTimestampDrift?: number;
  };
  /** Optional list of ephemeral subscriptions to initialize with */
  ephemeralSubscriptions?: Array<{
    filters: NostrFilter[];
    onEvent: (event: NostrEvent) => void;
    onEOSE?: () => void;
  }>;
}
