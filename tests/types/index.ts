import { Nostr, NostrEvent, Relay } from "../../src";

/**
 * Interface for mocking a Relay in tests
 */
export interface MockRelay {
  url: string;
  connected: boolean;
  publishResults: { success: boolean; reason?: string }[];
  publish(
    event: NostrEvent,
    options?: { timeout?: number },
  ): Promise<{ success: boolean; reason?: string }>;
  connect(): Promise<boolean>;
  disconnect(): void;
  on(): void;
  off(): void;
  setConnectionTimeout(timeout: number): void;
  getConnectionTimeout(): number;
  getLatestAddressableEvent?(
    kind: number,
    pubkey: string,
    dTagValue: string,
  ): NostrEvent | undefined;
  getAddressableEventsByPubkey?(pubkey: string): NostrEvent[];
  getAddressableEventsByKind?(kind: number): NostrEvent[];
}

/**
 * Interface for accessing private members of the Nostr class during testing
 * DO NOT USE THIS IN PRODUCTION CODE!
 */
export interface NostrInternals {
  privateKey: string;
  publicKey: string;
  relays: Map<string, Relay | MockRelay>;
  relayOptions?: {
    connectionTimeout?: number;
    bufferFlushDelay?: number;
  };
}

/**
 * Type guard to check if a relay is a MockRelay
 */
export function isMockRelay(relay: Relay | MockRelay): relay is MockRelay {
  return "publishResults" in relay;
}

/**
 * Safe cast from Nostr to NostrInternals for testing
 */
export function getNostrInternals(client: Nostr): NostrInternals {
  return client as unknown as NostrInternals;
}
