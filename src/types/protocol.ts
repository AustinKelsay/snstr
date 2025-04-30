import { NostrEvent, NostrFilter } from "./nostr";

// Define specific message types for each kind of Nostr message
export type NostrEventMessage = ["EVENT", NostrEvent];
export type NostrReqMessage = ["REQ", string, NostrFilter];
export type NostrCloseMessage = ["CLOSE", string];
export type NostrOkMessage = ["OK", string, boolean, string];
export type NostrEoseMessage = ["EOSE", string];
export type NostrNoticeMessage = ["NOTICE", string];
export type NostrAuthMessage = ["AUTH", NostrEvent];

// Union type of all possible message types
export type NostrMessage =
  | NostrEventMessage
  | NostrReqMessage
  | NostrCloseMessage
  | NostrOkMessage
  | NostrEoseMessage
  | NostrNoticeMessage
  | NostrAuthMessage;

export function parseMessage(data: string): NostrMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length < 1) {
      throw new Error("Invalid message format");
    }

    const [messageType] = parsed;
    switch (messageType) {
      case "EVENT":
        if (parsed.length !== 2) throw new Error("Invalid EVENT message");
        return ["EVENT", parsed[1]];
      case "REQ":
        if (parsed.length !== 3) throw new Error("Invalid REQ message");
        return ["REQ", parsed[1], parsed[2]];
      case "CLOSE":
        if (parsed.length !== 2) throw new Error("Invalid CLOSE message");
        return ["CLOSE", parsed[1]];
      case "OK":
        if (parsed.length !== 4) throw new Error("Invalid OK message");
        return ["OK", parsed[1], parsed[2], parsed[3]];
      case "EOSE":
        if (parsed.length !== 2) throw new Error("Invalid EOSE message");
        return ["EOSE", parsed[1]];
      case "NOTICE":
        // More flexible parsing for NOTICE messages
        return ["NOTICE", parsed[1] || ""];
      case "AUTH":
        if (parsed.length !== 2) throw new Error("Invalid AUTH message");
        return ["AUTH", parsed[1]];
      default:
        console.warn(`Unknown message type: ${messageType}`, parsed);
        return null;
    }
  } catch (error) {
    console.error("Failed to parse message:", error);
    return null;
  }
}

export function serializeMessage(message: NostrMessage): string {
  return JSON.stringify(message);
}

export enum RelayEvent {
  Connect = "connect",
  Disconnect = "disconnect",
  Error = "error",
  Notice = "notice",
  OK = "ok",
  Closed = "closed",
}

export interface RelayEventHandler {
  [RelayEvent.Connect]?: (relay: string) => void;
  [RelayEvent.Disconnect]?: (relay: string) => void;
  [RelayEvent.Error]?: (relay: string, error: any) => void;
  [RelayEvent.Notice]?: (relay: string, notice: string) => void;
  [RelayEvent.OK]?: (
    eventId: string,
    success: boolean,
    message: string,
  ) => void;
  [RelayEvent.Closed]?: (subscriptionId: string, message: string) => void;
}
