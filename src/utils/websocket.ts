// Capture the platform WebSocket. The Node package entry installs its polyfill
// before loading this module; browser/React Native use their native global.
const OriginalWebSocket: typeof WebSocket | undefined = globalThis.WebSocket;

type InMemoryWebSocketFactory = (url: string) => unknown | undefined;
type RelayDisconnectObserver = () => void;

let inMemoryWebSocketFactory: InMemoryWebSocketFactory | undefined;
const relayDisconnectObservers = new Map<
  string,
  Set<RelayDisconnectObserver>
>();

function normalizeWebSocketUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

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

  if (currentGlobal && currentGlobal !== OriginalWebSocket) {
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

/**
 * Register the process-wide factory used to resolve deterministic in-memory sockets.
 * Registering a new factory replaces the previous one for subsequent lookups.
 */
export function useInMemoryWebSocketFactory(
  factory: InMemoryWebSocketFactory,
): void {
  inMemoryWebSocketFactory = factory;
}

/**
 * Resolve an in-memory socket for the supplied URL when a factory is registered.
 *
 * This is an internal transport seam used by deterministic relay tests. It has
 * no effect until {@link useInMemoryWebSocketFactory} installs a process-wide
 * factory.
 */
export function getInMemoryWebSocket(url: string): unknown | undefined {
  return inMemoryWebSocketFactory?.(url);
}

/**
 * Register a process-local Relay client that must observe transport shutdown.
 * The returned function is idempotent and removes only this observer.
 */
export function registerRelayDisconnectObserver(
  url: string,
  observer: RelayDisconnectObserver,
): () => void {
  const normalizedUrl = normalizeWebSocketUrl(url);
  let observers = relayDisconnectObservers.get(normalizedUrl);
  if (!observers) {
    observers = new Set();
    relayDisconnectObservers.set(normalizedUrl, observers);
  }
  observers.add(observer);
  let registered = true;

  return () => {
    if (!registered) return;
    registered = false;
    const currentObservers = relayDisconnectObservers.get(normalizedUrl);
    currentObservers?.delete(observer);
    if (currentObservers?.size === 0) {
      relayDisconnectObservers.delete(normalizedUrl);
    }
  };
}

/**
 * Finalize active process-local Relay clients for exactly one Relay URL.
 * Observers are removed before invocation so late native callbacks and
 * re-entrant shutdown cannot notify the same connection twice.
 */
export function notifyRelayDisconnectObservers(url: string): void {
  const normalizedUrl = normalizeWebSocketUrl(url);
  const observers = relayDisconnectObservers.get(normalizedUrl);
  if (!observers) return;

  relayDisconnectObservers.delete(normalizedUrl);
  observers.forEach((observer) => {
    try {
      observer();
    } catch {
      // One consumer's callback must not prevent other clients from finalizing.
    }
  });
}
