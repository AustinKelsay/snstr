/**
 * Custom WebSocket Implementation Example
 *
 * This example demonstrates how to inject a custom WebSocket implementation
 * using `useWebSocketImplementation`.
 *
 * Key concepts:
 * - Providing a different WebSocket constructor
 * - Establishing a connection with Relay using the custom WebSocket
 *
 * Prerequisites:
 * Install the ws package before running this example:
 * npm install ws
 * npm install --save-dev @types/ws
 *
 * How to run:
 * npm run example:custom-websocket
 */

import { Relay, useWebSocketImplementation } from "../src";
import WS from "ws";

async function main() {
  // Use the `ws` package rather than the default polyfill
  useWebSocketImplementation(WS as unknown as typeof WebSocket);

  const relay = new Relay("wss://relay.damus.io");
  const connected = await relay.connect();
  console.log("Connected:", connected);
  relay.disconnect();
}

main().catch(console.error);
