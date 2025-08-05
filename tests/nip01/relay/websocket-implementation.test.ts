import { Relay } from "../../../src";
import {
  useWebSocketImplementation,
  resetWebSocketImplementation,
} from "../../../src/utils/websocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }
  send(_data: string) {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

describe("useWebSocketImplementation", () => {
  let originalGlobalWebSocket: typeof WebSocket | undefined;

  beforeEach(() => {
    // Save the original globalThis.WebSocket before each test
    originalGlobalWebSocket = globalThis.WebSocket;

    MockWebSocket.instances.length = 0;
    useWebSocketImplementation(MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    // Restore the original globalThis.WebSocket after each test
    if (originalGlobalWebSocket) {
      globalThis.WebSocket = originalGlobalWebSocket;
    } else {
      // If there was no original WebSocket, remove it from globalThis
      delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    }

    resetWebSocketImplementation();
  });

  test("Relay.connect should use injected WebSocket", async () => {
    const relay = new Relay("wss://example.com");
    const result = await relay.connect();
    expect(result).toBe(true);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe("wss://example.com");
    relay.disconnect();
  });
});
