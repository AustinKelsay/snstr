export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export type NostrFilter = {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
};

export interface EventTemplate {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
}

export type Filter = {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
};

export type Subscription = {
  id: string;
  filters: Filter[];
  onEvent: (event: NostrEvent) => void;
  onEOSE?: () => void;
};

export enum RelayEvent {
  Connect = 'connect',
  Disconnect = 'disconnect',
  Error = 'error',
  Notice = 'notice',
}

export type RelayEventHandler = {
  [key in RelayEvent]?: (relay: string, ...args: any[]) => void;
}; 