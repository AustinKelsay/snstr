import {
  Nostr,
  NostrEvent,
  Relay,
  RelayEvent,
  Subscription,
  ParsedOkReason,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

/**
 * Interface for mocking a Relay in tests
 */
export interface MockRelay {
  url: string;
  connected: boolean;
  publishResults: { success: boolean; reason?: string }[];
  publish(
    event: NostrEvent,
    options?: { timeout?: number },
  ): Promise<{ success: boolean; reason?: string }>;
  connect(): Promise<boolean>;
  disconnect(): void;
  on(): void;
  off(): void;
  setConnectionTimeout(timeout: number): void;
  getConnectionTimeout(): number;
  getLatestAddressableEvent?(
    kind: number,
    pubkey: string,
    dTagValue: string,
  ): NostrEvent | undefined;
  getAddressableEventsByPubkey?(pubkey: string): NostrEvent[];
  getAddressableEventsByKind?(kind: number): NostrEvent[];
}

/**
 * Interface for accessing private members of the Nostr class during testing
 * DO NOT USE THIS IN PRODUCTION CODE!
 */
export interface NostrInternals {
  privateKey: string;
  publicKey: string;
  relays: Map<string, Relay | MockRelay>;
  relayOptions?: {
    connectionTimeout?: number;
    bufferFlushDelay?: number;
  };
}

/**
 * Type guard to check if a relay is a MockRelay
 */
export function isMockRelay(relay: Relay | MockRelay): relay is MockRelay {
  return "publishResults" in relay;
}

/**
 * Safe cast from Nostr to NostrInternals for testing
 */
export function getNostrInternals(client: Nostr): NostrInternals {
  return client as unknown as NostrInternals;
}

/**
 * Interface for accessing private members of Relay class in tests
 * This provides type-safe access to internal implementation details
 * DO NOT USE THIS IN PRODUCTION CODE!
 */
export interface RelayTestAccess {
  // Public properties and methods from Relay
  url: string;
  connect(): Promise<boolean>;
  disconnect(): void;
  getSubscriptionIds(): Set<string>;
  setConnectionTimeout(timeout: number): void;
  getConnectionTimeout(): number;

  // Private connection related properties
  ws: WebSocket | null;
  connectionPromise: Promise<boolean> | null;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  maxReconnectDelay: number;
  reconnectAttempts: number;
  connected: boolean;

  // Private internal state
  subscriptions: Map<string, Subscription>;
  eventBuffers: Map<string, NostrEvent[]>;
  status: string;

  // Private internal methods
  handleMessage(message: string[] | unknown[]): void;
  processValidatedEvent(event: NostrEvent, subscriptionId: string): void;
  processReplaceableEvent(event: NostrEvent): void;
  processAddressableEvent(event: NostrEvent): void;
  flushSubscriptionBuffer(subscriptionId: string): void;
  performBasicValidation(event: NostrEvent): boolean;
  validateEvent(event: NostrEvent): boolean;
  validateEventAsync(event: NostrEvent): Promise<boolean>;
}

/**
 * Helper function to safely cast a Relay to RelayTestAccess for testing
 * This makes the code intention clearer than using "as any"
 */
export function asTestRelay(relay: Relay): RelayTestAccess {
  return relay as unknown as RelayTestAccess;
}

/**
 * Type definitions for Relay event callbacks used in tests
 */
export type RelayConnectCallback = (relay: string) => void;
export type RelayDisconnectCallback = (relay: string) => void;
export type RelayErrorCallback = (relay: string, error: unknown) => void;
export type RelayNoticeCallback = (relay: string, notice: string) => void;
export type RelayOkCallback = (
  eventId: string,
  success: boolean,
  details: ParsedOkReason,
) => void;
export type RelayClosedCallback = (
  subscriptionId: string,
  message: string,
) => void;
export type RelayAuthCallback = (challengeEvent: NostrEvent) => void;
export type RelayEventCallback = (event: NostrEvent) => void;
export type RelayEoseCallback = () => void;

/**
 * Type for all possible relay callbacks mapped by event type
 */
export interface RelayCallbacks {
  [RelayEvent.Connect]: RelayConnectCallback;
  [RelayEvent.Disconnect]: RelayDisconnectCallback;
  [RelayEvent.Error]: RelayErrorCallback;
  [RelayEvent.Notice]: RelayNoticeCallback;
  [RelayEvent.OK]: RelayOkCallback;
  [RelayEvent.Closed]: RelayClosedCallback;
  [RelayEvent.Auth]: RelayAuthCallback;
}

/**
 * Type for captured callbacks in tests
 */
export interface CapturedCallbacks {
  [RelayEvent.Connect]?: RelayConnectCallback[];
  [RelayEvent.Disconnect]?: RelayDisconnectCallback[];
  [RelayEvent.Error]?: RelayErrorCallback[];
  [RelayEvent.Notice]?: RelayNoticeCallback[];
  [RelayEvent.OK]?: RelayOkCallback[];
  [RelayEvent.Closed]?: RelayClosedCallback[];
  [RelayEvent.Auth]?: RelayAuthCallback[];
}

/**
 * Helper function to safely capture a Relay callback in tests
 * Reduces 'any' usage and ensures type safety when invoking the callback
 */
export function captureCallback<T extends keyof RelayCallbacks>(
  eventType: T,
  callback: (...args: Parameters<RelayCallbacks[T]>) => void,
): RelayCallbacks[T] {
  // wrapper can later be extended to push calls into a test buffer
  return callback as RelayCallbacks[T];
}

/**
 * Testing utility functions
 */
export const testUtils = {
  /**
   * Clear the cache of a NostrRelay instance
   * Type-safe way to clear internal relay cache for testing
   */
  clearRelayCache: (relay: NostrRelay): void => {
    // Access the internal cache with a more explicit casting approach
    (relay as unknown as { _cache: NostrEvent[] })._cache = [];
  },
};

/**
 * Interface for mock objects that use Jest's mocking functionality
 */
export interface MockRelayWithJest {
  getLatestAddressableEvent: jest.Mock;
  getAddressableEventsByPubkey: jest.Mock;
  getAddressableEventsByKind: jest.Mock;
}
