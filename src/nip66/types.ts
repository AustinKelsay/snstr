export interface RelayDiscoveryEventOptions {
  relay: string;
  content?: string | Record<string, unknown>;
  network?: string;
  relayType?: string;
  supportedNips?: (number | string)[];
  requirements?: string[];
  topics?: string[];
  kinds?: (number | string)[];
  geohash?: string;
  rttOpen?: number;
  rttRead?: number;
  rttWrite?: number;
  additionalTags?: string[][];
}

export interface ParsedRelayDiscoveryEvent {
  relay: string;
  network?: string;
  relayType?: string;
  supportedNips: string[];
  requirements: string[];
  topics: string[];
  kinds: string[];
  geohash?: string;
  rttOpen?: number;
  rttRead?: number;
  rttWrite?: number;
  content?: unknown;
}

export interface TimeoutDefinition {
  value: number;
  test?: string;
}

export interface RelayMonitorAnnouncementOptions {
  frequency: number;
  timeouts?: TimeoutDefinition[];
  checks?: string[];
  geohash?: string;
  content?: string;
  additionalTags?: string[][];
}

export interface ParsedRelayMonitorAnnouncement {
  frequency: number;
  timeouts: TimeoutDefinition[];
  checks: string[];
  geohash?: string;
  content?: string;
}
