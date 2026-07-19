/**
 * Tests for Relay Reconnection functionality
 */

import { Relay, ReconnectionStrategy } from "../../../src";
import { scheduleRelayReconnect } from "../../../src/testing";
import { RelayConnectionOptions } from "../../../src/types/protocol";

// Mock WebSocket
jest.mock("websocket-polyfill", () => ({}));

// Suppress console output during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Relay: Reconnection Configuration", () => {
  // Store created relays to clean up after tests
  const relays: Relay[] = [];

  afterEach(() => {
    // Clean up relays created during tests
    relays.forEach((relay) => relay.disconnect());
    relays.length = 0;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore console functionality
    jest.restoreAllMocks();
  });

  // Helper to create a relay and track it for cleanup
  function createRelay(
    url: string,
    options: RelayConnectionOptions = {},
  ): Relay {
    const relay = new Relay(url, options);
    relays.push(relay);
    return relay;
  }

  test("accepts custom reconnection options", () => {
    const options: RelayConnectionOptions = {
      autoReconnect: false,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 15000,
    };

    expect(() => createRelay("wss://test.relay", options)).not.toThrow();
  });

  test("accepts valid reconnect configuration changes", () => {
    const relay = createRelay("wss://test.relay");

    expect(() => relay.setAutoReconnect(false)).not.toThrow();
    expect(() => relay.setMaxReconnectAttempts(20)).not.toThrow();
    expect(() => relay.setMaxReconnectDelay(60000)).not.toThrow();
  });

  test("should validate max reconnect attempts (non-negative)", () => {
    const relay = createRelay("wss://test.relay");

    // Attempt to set an invalid value
    expect(() => {
      relay.setMaxReconnectAttempts(-1);
    }).toThrow(/non-negative/);
  });

  test("should validate max reconnect delay (minimum 1000ms)", () => {
    const relay = createRelay("wss://test.relay");

    // Attempt to set an invalid value
    expect(() => {
      relay.setMaxReconnectDelay(500);
    }).toThrow(/at least 1000ms/);
  });

  test("disabling auto-reconnect cancels an already queued attempt", () => {
    const relay = createRelay("wss://test.relay");
    const queuedReconnects: Array<() => void> = [];
    const timeoutSpy = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback: TimerHandler) => {
        const timer = { unref: () => timer } as unknown as NodeJS.Timeout;
        queuedReconnects.push(callback as () => void);
        return timer;
      });
    const connectSpy = jest.spyOn(relay, "connect").mockResolvedValue(true);

    try {
      scheduleRelayReconnect(relay);
      relay.setAutoReconnect(false);
      queuedReconnects[0]();

      expect(connectSpy).not.toHaveBeenCalled();
    } finally {
      connectSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });

  test("enforces the configured maximum reconnect attempts", () => {
    const relay = createRelay("wss://test.relay");
    const queuedReconnects: Array<() => void> = [];
    const timeoutSpy = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback: TimerHandler) => {
        const timer = { unref: () => timer } as unknown as NodeJS.Timeout;
        queuedReconnects.push(callback as () => void);
        return timer;
      });
    const connectSpy = jest.spyOn(relay, "connect").mockResolvedValue(true);

    try {
      relay.setMaxReconnectAttempts(2);
      scheduleRelayReconnect(relay);
      queuedReconnects[0]();
      scheduleRelayReconnect(relay);
      queuedReconnects[1]();
      scheduleRelayReconnect(relay);

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(queuedReconnects).toHaveLength(2);
    } finally {
      connectSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });

  test("ignores stale queued callbacks without losing the replacement attempt", () => {
    const relay = createRelay("wss://test.relay");
    const queuedReconnects: Array<() => void> = [];
    const timeoutSpy = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback: TimerHandler) => {
        const timer = {
          unref: () => timer,
        } as unknown as NodeJS.Timeout;
        queuedReconnects.push(callback as () => void);
        return timer;
      });
    const connectSpy = jest.spyOn(relay, "connect").mockResolvedValue(true);

    try {
      scheduleRelayReconnect(relay);
      relay.disconnect();
      scheduleRelayReconnect(relay);

      queuedReconnects[0]();
      expect(connectSpy).not.toHaveBeenCalled();

      queuedReconnects[1]();
      expect(connectSpy).toHaveBeenCalledTimes(1);

      scheduleRelayReconnect(relay);
      relay.disconnect();
      queuedReconnects[2]();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    } finally {
      connectSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });

  // Additional test for ReconnectionStrategy interface
  test("should be configurable with a full ReconnectionStrategy", () => {
    // This test serves as a type-check for future implementation
    // that uses the ReconnectionStrategy interface directly

    // Define a strategy that could be used in the future
    const strategy: ReconnectionStrategy = {
      enabled: true,
      maxAttempts: 15,
      initialDelay: 1000,
      maxDelay: 45000,
      backoffFactor: 1.5,
      useJitter: true,
      jitterFactor: 0.2,
    };

    // Current implementation uses individual properties, but
    // we can test that we can extract these properties correctly
    expect(() =>
      createRelay("wss://test.relay", {
        autoReconnect: strategy.enabled,
        maxReconnectAttempts: strategy.maxAttempts,
        maxReconnectDelay: strategy.maxDelay,
      }),
    ).not.toThrow();
  });
});
