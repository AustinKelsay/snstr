/**
 * TypeScript types for NIP-19 Bech32-Encoded Entities
 */

/**
 * NIP-19 prefix enum for different entity types
 */
export enum Prefix {
  PublicKey = "npub",
  PrivateKey = "nsec",
  Note = "note",
  Profile = "nprofile",
  Event = "nevent",
  Address = "naddr",
}

/**
 * TLV (Type-Length-Value) types as defined in NIP-19
 */
export enum TLVType {
  Special = 0, // Depends on prefix: pubkey for nprofile, event id for nevent, identifier (d tag) for naddr
  Relay = 1, // Optional relay URL where the entity might be found
  Author = 2, // Author pubkey (for naddr, required; for nevent, optional)
  Kind = 3, // Event kind (for naddr, required)
}

/**
 * TLV entry structure
 */
export interface TLVEntry {
  type: TLVType | number;
  value: Uint8Array;
}

/**
 * Hexadecimal string (32-byte public key, private key, or note ID)
 * Represented as a 64-character hex string
 */
export type HexString = string;

/**
 * Bech32 encoded string
 * Must be of the format: prefix1data where prefix is a string and data consists of bech32 characters
 */
export type Bech32String = `${string}1${string}`;

/**
 * Valid relay URL string (ws:// or wss://)
 */
export type RelayUrl = string;

/**
 * Profile data structure as defined in NIP-19
 */
export interface ProfileData {
  pubkey: HexString;
  relays?: RelayUrl[];
}

/**
 * Event data structure as defined in NIP-19
 */
export interface EventData {
  id: HexString;
  relays?: RelayUrl[];
  author?: HexString;
  kind?: number;
}

/**
 * Address data structure as defined in NIP-19
 * Used for parameterized replaceable events
 */
export interface AddressData {
  identifier: string;
  pubkey: HexString;
  kind: number;
  relays?: RelayUrl[];
}

/**
 * NIP-19 decoded entity types
 */
export type DecodedEntity =
  | { type: Prefix.PublicKey; data: HexString }
  | { type: Prefix.PrivateKey; data: HexString }
  | { type: Prefix.Note; data: HexString }
  | { type: Prefix.Profile; data: ProfileData }
  | { type: Prefix.Event; data: EventData }
  | { type: Prefix.Address; data: AddressData };

/**
 * Bech32 decode result
 */
export interface Bech32Result {
  prefix: string;
  words: number[];
}

/**
 * Bech32 decode to bytes result
 */
export interface Bech32BytesResult {
  prefix: string;
  bytes: Uint8Array;
}

/**
 * Simple bech32 decode result
 */
export interface SimpleBech32Result {
  prefix: string;
  data: HexString;
}

/**
 * Options for encoders and decoders
 */
export interface Bech32Options {
  limit?: number;
}

/**
 * Security filter options
 */
export interface SecurityOptions {
  validateUrls?: boolean;
  maxRelayLength?: number;
  maxIdentifierLength?: number;
}
