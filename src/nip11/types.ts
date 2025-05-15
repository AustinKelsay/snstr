/**
 * Types for NIP-11 implementation
 * Relay Information Document
 */

/**
 * Main interface for Relay Information Document structure
 * as defined in NIP-11
 */
export interface RelayInfo {
  /** The relay software name */
  name?: string;
  /** The relay description */
  description?: string;
  /** The operator's pubkey */
  pubkey?: string;
  /** The relay contact */
  contact?: string;
  /** Relay software version */
  software?: string;
  /** Relay software version */
  version?: string;
  /** List of NIP numbers supported by the relay */
  supported_nips?: number[];
  /** List of MIME types supported for the content field */
  supported_content_types?: string[];
  /** Server limitation details */
  limitation?: RelayLimitation;
  /** Payments information */
  payments_url?: string;
  /** Relay fees information */
  fees?: RelayFees;
  /** Relay icon */
  icon?: string;
  /** Alternative relay URLs */
  relay_countries?: string[];
  /** Language tags in BCP47 format */
  language_tags?: string[];
  /** Tags for categorization */
  tags?: string[];
  /** URL to the community/forum */
  posting_policy?: string;
}

/**
 * Interface for relay limitations
 */
export interface RelayLimitation {
  /** Maximum event size in bytes */
  max_message_length?: number;
  /** Maximum number of subscriptions per connection */
  max_subscriptions?: number;
  /** Maximum filter length */
  max_filters?: number;
  /** Maximum limit value filter */
  max_limit?: number;
  /** Maximum time range for queries in seconds */
  max_subid_length?: number;
  /** Minimum POW difficulty (NIP-13) */
  min_pow_difficulty?: number;
  /** Whether to require payment for events */
  payments_required?: boolean;
  /** Whether to require auth for events */
  auth_required?: boolean;
  /** Whether to restrict reads to authenticated users */
  restricted_reads?: boolean;
  /** Whether to restrict writes to authenticated users */
  restricted_writes?: boolean;
}

/**
 * Interface for relay fee structure
 */
export interface RelayFees {
  /** Fee for publishing an event */
  admission?: FeeSchedule[];
  /** Fee for subscription */
  subscription?: FeeSchedule[];
  /** Fee for publishing an event */
  publication?: FeeSchedule[];
}

/**
 * Interface for fee schedule
 */
export interface FeeSchedule {
  /** Amount in the smallest unit of currency */
  amount: number;
  /** The unit of currency (e.g., "msats" or "USD") */
  unit: string;
  /** The period if applicable (e.g., "day", "month") */
  period?: number;
  /** Human-readable description of the fee */
  description?: string;
}
