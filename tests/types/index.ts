import {
  NostrEvent,
  PublishOptions,
  PublishResponse,
  Relay,
  RelayEvent,
  RelayEventCallbacks,
} from "../../src";
import { NostrRelay } from "../../src/testing";
import { normalizeRelayUrl as normalizeRelayUrlUtil } from "../../src/utils/relayUrl";

/**
 * Interface for mocking a Relay in tests
 */
export interface MockRelay {
  url: string;
  connected: boolean;
  publishResults: PublishResponse[];
  publish(
    event: NostrEvent,
    options?: PublishOptions,
  ): Promise<PublishResponse>;
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
  authenticate?(
    authEvent: NostrEvent,
    options?: PublishOptions,
  ): Promise<PublishResponse>;
  getLatestReplaceableEvent?(
    pubkey: string,
    kind: number,
  ): NostrEvent | undefined;
}

/**
 * Type guard to check if a relay is a MockRelay
 */
export function isMockRelay(relay: Relay | MockRelay): relay is MockRelay {
  return "publishResults" in relay;
}

/**
 * Type definitions for Relay event callbacks used in tests.
 * These are aliases of the library's `RelayEventCallbacks` type
 * for consistency and to avoid type duplication.
 */
export type RelayConnectCallback = RelayEventCallbacks[RelayEvent.Connect];
export type RelayDisconnectCallback =
  RelayEventCallbacks[RelayEvent.Disconnect];
export type RelayErrorCallback = RelayEventCallbacks[RelayEvent.Error];
export type RelayNoticeCallback = RelayEventCallbacks[RelayEvent.Notice];
export type RelayOkCallback = RelayEventCallbacks[RelayEvent.OK];
export type RelayClosedCallback = RelayEventCallbacks[RelayEvent.Closed];
export type RelayAuthCallback = RelayEventCallbacks[RelayEvent.Auth];
export type RelayEventCallback = (event: NostrEvent) => void;
export type RelayEoseCallback = () => void;

/**
 * Type for all possible relay callbacks mapped by event type
 */
export type RelayCallbacks = RelayEventCallbacks;

/**
 * Type for captured callbacks in tests
 */
export type CapturedCallbacks = {
  [K in RelayEvent]?: RelayEventCallbacks[K][];
};

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

  /**
   * Normalize a relay URL for testing purposes
   * Uses the shared utility to ensure consistent normalization behavior
   * across the codebase.
   */
  normalizeRelayUrl: (url: string): string => {
    return normalizeRelayUrlUtil(url);
  },

  /** Sleep helper to replace scattered setTimeout wrappers in tests */
  sleep: (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Wait until a condition becomes true or timeout elapses.
   * Polls every `intervalMs` to avoid long fixed delays while keeping determinism.
   */
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 2000,
    intervalMs = 10,
  ): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await condition()) return;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Condition not met within ${timeoutMs}ms`);
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
