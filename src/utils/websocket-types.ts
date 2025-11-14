/**********************************************************************
 * Shared WebSocket-like handler and event helper types used by both
 * the in-memory test transport and the Relay implementation.
 *********************************************************************/

// Bivariant handler helper to align with WebSocket-like callback variance
export type BivariantHandler<T> = {
  // Bivariance hack to allow assigning handlers with compatible, narrower params
  // (mirrors how lib.dom types event handler properties)
  bivarianceHack: (event: T) => void;
}["bivarianceHack"];

export type OpenEventLike = Event | { type: "open" };
export type CloseEventLike =
  | CloseEvent
  | {
      type: "close";
      code?: number;
      reason?: string;
    };
export type ErrorEventLike = unknown;
export type MessageEventLike = MessageEvent<string> | { data: string };

