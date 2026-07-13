// Capture the platform WebSocket. The Node package entry installs its polyfill
// before loading this module; browser/React Native use their native global.
const OriginalWebSocket: typeof WebSocket | undefined = globalThis.WebSocket;

type InMemoryWebSocketFactory = (url: string) => unknown | undefined;

let inMemoryWebSocketFactory: InMemoryWebSocketFactory | undefined;

function hasRequiredWebSocketFeatures(
  wsCtor: typeof WebSocket | undefined,
): wsCtor is typeof WebSocket {
  if (!wsCtor || !wsCtor.prototype) {
    return false;
  }

  const proto = wsCtor.prototype;
  const binaryTypeDescriptor = Object.getOwnPropertyDescriptor(
    proto,
    "binaryType",
  );

  const hasSend = typeof proto.send === "function";
  const hasClose = typeof proto.close === "function";
  const hasBinaryTypeSetter = typeof binaryTypeDescriptor?.set === "function";

  return hasSend && hasClose && hasBinaryTypeSetter;
}

function resolveDefaultWebSocket(): typeof WebSocket | undefined {
  const currentGlobal = globalThis.WebSocket;

  const candidatesWithPriority: (typeof WebSocket | undefined)[] = [];

  if (
    currentGlobal &&
    currentGlobal !== OriginalWebSocket
  ) {
    candidatesWithPriority.push(currentGlobal);
  }

  candidatesWithPriority.push(OriginalWebSocket);

  for (const candidate of candidatesWithPriority) {
    if (hasRequiredWebSocketFeatures(candidate)) {
      return candidate;
    }
  }

  const fallbackCandidates: (typeof WebSocket | undefined)[] = [
    OriginalWebSocket,
    currentGlobal,
  ];

  for (const candidate of fallbackCandidates) {
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

let WebSocketImpl: typeof WebSocket | undefined = resolveDefaultWebSocket();

export function useWebSocketImplementation(wsCtor: typeof WebSocket) {
  WebSocketImpl = wsCtor;
}

export function resetWebSocketImplementation() {
  WebSocketImpl = resolveDefaultWebSocket();
}

export function getWebSocketImplementation(): typeof WebSocket {
  if (!WebSocketImpl) {
    throw new Error(
      "WebSocket implementation not available. Make sure websocket-polyfill is properly loaded.",
    );
  }
  return WebSocketImpl;
}

export function useInMemoryWebSocketFactory(
  factory: InMemoryWebSocketFactory,
): void {
  inMemoryWebSocketFactory = factory;
}

export function getInMemoryWebSocket(url: string): unknown | undefined {
  return inMemoryWebSocketFactory?.(url);
}
