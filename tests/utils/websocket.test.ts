import {
  getWebSocketImplementation,
  resetWebSocketImplementation,
  useWebSocketImplementation,
} from "../../src/utils/websocket";

type WebSocketCtorTest = {
  new (...args: unknown[]): unknown;
  prototype: Record<string, unknown>;
};

function createMockWebSocket(options: {
  hasBinaryTypeSetter: boolean;
  label: string;
}): WebSocketCtorTest {
  class MockWebSocket {
    public static label = options.label;
    public binaryTypeValue: string = "blob";

    send(): void {
      /* no-op */
    }

    close(): void {
      /* no-op */
    }
  }

  Object.defineProperty(MockWebSocket.prototype, "binaryType", {
    configurable: true,
    enumerable: true,
    get(this: MockWebSocket) {
      return this.binaryTypeValue;
    },
    ...(options.hasBinaryTypeSetter
      ? {
          set(this: MockWebSocket, value: string) {
            this.binaryTypeValue = value;
          },
        }
      : {}),
  });

  return MockWebSocket as unknown as WebSocketCtorTest;
}

afterEach(() => {
  // Restore module-selected default after each test to avoid test leakage.
  resetWebSocketImplementation();
});

describe("utils/websocket", () => {
  test("returns a default implementation when available", () => {
    const implementation = getWebSocketImplementation();
    expect(implementation).toBeDefined();
  });

  test("useWebSocketImplementation overrides the current implementation", () => {
    const customWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "custom",
    });

    useWebSocketImplementation(customWS as unknown as typeof WebSocket);

    expect(getWebSocketImplementation()).toBe(customWS);
  });

  test("resetWebSocketImplementation picks up runtime global WebSocket changes", () => {
    const runtimeWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "runtime",
    });

    (globalThis as Record<string, unknown>).WebSocket =
      runtimeWS as unknown as typeof WebSocket;

    resetWebSocketImplementation();

    expect(getWebSocketImplementation()).toBe(runtimeWS);
  });

  test("throws when implementation is explicitly unset", () => {
    useWebSocketImplementation(undefined as unknown as typeof WebSocket);

    expect(() => getWebSocketImplementation()).toThrow(
      "WebSocket implementation not available. Make sure websocket-polyfill is properly loaded.",
    );
  });
});
