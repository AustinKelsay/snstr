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

class StrictDispatchWebSocket {
  static instances: StrictDispatchWebSocket[] = [];
  static lifecycle:
    | "open"
    | "error"
    | "close"
    | "hang" = "open";
  readyState = StrictDispatchWebSocket.CONNECTING;
  private _onopen: (() => void) | null = null;
  private _onclose:
    | ((event: { type: string; code?: number; reason?: string }) => void)
    | null = null;
  private _onerror: ((error: unknown) => void) | null = null;
  private _onmessage: ((msg: { data: string }) => void) | null = null;

  constructor(public url: string) {
    StrictDispatchWebSocket.instances.push(this);
    setTimeout(() => {
      if (StrictDispatchWebSocket.lifecycle === "open") {
        this.readyState = StrictDispatchWebSocket.OPEN;
        this._onopen?.();
      } else if (StrictDispatchWebSocket.lifecycle === "close") {
        this.readyState = StrictDispatchWebSocket.CLOSED;
        this._onclose?.({
          type: "close",
          code: 1006,
          reason: "Strict pre-connect close",
        });
      } else if (StrictDispatchWebSocket.lifecycle === "error") {
        this._onerror?.(new Error("Strict pre-connect error"));
      }
      StrictDispatchWebSocket.lifecycle = "open";
    }, 0);
  }

  get onopen() {
    return this._onopen;
  }
  set onopen(handler: (() => void) | null) {
    this._onopen = handler;
  }

  get onclose() {
    return this._onclose;
  }
  set onclose(
    handler:
      | ((event: { type: string; code?: number; reason?: string }) => void)
      | null,
  ) {
    this._onclose = handler;
  }

  get onerror() {
    return this._onerror;
  }
  set onerror(handler: ((error: unknown) => void) | null) {
    this._onerror = handler;
  }

  get onmessage() {
    return this._onmessage;
  }
  set onmessage(handler: ((msg: { data: string }) => void) | null) {
    this._onmessage = handler;
  }

  send(_data: string) {}

  close() {
    const listener = this._onclose;
    queueMicrotask(() => {
      if (listener) {
        listener({
          type: "close",
          code: 1000,
          reason: "Strict polyfill cleanup",
        });
      }
    });
    this.readyState = StrictDispatchWebSocket.CLOSED;
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

  test("Relay.disconnect should detach socket handlers safely for strict dispatchers", async () => {
    const capturedErrors: unknown[] = [];
    const handleUncaught = (error: unknown) => {
      capturedErrors.push(error);
    };

    StrictDispatchWebSocket.instances.length = 0;
    useWebSocketImplementation(
      StrictDispatchWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://example.com");

    const connected = await relay.connect();
    expect(connected).toBe(true);
    expect(StrictDispatchWebSocket.instances.length).toBe(1);

    const socket = StrictDispatchWebSocket.instances[0];
    process.once("uncaughtException", handleUncaught);
    try {
      relay.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(typeof socket.onopen).toBe("function");
      expect(typeof socket.onclose).toBe("function");
      expect(typeof socket.onerror).toBe("function");
      expect(typeof socket.onmessage).toBe("function");
      expect(capturedErrors).toHaveLength(0);
    } finally {
      process.removeListener("uncaughtException", handleUncaught);
      relay.disconnect();
    }
  });

  test("Relay.disconnect should detach socket handlers on pre-connect close", async () => {
    const capturedErrors: unknown[] = [];
    const handleUncaught = (error: unknown) => {
      capturedErrors.push(error);
    };

    StrictDispatchWebSocket.instances.length = 0;
    StrictDispatchWebSocket.lifecycle = "close";
    useWebSocketImplementation(
      StrictDispatchWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://example.com");

    const connectPromise = relay.connect();
    expect(StrictDispatchWebSocket.instances.length).toBe(1);

    const socket = StrictDispatchWebSocket.instances[0];
    process.once("uncaughtException", handleUncaught);
    try {
      await expect(connectPromise).rejects.toBeInstanceOf(Error);
      relay.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(typeof socket.onopen).toBe("function");
      expect(typeof socket.onclose).toBe("function");
      expect(typeof socket.onerror).toBe("function");
      expect(typeof socket.onmessage).toBe("function");
      expect(capturedErrors).toHaveLength(0);
    } finally {
      process.removeListener("uncaughtException", handleUncaught);
      relay.disconnect();
    }
  });

  test("Relay.disconnect should detach socket handlers on pre-connect error", async () => {
    const capturedErrors: unknown[] = [];
    const handleUncaught = (error: unknown) => {
      capturedErrors.push(error);
    };

    StrictDispatchWebSocket.instances.length = 0;
    StrictDispatchWebSocket.lifecycle = "error";
    useWebSocketImplementation(
      StrictDispatchWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://example.com");

    const connectPromise = relay.connect();
    expect(StrictDispatchWebSocket.instances.length).toBe(1);

    const socket = StrictDispatchWebSocket.instances[0];
    process.once("uncaughtException", handleUncaught);
    try {
      await expect(connectPromise).rejects.toBeInstanceOf(Error);
      relay.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(typeof socket.onopen).toBe("function");
      expect(typeof socket.onclose).toBe("function");
      expect(typeof socket.onerror).toBe("function");
      expect(typeof socket.onmessage).toBe("function");
      expect(capturedErrors).toHaveLength(0);
    } finally {
      process.removeListener("uncaughtException", handleUncaught);
      relay.disconnect();
    }
  });

  test("Relay.disconnect should detach socket handlers on pre-connect timeout", async () => {
    const capturedErrors: unknown[] = [];
    const handleUncaught = (error: unknown) => {
      capturedErrors.push(error);
    };

    StrictDispatchWebSocket.instances.length = 0;
    StrictDispatchWebSocket.lifecycle = "hang";
    useWebSocketImplementation(
      StrictDispatchWebSocket as unknown as typeof WebSocket,
    );
    const relay = new Relay("wss://example.com", {
      connectionTimeout: 10,
    });

    const connectPromise = relay.connect();
    expect(StrictDispatchWebSocket.instances.length).toBe(1);

    const socket = StrictDispatchWebSocket.instances[0];
    process.once("uncaughtException", handleUncaught);
    try {
      await expect(connectPromise).rejects.toThrow("connection timeout");
      relay.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(typeof socket.onopen).toBe("function");
      expect(typeof socket.onclose).toBe("function");
      expect(typeof socket.onerror).toBe("function");
      expect(typeof socket.onmessage).toBe("function");
      expect(capturedErrors).toHaveLength(0);
    } finally {
      process.removeListener("uncaughtException", handleUncaught);
      relay.disconnect();
    }
  });
});
