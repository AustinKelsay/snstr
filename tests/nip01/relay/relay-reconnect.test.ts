/**
 * Tests for Relay Reconnection functionality
 */

import { Relay } from "../../../src/nip01/relay";

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
  function createRelay(url: string, options = {}): Relay {
    const relay = new Relay(url, options);
    relays.push(relay);
    return relay;
  }

  test("should initialize with default reconnection options", () => {
    const relay = createRelay("wss://test.relay");

    // Verify the relay has the expected default values
    // We need to use 'as any' to access private properties for testing only
    expect((relay as any).autoReconnect).toBe(true);
    expect((relay as any).maxReconnectAttempts).toBe(10);
    expect((relay as any).maxReconnectDelay).toBe(30000);
    expect((relay as any).reconnectAttempts).toBe(0);
  });

  test("should allow custom reconnection options", () => {
    const relay = createRelay("wss://test.relay", {
      autoReconnect: false,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 15000,
    });

    // Verify the custom options were applied
    expect((relay as any).autoReconnect).toBe(false);
    expect((relay as any).maxReconnectAttempts).toBe(5);
    expect((relay as any).maxReconnectDelay).toBe(15000);
  });

  test("should allow changing auto-reconnect setting", () => {
    const relay = createRelay("wss://test.relay", { autoReconnect: false });

    // Verify initial state
    expect((relay as any).autoReconnect).toBe(false);

    // Change the setting
    relay.setAutoReconnect(true);

    // Verify the setting was updated
    expect((relay as any).autoReconnect).toBe(true);
  });

  test("should allow changing max reconnect attempts", () => {
    const relay = createRelay("wss://test.relay");

    // Change the setting
    relay.setMaxReconnectAttempts(20);

    // Verify the setting was updated
    expect((relay as any).maxReconnectAttempts).toBe(20);
  });

  test("should allow changing max reconnect delay", () => {
    const relay = createRelay("wss://test.relay");

    // Change the setting
    relay.setMaxReconnectDelay(60000);

    // Verify the setting was updated
    expect((relay as any).maxReconnectDelay).toBe(60000);
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
});
