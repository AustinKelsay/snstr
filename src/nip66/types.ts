/**
 * Type alias for NIP numbers - can be provided as number or string,
 * but are always stored/parsed as strings in events
 */
export type NipNumber = number | string;

/**
 * Type alias for event kind numbers - can be provided as number or string,
 * but are always stored/parsed as strings in events
 */
export type EventKind = number | string;

export interface RelayDiscoveryEventOptions {
  relay: string;
  content?: string | Record<string, unknown>;
  network?: string;
  relayType?: string;
  /**
   * Supported NIPs - can be provided as numbers or strings,
   * but will be converted to strings during event creation
   */
  supportedNips?: NipNumber[];
  requirements?: string[];
  topics?: string[];
  /**
   * Event kinds - can be provided as numbers or strings,
   * but will be converted to strings during event creation
   */
  kinds?: EventKind[];
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
  /**
   * Supported NIPs - parsed from event tags as strings
   * (even if originally provided as numbers)
   */
  supportedNips: string[];
  requirements: string[];
  topics: string[];
  /**
   * Event kinds - parsed from event tags as strings
   * (even if originally provided as numbers)
   */
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
