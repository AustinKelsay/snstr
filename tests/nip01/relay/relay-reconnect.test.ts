/**
 * Tests for Relay Reconnection functionality
 */

import { Relay, ReconnectionStrategy } from "../../../src";
import { RelayConnectionOptions } from "../../../src/types/protocol";
import { asTestRelay } from "../../types";

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

  test("should initialize with default reconnection options", () => {
    const relay = createRelay("wss://test.relay");
    const testRelay = asTestRelay(relay);

    // Verify the relay has the expected default values
    expect(testRelay.autoReconnect).toBe(true);
    expect(testRelay.maxReconnectAttempts).toBe(10);
    expect(testRelay.maxReconnectDelay).toBe(30000);
    expect(testRelay.reconnectAttempts).toBe(0);
  });

  test("should allow custom reconnection options", () => {
    const options: RelayConnectionOptions = {
      autoReconnect: false,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 15000,
    };

    const relay = createRelay("wss://test.relay", options);
    const testRelay = asTestRelay(relay);

    // Verify the custom options were applied
    expect(testRelay.autoReconnect).toBe(false);
    expect(testRelay.maxReconnectAttempts).toBe(5);
    expect(testRelay.maxReconnectDelay).toBe(15000);
  });

  test("should allow changing auto-reconnect setting", () => {
    const relay = createRelay("wss://test.relay", { autoReconnect: false });
    const testRelay = asTestRelay(relay);

    // Verify initial state
    expect(testRelay.autoReconnect).toBe(false);

    // Change the setting
    relay.setAutoReconnect(true);

    // Verify the setting was updated
    expect(testRelay.autoReconnect).toBe(true);
  });

  test("should allow changing max reconnect attempts", () => {
    const relay = createRelay("wss://test.relay");
    const testRelay = asTestRelay(relay);

    // Change the setting
    relay.setMaxReconnectAttempts(20);

    // Verify the setting was updated
    expect(testRelay.maxReconnectAttempts).toBe(20);
  });

  test("should allow changing max reconnect delay", () => {
    const relay = createRelay("wss://test.relay");
    const testRelay = asTestRelay(relay);

    // Change the setting
    relay.setMaxReconnectDelay(60000);

    // Verify the setting was updated
    expect(testRelay.maxReconnectDelay).toBe(60000);
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
    const relay = createRelay("wss://test.relay", {
      autoReconnect: strategy.enabled,
      maxReconnectAttempts: strategy.maxAttempts,
      maxReconnectDelay: strategy.maxDelay,
    });
    const testRelay = asTestRelay(relay);

    // Verify basic properties were applied
    expect(testRelay.autoReconnect).toBe(strategy.enabled);
    expect(testRelay.maxReconnectAttempts).toBe(strategy.maxAttempts);
    expect(testRelay.maxReconnectDelay).toBe(strategy.maxDelay);
  });
});
