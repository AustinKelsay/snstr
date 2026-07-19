/**
 * Node-only test support for integration suites and runnable examples.
 *
 * This subpath is supported within the 0.x release line but is not intended
 * for production relay hosting. Its API may evolve between minor 0.x releases.
 */
export { NostrRelay } from "../utils/ephemeral-relay";
export type { NostrRelayOptions } from "../utils/ephemeral-relay";
export {
  dispatchRelayMessage,
  getRelaySocket,
  installNostrTestRelay,
  installRelaySocket,
  replaceRelayInboundValidator,
  scheduleRelayReconnect,
  waitForRelayValidation,
} from "./behavior-controls";
export type { NostrTestRelay, RelayTestSocket } from "./behavior-controls";

import type {
  RelayEvent,
  RelayEventCallbacks,
  RelayInterface,
} from "../types/nostr";

/**
 * Framework-neutral callable used by relay test doubles. Test doubles need a
 * deliberately permissive parameter list so specifically typed functions and
 * framework mocks remain assignable under strict function variance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelayTestMock = (...args: any[]) => unknown;

/**
 * Relay test state for consumers that need to replace public relay methods and
 * capture callbacks without depending on one test framework's mock types.
 */
export interface RelayTestContext {
  /** The relay instance being tested. */
  relay: RelayInterface;
  /** Original methods or properties replaced by the test. */
  originals: {
    ws?: WebSocket | null;
    on?: <E extends RelayEvent>(
      event: E,
      callback: RelayEventCallbacks[E],
    ) => void;
    off?: <E extends RelayEvent>(
      event: E,
      callback: RelayEventCallbacks[E],
    ) => void;
  };
  /** Framework-neutral test doubles. */
  mocks: {
    send?: RelayTestMock;
    connect?: RelayTestMock;
    disconnect?: RelayTestMock;
    handlers?: {
      [key in RelayEvent]?: RelayTestMock;
    };
  };
  /** Callbacks captured from event registrations. */
  capturedCallbacks: {
    [E in RelayEvent]?: RelayEventCallbacks[E][];
  };
  /** Options passed to the relay under test. */
  options?: {
    connectionTimeout?: number;
    bufferFlushDelay?: number;
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    maxReconnectDelay?: number;
  };
}
