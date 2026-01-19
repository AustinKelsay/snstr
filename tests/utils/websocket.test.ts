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

type ModuleExportsTest = typeof import("../../src/utils/websocket");

async function loadModuleWithMocks(params: {
  native?: WebSocketCtorTest;
  polyfill?: WebSocketCtorTest;
}): Promise<ModuleExportsTest> {
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

  const moduleExports = (await import(
    "../../src/utils/websocket"
  )) as ModuleExportsTest;
  jest.dontMock("websocket-polyfill");

  return moduleExports;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).WebSocket;
  jest.resetModules();
  jest.clearAllMocks();
});

describe("utils/websocket default selection", () => {
  test("prefers native WebSocket when it has required features", async () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "native",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "polyfill",
    });

    const { getWebSocketImplementation } = await loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("falls back to polyfill when native implementation lacks binaryType setter", async () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "native-no-setter",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: true,
      label: "polyfill",
    });

    const { getWebSocketImplementation } = await loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(polyfillWS);
  });

  test("falls back to native implementation when both lack required features", async () => {
    const nativeWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "native-no-setter",
    });
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "polyfill-no-setter",
    });

    const { getWebSocketImplementation } = await loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("throws when no implementation is available", async () => {
    const { getWebSocketImplementation } = await loadModuleWithMocks({});

    expect(() => getWebSocketImplementation()).toThrow(
      "WebSocket implementation not available. Make sure websocket-polyfill is properly loaded.",
    );
  });
});

describe("utils/websocket overrides", () => {
  test("useWebSocketImplementation overrides and reset restores default", async () => {
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
    } = await loadModuleWithMocks({
      native: nativeWS,
      polyfill: polyfillWS,
    });

    expect(getWebSocketImplementation()).toBe(nativeWS);

    useWebSocketImplementation(customWS as unknown as typeof WebSocket);
    expect(getWebSocketImplementation()).toBe(customWS);

    resetWebSocketImplementation();
    expect(getWebSocketImplementation()).toBe(nativeWS);
  });

  test("resetWebSocketImplementation picks up runtime global WebSocket changes", async () => {
    const polyfillWS = createMockWebSocket({
      hasBinaryTypeSetter: false,
      label: "polyfill-no-setter",
    });

    const { getWebSocketImplementation, resetWebSocketImplementation } =
      await loadModuleWithMocks({
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
