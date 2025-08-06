// Capture the native WebSocket implementation before importing polyfill (if it exists)
const OriginalWebSocket: typeof WebSocket | undefined = globalThis.WebSocket;

import "websocket-polyfill";

// Use the polyfill WebSocket as default, but allow override with the original if it existed
let WebSocketImpl: typeof WebSocket = OriginalWebSocket || globalThis.WebSocket;

export function useWebSocketImplementation(wsCtor: typeof WebSocket) {
  WebSocketImpl = wsCtor;
}

export function resetWebSocketImplementation() {
  WebSocketImpl = OriginalWebSocket || globalThis.WebSocket;
}

export function getWebSocketImplementation(): typeof WebSocket {
  if (!WebSocketImpl) {
    throw new Error(
      "WebSocket implementation not available. Make sure websocket-polyfill is properly loaded.",
    );
  }
  return WebSocketImpl;
}
