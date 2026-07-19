/**
 * Tests for Relay Reconnection functionality
 */

import { Relay } from "../../../src";
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

  function captureReconnectTimers(): {
    callbacks: Array<() => void>;
    delays: number[];
    restore(): void;
  } {
    const callbacks: Array<() => void> = [];
    const delays: number[] = [];
    const timeoutSpy = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback: TimerHandler, delay?: number) => {
        const timer = { unref: () => timer } as unknown as NodeJS.Timeout;
        callbacks.push(callback as () => void);
        delays.push(delay ?? 0);
        return timer;
      });
    return {
      callbacks,
      delays,
      restore: () => timeoutSpy.mockRestore(),
    };
  }

  test("applies constructor reconnection limits and capped delay", () => {
    const options: RelayConnectionOptions = {
      autoReconnect: true,
      maxReconnectAttempts: 2,
      maxReconnectDelay: 1500,
    };
    const timers = captureReconnectTimers();
    const relay = createRelay("wss://test.relay", options);
    const connectSpy = jest.spyOn(relay, "connect").mockResolvedValue(true);

    try {
      scheduleRelayReconnect(relay);
      timers.callbacks[0]();
      scheduleRelayReconnect(relay);
      timers.callbacks[1]();
      scheduleRelayReconnect(relay);

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(timers.callbacks).toHaveLength(2);
      expect(timers.delays[1]).toBeGreaterThanOrEqual(1500);
      expect(timers.delays[1]).toBeLessThanOrEqual(1950);
    } finally {
      connectSpy.mockRestore();
      timers.restore();
    }
  });

  test("applies reconnect limit and delay changes to scheduling behavior", () => {
    const relay = createRelay("wss://test.relay");
    const timers = captureReconnectTimers();
    const connectSpy = jest.spyOn(relay, "connect").mockResolvedValue(true);

    try {
      relay.setMaxReconnectAttempts(2);
      relay.setMaxReconnectDelay(1200);
      scheduleRelayReconnect(relay);
      timers.callbacks[0]();
      scheduleRelayReconnect(relay);
      timers.callbacks[1]();
      scheduleRelayReconnect(relay);

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(timers.callbacks).toHaveLength(2);
      expect(timers.delays[1]).toBeGreaterThanOrEqual(1200);
      expect(timers.delays[1]).toBeLessThanOrEqual(1560);
    } finally {
      connectSpy.mockRestore();
      timers.restore();
    }
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
});
