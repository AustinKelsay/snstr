import "websocket-polyfill";

const OriginalWebSocket: typeof WebSocket = globalThis.WebSocket;
let WebSocketImpl: typeof WebSocket = OriginalWebSocket;

export function useWebSocketImplementation(wsCtor: typeof WebSocket) {
  WebSocketImpl = wsCtor;
}

export function resetWebSocketImplementation() {
  WebSocketImpl = OriginalWebSocket;
}

export function getWebSocketImplementation(): typeof WebSocket {
  return WebSocketImpl;
}
