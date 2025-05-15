export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface EventTemplate {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
}

export type NostrFilter = {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  // Standard tag filters from NIP-01
  "#e"?: string[]; // event references
  "#p"?: string[]; // pubkey references
  "#a"?: string[]; // address references
  "#d"?: string[]; // d tag values for addressable events
  "#t"?: string[]; // topic/tag values
  "#r"?: string[]; // reference/URL values
  "#g"?: string[]; // geohash values
  "#u"?: string[]; // URL values
  // Common extended tag filters
  "#c"?: string[]; // content warning
  "#l"?: string[]; // language
  "#m"?: string[]; // MIME type
  "#s"?: string[]; // subject
  // Time filters
  since?: number;
  until?: number;
  limit?: number;
};

export type Filter = NostrFilter & {
  // Allow additional tag filters while maintaining type safety for the common ones
  [key: `#${string}`]: string[];
  // Allow other custom filter properties
  [key: string]: any;
};

export type Subscription = {
  id: string;
  filters: Filter[];
  onEvent: (event: NostrEvent) => void;
  onEOSE?: () => void;
};

export enum RelayEvent {
  Connect = "connect",
  Disconnect = "disconnect",
  Error = "error",
  Notice = "notice",
  OK = "ok",
  Closed = "closed",
}

export type RelayEventHandler = {
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
};
