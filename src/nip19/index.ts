import { bech32 } from "@scure/base";
import {
  Prefix,
  TLVType,
  TLVEntry,
  HexString,
  Bech32String,
  RelayUrl,
  ProfileData,
  EventData,
  AddressData,
  DecodedEntity,
  Bech32Result,
  Bech32BytesResult,
  SimpleBech32Result,
} from "./types";

// Re-export types
export * from "./types";

// Default limit for bech32 length (standard is 90, but we use higher for TLV)
// Apparently some users even breaking through 1500 limit, lets raise it to 5000 like nostr-tools
// https://github.com/nbd-wtf/nostr-tools/issues/74
const DEFAULT_LIMIT = 5000;

// TLV size limits - these are reasonable limits to prevent abuse
const MAX_RELAY_URL_LENGTH = 512; // Max length for a relay URL
const MAX_IDENTIFIER_LENGTH = 1024; // Max length for an identifier (d tag)
const MAX_TLV_ENTRIES = 20; // Max number of TLV entries to prevent DoS (reduced from 100)

/**
 * Validates a relay URL format
 * Relay URLs must start with wss:// or ws:// and contain a valid hostname
 * No credentials are allowed in URLs
 */
function validateRelayUrl(url: string): boolean {
  try {
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      return false;
    }

    // Use URL constructor to validate the URL format
    const parsedUrl = new URL(url);

    // Check for credentials in the URL (username or password)
    if (parsedUrl.username || parsedUrl.password) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to safely encode using bech32 with a higher limit
 */
function encodeBech32WithLimit(
  prefix: string,
  words: number[],
  limit = DEFAULT_LIMIT,
): Bech32String {
  try {
    // Use a type assertion for the prefix since we know it's valid in our context
    return bech32.encode(prefix as Prefix, words, limit);
  } catch (error) {
    throw new Error(
      `Failed to encode bech32: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Helper function to safely decode bech32 strings with a higher limit
 */
function decodeBech32WithLimit(
  bech32Str: Bech32String,
  limit = DEFAULT_LIMIT,
): Bech32Result {
  try {
    // Use a type assertion for the input since we know it's valid in our context
    return bech32.decode(bech32Str, limit);
  } catch (error) {
    throw new Error(
      `Failed to decode bech32: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Encodes a hex string to a bech32 string with the given prefix
 */
export function encodeBech32(prefix: string, data: HexString): Bech32String {
  const dataBytes = hexToBytes(data);
  return bech32.encodeFromBytes(prefix as Prefix, dataBytes) as Bech32String;
}

/**
 * Decodes a bech32 string to a hex string
 */
export function decodeBech32(bech32Str: Bech32String): SimpleBech32Result {
  const { prefix, bytes } = bech32.decodeToBytes(bech32Str) as Bech32BytesResult;
  const data = bytesToHex(bytes);
  return { prefix, data };
}

/**
 * Encodes a public key to npub format
 */
export function encodePublicKey(publicKey: HexString): Bech32String {
  return encodeBech32(Prefix.PublicKey, publicKey);
}

/**
 * Helper function to create a consistent error handling approach
 * that distinguishes between specialized errors and general decoding errors
 */
function handleDecodingError(error: unknown, entityType: string): never {
  // Only pass through specific error types we want to preserve
  if (error instanceof Error) {
    // Pass through these error types directly as they have specific context
    if (
      error.message.startsWith("Invalid prefix") ||
      error.message.startsWith("TLV type") ||
      error.message.startsWith("Missing") ||
      error.message.includes("should be") ||
      error.message.startsWith("Invalid TLV structure") ||
      error.message.startsWith("Invalid relay URL") ||
      error.message.includes("too long") ||
      error.message.includes("exceeds maximum")
    ) {
      throw error;
    }

    // If it's a bech32 error, provide better context
    if (error.message.startsWith("Failed to decode bech32")) {
      throw new Error(
        `Invalid ${entityType} format: bech32 decoding failed - ${error.message}`,
      );
    }

    // If it's about malformed data, provide better context
    if (error.message.includes("Invalid")) {
      throw new Error(`Invalid ${entityType} format: ${error.message}`);
    }
  }

  // Wrap general errors with context
  const errorMessage =
    error instanceof Error ? error.message : String(error) || "unknown error";
  throw new Error(`Error decoding ${entityType}: ${errorMessage}`);
}

/**
 * Decodes an npub to a public key
 */
export function decodePublicKey(npub: Bech32String): HexString {
  try {
    const { prefix, data } = decodeBech32(npub);
    if (prefix !== Prefix.PublicKey) {
      throw new Error(
        `Invalid prefix: expected '${Prefix.PublicKey}', got '${prefix}'`,
      );
    }
    return data;
  } catch (error) {
    handleDecodingError(error, "npub");
  }
}

/**
 * Encodes a private key to nsec format
 */
export function encodePrivateKey(privateKey: HexString): Bech32String {
  return encodeBech32(Prefix.PrivateKey, privateKey);
}

/**
 * Decodes an nsec to a private key
 */
export function decodePrivateKey(nsec: Bech32String): HexString {
  try {
    const { prefix, data } = decodeBech32(nsec);
    if (prefix !== Prefix.PrivateKey) {
      throw new Error(
        `Invalid prefix: expected '${Prefix.PrivateKey}', got '${prefix}'`,
      );
    }
    return data;
  } catch (error) {
    handleDecodingError(error, "nsec");
  }
}

/**
 * Encodes a note ID to note format
 */
export function encodeNoteId(noteId: HexString): Bech32String {
  return encodeBech32(Prefix.Note, noteId);
}

/**
 * Decodes a note to a note ID
 */
export function decodeNoteId(note: Bech32String): HexString {
  try {
    const { prefix, data } = decodeBech32(note);
    if (prefix !== Prefix.Note) {
      throw new Error(
        `Invalid prefix: expected '${Prefix.Note}', got '${prefix}'`,
      );
    }
    return data;
  } catch (error) {
    handleDecodingError(error, "note");
  }
}

// TLV (Type-Length-Value) encoding/decoding

/**
 * Encodes a list of TLV entries into a single byte array
 */
function encodeTLV(entries: TLVEntry[]): Uint8Array {
  // Calculate total length
  let totalLength = 0;
  for (const entry of entries) {
    totalLength += 2 + entry.value.length; // 1 byte for type, 1 byte for length, n bytes for value
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const entry of entries) {
    // Write type
    result[offset++] = entry.type;
    
    // Write length
    result[offset++] = entry.value.length;
    
    // Write value
    result.set(entry.value, offset);
    offset += entry.value.length;
  }

  return result;
}

/**
 * Decodes a TLV encoded byte array into a list of TLV entries
 */
function decodeTLV(data: Uint8Array): TLVEntry[] {
  const entries: TLVEntry[] = [];
  let offset = 0;

  // We need at least 2 bytes per entry (type and length)
  while (offset < data.length - 1) {
    const type = data[offset++];
    const length = data[offset++];
    
    // Check if we have enough data for the value
    if (offset + length > data.length) {
      throw new Error("Invalid TLV structure: data too short");
    }
    
    // Read the value
    const value = data.slice(offset, offset + length);
    offset += length;
    
    // Limit the number of entries to prevent DoS
    if (entries.length >= MAX_TLV_ENTRIES) {
      throw new Error(`TLV entry count exceeds maximum of ${MAX_TLV_ENTRIES}`);
    }
    
    entries.push({ type, value });
  }
  
  return entries;
}

/**
 * Encodes a profile to nprofile format
 */
export function encodeProfile(data: ProfileData): Bech32String {
  // First, validate the pubkey
  if (!data.pubkey || data.pubkey.length !== 64) {
    throw new Error("Invalid pubkey: must be a 32-byte hex string");
  }
  
  // Start building TLV entries with the pubkey
  const entries: TLVEntry[] = [
    {
      type: TLVType.Special,
      value: hexToBytes(data.pubkey),
    },
  ];
  
  // Add relays if provided
  if (data.relays && data.relays.length > 0) {
    // Check for too many relay entries
    if (data.relays.length > MAX_TLV_ENTRIES - 1) { // -1 for the pubkey entry
      throw new Error(`Too many relay entries (max ${MAX_TLV_ENTRIES - 1})`);
    }
    
    for (const relay of data.relays) {
      // Check relay URL length
      if (relay.length > MAX_RELAY_URL_LENGTH) {
        throw new Error(`Relay URL too long (max ${MAX_RELAY_URL_LENGTH} characters)`);
      }
      
      // Validate relay URL format
      if (!validateRelayUrl(relay)) {
        throw new Error(`Invalid relay URL: ${relay}`);
      }
      
      entries.push({
        type: TLVType.Relay,
        value: new TextEncoder().encode(relay),
      });
    }
  }
  
  // Encode the TLV entries
  const tlvData = encodeTLV(entries);
  
  // Convert to bech32 words (5-bit) for encoding
  const words = bech32.toWords(tlvData);
  
  // Encode as bech32
  return encodeBech32WithLimit(Prefix.Profile, words);
}

/**
 * Decodes an nprofile to profile data
 */
export function decodeProfile(nprofile: Bech32String): ProfileData {
  try {
    // Decode the bech32 string
    const { prefix, words } = decodeBech32WithLimit(nprofile);
    
    // Check prefix
    if (prefix !== Prefix.Profile) {
      throw new Error(`Invalid prefix: expected '${Prefix.Profile}', got '${prefix}'`);
    }
    
    // Convert from bech32 words to bytes
    const data = bech32.fromWords(words);
    
    // Decode the TLV entries
    const entries = decodeTLV(data);
    
    // Extract the profile data
    let pubkey: HexString | undefined;
    const relays: RelayUrl[] = [];
    
    for (const entry of entries) {
      if (entry.type === TLVType.Special) {
        // This is the pubkey
        if (entry.value.length !== 32) {
          throw new Error("Invalid pubkey length: should be 32 bytes");
        }
        pubkey = bytesToHex(entry.value);
      } else if (entry.type === TLVType.Relay) {
        // This is a relay URL
        const relay = new TextDecoder().decode(entry.value);
        relays.push(relay);
        
        // Warn about invalid relay URLs but still include them
        if (!validateRelayUrl(relay)) {
          console.warn(`Warning: Invalid relay URL format found while decoding: ${relay}`);
        }
      }
      // Ignore unknown types for forward compatibility
    }
    
    // Ensure we found a pubkey
    if (!pubkey) {
      throw new Error("Missing pubkey in nprofile");
    }
    
    return {
      pubkey,
      relays: relays.length > 0 ? relays : undefined,
    };
  } catch (error) {
    handleDecodingError(error, "nprofile");
  }
}

/**
 * Encodes an event to nevent format
 */
export function encodeEvent(data: EventData): Bech32String {
  // First, validate the event ID
  if (!data.id || data.id.length !== 64) {
    throw new Error("Invalid event ID: must be a 32-byte hex string");
  }
  
  // Start building TLV entries with the event ID
  const entries: TLVEntry[] = [
    {
      type: TLVType.Special,
      value: hexToBytes(data.id),
    },
  ];
  
  // Add relays if provided
  if (data.relays && data.relays.length > 0) {
    // Check for too many relay entries
    if (data.relays.length > MAX_TLV_ENTRIES - 3) { // -3 for id, author, kind
      throw new Error(`Too many relay entries (max ${MAX_TLV_ENTRIES - 3})`);
    }
    
    for (const relay of data.relays) {
      // Check relay URL length
      if (relay.length > MAX_RELAY_URL_LENGTH) {
        throw new Error(`Relay URL too long (max ${MAX_RELAY_URL_LENGTH} characters)`);
      }
      
      // Validate relay URL format
      if (!validateRelayUrl(relay)) {
        throw new Error(`Invalid relay URL: ${relay}`);
      }
      
      entries.push({
        type: TLVType.Relay,
        value: new TextEncoder().encode(relay),
      });
    }
  }
  
  // Add author if provided
  if (data.author) {
    if (data.author.length !== 64) {
      throw new Error("Invalid author pubkey: must be a 32-byte hex string");
    }
    
    entries.push({
      type: TLVType.Author,
      value: hexToBytes(data.author),
    });
  }
  
  // Add kind if provided
  if (data.kind !== undefined) {
    if (data.kind < 0 || data.kind > 65535) {
      throw new Error("Invalid kind: must be between 0 and 65535");
    }
    
    // Convert kind to bytes (uint16)
    const kindBytes = new Uint8Array(2);
    kindBytes[0] = (data.kind >> 8) & 0xff;
    kindBytes[1] = data.kind & 0xff;
    
    entries.push({
      type: TLVType.Kind,
      value: kindBytes,
    });
  }
  
  // Encode the TLV entries
  const tlvData = encodeTLV(entries);
  
  // Convert to bech32 words (5-bit) for encoding
  const words = bech32.toWords(tlvData);
  
  // Encode as bech32
  return encodeBech32WithLimit(Prefix.Event, words);
}

/**
 * Decodes an nevent to event data
 */
export function decodeEvent(nevent: Bech32String): EventData {
  try {
    // Decode the bech32 string
    const { prefix, words } = decodeBech32WithLimit(nevent);
    
    // Check prefix
    if (prefix !== Prefix.Event) {
      throw new Error(`Invalid prefix: expected '${Prefix.Event}', got '${prefix}'`);
    }
    
    // Convert from bech32 words to bytes
    const data = bech32.fromWords(words);
    
    // Decode the TLV entries
    const entries = decodeTLV(data);
    
    // Extract the event data
    let id: HexString | undefined;
    const relays: RelayUrl[] = [];
    let author: HexString | undefined;
    let kind: number | undefined;
    
    for (const entry of entries) {
      if (entry.type === TLVType.Special) {
        // This is the event ID
        if (entry.value.length !== 32) {
          throw new Error("Invalid event ID length: should be 32 bytes");
        }
        id = bytesToHex(entry.value);
      } else if (entry.type === TLVType.Relay) {
        // This is a relay URL
        const relay = new TextDecoder().decode(entry.value);
        relays.push(relay);
        
        // Warn about invalid relay URLs but still include them
        if (!validateRelayUrl(relay)) {
          console.warn(`Warning: Invalid relay URL format found while decoding: ${relay}`);
        }
      } else if (entry.type === TLVType.Author) {
        // This is the author pubkey
        if (entry.value.length !== 32) {
          throw new Error("Invalid author pubkey length: should be 32 bytes");
        }
        author = bytesToHex(entry.value);
      } else if (entry.type === TLVType.Kind) {
        // This is the event kind
        if (entry.value.length !== 2) {
          throw new Error("Invalid kind length: should be 2 bytes");
        }
        kind = (entry.value[0] << 8) + entry.value[1];
      }
      // Ignore unknown types for forward compatibility
    }
    
    // Ensure we found an event ID
    if (!id) {
      throw new Error("Missing event ID in nevent");
    }
    
    return {
      id,
      relays: relays.length > 0 ? relays : undefined,
      author,
      kind,
    };
  } catch (error) {
    handleDecodingError(error, "nevent");
  }
}

/**
 * Encodes an address to naddr format
 */
export function encodeAddress(data: AddressData): Bech32String {
  // Validate the required fields
  if (!data.identifier) {
    throw new Error("Missing identifier in address data");
  }
  
  if (!data.pubkey || data.pubkey.length !== 64) {
    throw new Error("Invalid pubkey: must be a 32-byte hex string");
  }
  
  if (data.kind === undefined || data.kind < 0 || data.kind > 65535) {
    throw new Error("Invalid kind: must be between 0 and 65535");
  }
  
  // Check identifier length
  if (data.identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`Identifier too long (max ${MAX_IDENTIFIER_LENGTH} characters)`);
  }
  
  // Start building TLV entries with the identifier
  const entries: TLVEntry[] = [
    {
      type: TLVType.Special,
      value: new TextEncoder().encode(data.identifier),
    },
  ];
  
  // Add relays if provided
  if (data.relays && data.relays.length > 0) {
    // Check for too many relay entries
    if (data.relays.length > MAX_TLV_ENTRIES - 3) { // -3 for identifier, pubkey, kind
      throw new Error(`Too many relay entries (max ${MAX_TLV_ENTRIES - 3})`);
    }
    
    for (const relay of data.relays) {
      // Check relay URL length
      if (relay.length > MAX_RELAY_URL_LENGTH) {
        throw new Error(`Relay URL too long (max ${MAX_RELAY_URL_LENGTH} characters)`);
      }
      
      // Validate relay URL format
      if (!validateRelayUrl(relay)) {
        throw new Error(`Invalid relay URL: ${relay}`);
      }
      
      entries.push({
        type: TLVType.Relay,
        value: new TextEncoder().encode(relay),
      });
    }
  }
  
  // Add author (pubkey)
  entries.push({
    type: TLVType.Author,
    value: hexToBytes(data.pubkey),
  });
  
  // Add kind
  const kindBytes = new Uint8Array(2);
  kindBytes[0] = (data.kind >> 8) & 0xff;
  kindBytes[1] = data.kind & 0xff;
  
  entries.push({
    type: TLVType.Kind,
    value: kindBytes,
  });
  
  // Encode the TLV entries
  const tlvData = encodeTLV(entries);
  
  // Convert to bech32 words (5-bit) for encoding
  const words = bech32.toWords(tlvData);
  
  // Encode as bech32
  return encodeBech32WithLimit(Prefix.Address, words);
}

/**
 * Decodes an naddr to address data
 */
export function decodeAddress(naddr: Bech32String): AddressData {
  try {
    // Decode the bech32 string
    const { prefix, words } = decodeBech32WithLimit(naddr);
    
    // Check prefix
    if (prefix !== Prefix.Address) {
      throw new Error(`Invalid prefix: expected '${Prefix.Address}', got '${prefix}'`);
    }
    
    // Convert from bech32 words to bytes
    const data = bech32.fromWords(words);
    
    // Decode the TLV entries
    const entries = decodeTLV(data);
    
    // Extract the address data
    let identifier: string | undefined;
    const relays: RelayUrl[] = [];
    let pubkey: HexString | undefined;
    let kind: number | undefined;
    
    for (const entry of entries) {
      if (entry.type === TLVType.Special) {
        // This is the identifier (d tag)
        identifier = new TextDecoder().decode(entry.value);
      } else if (entry.type === TLVType.Relay) {
        // This is a relay URL
        const relay = new TextDecoder().decode(entry.value);
        relays.push(relay);
        
        // Warn about invalid relay URLs but still include them
        if (!validateRelayUrl(relay)) {
          console.warn(`Warning: Invalid relay URL format found while decoding: ${relay}`);
        }
      } else if (entry.type === TLVType.Author) {
        // This is the pubkey
        if (entry.value.length !== 32) {
          throw new Error("Invalid pubkey length: should be 32 bytes");
        }
        pubkey = bytesToHex(entry.value);
      } else if (entry.type === TLVType.Kind) {
        // This is the event kind
        if (entry.value.length !== 2) {
          throw new Error("Invalid kind length: should be 2 bytes");
        }
        kind = (entry.value[0] << 8) + entry.value[1];
      }
      // Ignore unknown types for forward compatibility
    }
    
    // Ensure we have all required fields
    if (!identifier) {
      throw new Error("Missing identifier in naddr");
    }
    
    if (!pubkey) {
      throw new Error("Missing pubkey in naddr");
    }
    
    if (kind === undefined) {
      throw new Error("Missing kind in naddr");
    }
    
    return {
      identifier,
      pubkey,
      kind,
      relays: relays.length > 0 ? relays : undefined,
    };
  } catch (error) {
    handleDecodingError(error, "naddr");
  }
}

/**
 * Converts a hex string to a byte array
 */
function hexToBytes(hex: HexString): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: length must be even");
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const start = i * 2;
    const hexByte = hex.slice(start, start + 2);
    const byte = parseInt(hexByte, 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex string: "${hexByte}" is not a valid hex byte`);
    }
    bytes[i] = byte;
  }
  
  return bytes;
}

/**
 * Converts a byte array to a hex string
 */
function bytesToHex(bytes: Uint8Array): HexString {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Universal decoder for any NIP-19 entity
 */
export function decode(bech32Str: Bech32String): DecodedEntity {
  // Basic validation for bech32 format
  if (!bech32Str.includes('1')) {
    throw new Error("Invalid bech32 string format: missing separator character '1'");
  }
  
  // Extract the prefix from the bech32 string
  const prefix = bech32Str.slice(0, bech32Str.indexOf("1"));
  
  switch (prefix) {
    case Prefix.PublicKey:
      return {
        type: Prefix.PublicKey,
        data: decodePublicKey(bech32Str),
      };
    case Prefix.PrivateKey:
      return {
        type: Prefix.PrivateKey,
        data: decodePrivateKey(bech32Str),
      };
    case Prefix.Note:
      return {
        type: Prefix.Note,
        data: decodeNoteId(bech32Str),
      };
    case Prefix.Profile:
      return {
        type: Prefix.Profile,
        data: decodeProfile(bech32Str),
      };
    case Prefix.Event:
      return {
        type: Prefix.Event,
        data: decodeEvent(bech32Str),
      };
    case Prefix.Address:
      return {
        type: Prefix.Address,
        data: decodeAddress(bech32Str),
      };
    default:
      throw new Error(`Unknown prefix: ${prefix}`);
  }
}

// Export security utilities
export * from "./secure";
