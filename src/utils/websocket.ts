import "websocket-polyfill";

let WebSocketImpl: typeof WebSocket = globalThis.WebSocket;

export function useWebSocketImplementation(wsCtor: typeof WebSocket) {
  WebSocketImpl = wsCtor;
}

export function getWebSocketImplementation(): typeof WebSocket {
  return WebSocketImpl;
}
