import {
  useWebSocketImplementation,
  resetWebSocketImplementation,
} from "./src/utils/websocket";
import { WebSocket as WSWebSocket } from "ws";
import { jest } from "@jest/globals";

// Ensure tests run in test environment (cast to bypass TS readonly typing)
(process.env as Record<string, string>).NODE_ENV = "test";

// Increase Jest timeout for async operations
jest.setTimeout(30000);

// Mock window.open for auth challenge tests when DOM globals exist
if (typeof window !== "undefined") {
  window.open = jest.fn(() => null) as unknown as typeof window.open;
}

// Use the ws implementation for tests to ensure compatibility with the in-process relay
const wsImpl = WSWebSocket as unknown as typeof WebSocket;
(globalThis as Record<string, unknown>).WebSocket = wsImpl;
useWebSocketImplementation(wsImpl);

// Ensure any code that resets the implementation picks up the test WebSocket
resetWebSocketImplementation();

// Suppress expected console noise from tests that validate error paths.
// Use beforeEach so test suites that call jest.restoreAllMocks() don't permanently
// re-enable warnings/errors for the rest of the run (which can also break CI output).
const noop = () => {};

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(noop);
  jest.spyOn(console, "warn").mockImplementation(noop);
});
