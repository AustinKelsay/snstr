type WebSocketCtor = {
  new (...args: unknown[]): unknown;
  prototype: Record<string, unknown>;
};

function createMockWebSocket(
  options: { hasBinaryTypeSetter: boolean; label: string },
): WebSocketCtor {
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

  return MockWebSocket as unknown as WebSocketCtor;
}

type ModuleExports = typeof import("../../src/utils/websocket");

function loadModuleWithMocks(params: {
  native?: WebSocketCtor;
  polyfill?: WebSocketCtor;
}): ModuleExports {
  jest.resetModules();

  if (params.native) {
    (globalThis as Record<string, unknown>).WebSocket =
      params.native as unknown as typeof WebSocket;
  } else {
    delete (globalThis as Record<string, unknown>).WebSocket;
  }

  jest.doMock("websocket-polyfill", () => {
    if (params.polyfill) {
      (globalThis as Record<string, unknown>).WebSocket =
        params.polyfill as unknown as typeof WebSocket;
    } else {
      delete (globalThis as Record<string, unknown>).WebSocket;
    }
    return {};
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const moduleExports = require("../../src/utils/websocket") as ModuleExports;
  jest.dontMock("websocket-polyfill");

  return moduleExports;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).WebSocket;
  jest.resetModules();
  jest.clearAllMocks();
});

describe("utils/websocket default selection", () => {
  test("prefers native WebSocket when it has required features", () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "native",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "polyfill",
    });

    const { getWebSocketImplementation } = loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("falls back to polyfill when native implementation lacks binaryType setter", () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "native-no-setter",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "polyfill",
    });

    const { getWebSocketImplementation } = loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(polyfillWS);
  });

  test("falls back to native implementation when both lack required features", () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "native-no-setter",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "polyfill-no-setter",
    });

    const { getWebSocketImplementation } = loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("throws when no implementation is available", () => {
    const { getWebSocketImplementation } = loadModuleWithMocks({});

    expect(() => getWebSocketImplementation()).toThrow(
      "WebSocket implementation not available. Make sure websocket-polyfill is properly loaded.",
    );
  });
});

describe("utils/websocket overrides", () => {
  test("useWebSocketImplementation overrides and reset restores default", () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "native",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "polyfill-no-setter",
    });

    const customWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "custom",
    });

    const {
      getWebSocketImplementation,
      useWebSocketImplementation,
      resetWebSocketImplementation,
    } = loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);

    useWebSocketImplementation(customWS as unknown as typeof WebSocket);
    expect(getWebSocketImplementation()).toBe(customWS);

    resetWebSocketImplementation();
    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("resetWebSocketImplementation picks up runtime global WebSocket changes", () => {
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "polyfill-no-setter",
    });

    const {
      getWebSocketImplementation,
      resetWebSocketImplementation,
    } = loadModuleWithMocks({
      native: undefined,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(polyfillWS);

    const runtimeWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "runtime",
    });

    (globalThis as Record<string, unknown>).WebSocket =
      runtimeWS as unknown as typeof WebSocket;

    resetWebSocketImplementation();

    expect(getWebSocketImplementation()).toBe(runtimeWS);
  });
});
