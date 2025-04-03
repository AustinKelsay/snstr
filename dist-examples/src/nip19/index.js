"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLVType = exports.Prefix = void 0;
exports.encodeBech32 = encodeBech32;
exports.decodeBech32 = decodeBech32;
exports.encodePublicKey = encodePublicKey;
exports.decodePublicKey = decodePublicKey;
exports.encodePrivateKey = encodePrivateKey;
exports.decodePrivateKey = decodePrivateKey;
exports.encodeNoteId = encodeNoteId;
exports.decodeNoteId = decodeNoteId;
exports.encodeProfile = encodeProfile;
exports.decodeProfile = decodeProfile;
exports.encodeEvent = encodeEvent;
exports.decodeEvent = decodeEvent;
exports.encodeAddress = encodeAddress;
exports.decodeAddress = decodeAddress;
exports.decode = decode;
const base_1 = require("@scure/base");
// NIP-19 prefixes for different entity types
var Prefix;
(function (Prefix) {
    Prefix["PublicKey"] = "npub";
    Prefix["PrivateKey"] = "nsec";
    Prefix["Note"] = "note";
    Prefix["Profile"] = "nprofile";
    Prefix["Event"] = "nevent";
    Prefix["Address"] = "naddr";
})(Prefix || (exports.Prefix = Prefix = {}));
// TLV types
var TLVType;
(function (TLVType) {
    TLVType[TLVType["Special"] = 0] = "Special";
    TLVType[TLVType["Relay"] = 1] = "Relay";
    TLVType[TLVType["Author"] = 2] = "Author";
    TLVType[TLVType["Kind"] = 3] = "Kind";
})(TLVType || (exports.TLVType = TLVType = {}));
// Default limit for bech32 length (standard is 90, but we use higher for TLV)
// Apparently some users even breaking through 1500 limit, lets raise it to 5000 like nostr-tools
// https://github.com/nbd-wtf/nostr-tools/issues/74
const DEFAULT_LIMIT = 5000;
// TLV size limits - these are reasonable limits to prevent abuse
const MAX_RELAY_URL_LENGTH = 512; // Max length for a relay URL
const MAX_IDENTIFIER_LENGTH = 1024; // Max length for an identifier (d tag)
const MAX_TLV_ENTRIES = 100; // Max number of TLV entries to prevent DoS
/**
 * Validates a relay URL format
 * Relay URLs must start with wss:// or ws:// and contain a valid hostname
 */
function validateRelayUrl(url) {
    try {
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            return false;
        }
        // Use URL constructor to validate the URL format
        new URL(url);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Helper function to safely encode using bech32 with a higher limit
 */
function encodeBech32WithLimit(prefix, words, limit = DEFAULT_LIMIT) {
    // bech32.encode requires a specific type for the prefix, but we can cast it
    // since we know that in our context we're always using valid prefix formats.
    // We do this to avoid TypeScript type errors.
    try {
        return base_1.bech32.encode(prefix, words, limit);
    }
    catch (error) {
        throw new Error(`Failed to encode bech32: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}
/**
 * Helper function to safely decode bech32 strings with a higher limit
 */
function decodeBech32WithLimit(bech32Str, limit = DEFAULT_LIMIT) {
    // bech32.decode requires a specific type for the input, but we can cast it
    // since we know that in our context we're always using valid bech32 formats.
    // We do this to avoid TypeScript type errors.
    try {
        return base_1.bech32.decode(bech32Str, limit);
    }
    catch (error) {
        throw new Error(`Failed to decode bech32: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}
/**
 * Encodes a hex string to a bech32 string with the given prefix
 */
function encodeBech32(prefix, data) {
    const dataBytes = hexToBytes(data);
    return base_1.bech32.encodeFromBytes(prefix, dataBytes);
}
/**
 * Decodes a bech32 string to a hex string
 */
function decodeBech32(bech32Str) {
    const { prefix, bytes } = base_1.bech32.decodeToBytes(bech32Str);
    const data = bytesToHex(bytes);
    return { prefix, data };
}
/**
 * Encodes a public key to npub format
 */
function encodePublicKey(publicKey) {
    return encodeBech32(Prefix.PublicKey, publicKey);
}
/**
 * Helper function to create a consistent error handling approach
 * that distinguishes between specialized errors and general decoding errors
 */
function handleDecodingError(error, entityType) {
    // Only pass through specific error types we want to preserve
    if (error instanceof Error) {
        // Pass through these error types directly as they have specific context
        if (error.message.startsWith('Invalid prefix') ||
            error.message.startsWith('TLV type') ||
            error.message.startsWith('Missing') ||
            error.message.includes('should be') ||
            error.message.startsWith('Invalid TLV structure') ||
            error.message.startsWith('Invalid relay URL') ||
            error.message.includes('too long') ||
            error.message.includes('exceeds maximum')) {
            throw error;
        }
        // If it's a bech32 error, provide better context
        if (error.message.startsWith('Failed to decode bech32')) {
            throw new Error(`Invalid ${entityType} format: bech32 decoding failed - ${error.message}`);
        }
        // If it's about malformed data, provide better context
        if (error.message.includes('Invalid')) {
            throw new Error(`Invalid ${entityType} format: ${error.message}`);
        }
    }
    // Wrap general errors with context
    const errorMessage = error instanceof Error ? error.message : String(error) || 'unknown error';
    throw new Error(`Error decoding ${entityType}: ${errorMessage}`);
}
/**
 * Decodes an npub to a public key
 */
function decodePublicKey(npub) {
    try {
        const { prefix, data } = decodeBech32(npub);
        if (prefix !== Prefix.PublicKey) {
            throw new Error(`Invalid prefix: expected '${Prefix.PublicKey}', got '${prefix}'`);
        }
        return data;
    }
    catch (error) {
        handleDecodingError(error, 'npub');
    }
}
/**
 * Encodes a private key to nsec format
 */
function encodePrivateKey(privateKey) {
    return encodeBech32(Prefix.PrivateKey, privateKey);
}
/**
 * Decodes an nsec to a private key
 */
function decodePrivateKey(nsec) {
    try {
        const { prefix, data } = decodeBech32(nsec);
        if (prefix !== Prefix.PrivateKey) {
            throw new Error(`Invalid prefix: expected '${Prefix.PrivateKey}', got '${prefix}'`);
        }
        return data;
    }
    catch (error) {
        handleDecodingError(error, 'nsec');
    }
}
/**
 * Encodes a note ID to note format
 */
function encodeNoteId(noteId) {
    return encodeBech32(Prefix.Note, noteId);
}
/**
 * Decodes a note to a note ID
 */
function decodeNoteId(note) {
    try {
        const { prefix, data } = decodeBech32(note);
        if (prefix !== Prefix.Note) {
            throw new Error(`Invalid prefix: expected '${Prefix.Note}', got '${prefix}'`);
        }
        return data;
    }
    catch (error) {
        handleDecodingError(error, 'note');
    }
}
/**
 * Encodes a list of TLV entries into a single byte array
 */
function encodeTLV(entries) {
    // Calculate total length
    let totalLength = 0;
    for (const entry of entries) {
        totalLength += 2 + entry.value.length; // 1 byte for type, 1 byte for length, n bytes for value
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const entry of entries) {
        result[offset++] = entry.type;
        result[offset++] = entry.value.length;
        result.set(entry.value, offset);
        offset += entry.value.length;
    }
    return result;
}
/**
 * Decodes a byte array into a list of TLV entries
 */
function decodeTLV(data) {
    const entries = [];
    let offset = 0;
    if (data.length > DEFAULT_LIMIT) {
        throw new Error(`TLV data too large: ${data.length} bytes exceeds maximum of ${DEFAULT_LIMIT}`);
    }
    while (offset < data.length) {
        if (entries.length >= MAX_TLV_ENTRIES) {
            throw new Error(`Too many TLV entries: exceeded maximum of ${MAX_TLV_ENTRIES}`);
        }
        if (offset + 1 >= data.length) {
            throw new Error(`Invalid TLV structure: incomplete type/length fields at offset ${offset}`);
        }
        const type = data[offset++];
        const length = data[offset++];
        if (length > 255) {
            throw new Error(`Invalid TLV structure: length ${length} exceeds maximum allowed (255 bytes) at offset ${offset - 1}`);
        }
        if (offset + length > data.length) {
            throw new Error(`Invalid TLV structure: insufficient data for type ${type} (expected ${length} bytes, but only ${data.length - offset} available) at offset ${offset}`);
        }
        const value = data.slice(offset, offset + length);
        offset += length;
        entries.push({ type, value });
    }
    return entries;
}
/**
 * Encodes profile data to an nprofile
 */
function encodeProfile(data) {
    const entries = [];
    // Add pubkey as special entry (type 0)
    entries.push({
        type: TLVType.Special,
        value: hexToBytes(data.pubkey),
    });
    // Add relays if provided
    if (data.relays && data.relays.length > 0) {
        if (data.relays.length > MAX_TLV_ENTRIES) {
            throw new Error(`Too many relay entries: ${data.relays.length} exceeds maximum of ${MAX_TLV_ENTRIES}`);
        }
        for (const relay of data.relays) {
            if (!validateRelayUrl(relay)) {
                throw new Error(`Invalid relay URL format: ${relay}. Must start with wss:// or ws://`);
            }
            if (relay.length > MAX_RELAY_URL_LENGTH) {
                throw new Error(`Relay URL too long: ${relay.length} bytes exceeds maximum of ${MAX_RELAY_URL_LENGTH}`);
            }
            entries.push({
                type: TLVType.Relay,
                value: new TextEncoder().encode(relay),
            });
        }
    }
    const tlvData = encodeTLV(entries);
    // Use direct encode with higher limit to support longer TLV data
    return encodeBech32WithLimit(Prefix.Profile, base_1.bech32.toWords(tlvData));
}
/**
 * Decodes an nprofile to profile data
 */
function decodeProfile(nprofile) {
    try {
        const { prefix, words } = decodeBech32WithLimit(nprofile);
        if (prefix !== Prefix.Profile) {
            throw new Error(`Invalid prefix: expected '${Prefix.Profile}', got '${prefix}'`);
        }
        const data = base_1.bech32.fromWords(words);
        const entries = decodeTLV(data);
        if (entries.length > MAX_TLV_ENTRIES) {
            throw new Error(`Too many TLV entries: ${entries.length} exceeds maximum of ${MAX_TLV_ENTRIES}`);
        }
        const result = {
            pubkey: '',
            relays: [],
        };
        let foundPubkey = false;
        for (const entry of entries) {
            if (entry.type === TLVType.Special) {
                if (entry.value.length !== 32) {
                    throw new Error(`TLV type 0 (pubkey) should be 32 bytes, got ${entry.value.length} bytes`);
                }
                result.pubkey = bytesToHex(entry.value);
                foundPubkey = true;
            }
            else if (entry.type === TLVType.Relay) {
                const relay = new TextDecoder().decode(entry.value);
                if (relay.length > MAX_RELAY_URL_LENGTH) {
                    throw new Error(`Relay URL too long: ${relay.length} bytes exceeds maximum of ${MAX_RELAY_URL_LENGTH}`);
                }
                // We don't validate relay URL format when decoding to be more permissive
                // But we do warn about it for developers
                if (!validateRelayUrl(relay)) {
                    console.warn(`Warning: Invalid relay URL format found while decoding: ${relay}`);
                }
                if (!result.relays)
                    result.relays = [];
                result.relays.push(relay);
            }
            // Ignore unknown TLV types as per NIP-19 spec
        }
        if (!foundPubkey) {
            throw new Error('Missing pubkey in nprofile');
        }
        return result;
    }
    catch (error) {
        handleDecodingError(error, 'nprofile');
    }
}
/**
 * Encodes event data to an nevent
 */
function encodeEvent(data) {
    const entries = [];
    // Add event id as special entry (type 0)
    entries.push({
        type: TLVType.Special,
        value: hexToBytes(data.id),
    });
    // Add relays if provided
    if (data.relays && data.relays.length > 0) {
        if (data.relays.length > MAX_TLV_ENTRIES) {
            throw new Error(`Too many relay entries: ${data.relays.length} exceeds maximum of ${MAX_TLV_ENTRIES}`);
        }
        for (const relay of data.relays) {
            if (!validateRelayUrl(relay)) {
                throw new Error(`Invalid relay URL format: ${relay}. Must start with wss:// or ws://`);
            }
            if (relay.length > MAX_RELAY_URL_LENGTH) {
                throw new Error(`Relay URL too long: ${relay.length} bytes exceeds maximum of ${MAX_RELAY_URL_LENGTH}`);
            }
            entries.push({
                type: TLVType.Relay,
                value: new TextEncoder().encode(relay),
            });
        }
    }
    // Add author if provided
    if (data.author) {
        entries.push({
            type: TLVType.Author,
            value: hexToBytes(data.author),
        });
    }
    // Add kind if provided
    if (data.kind !== undefined) {
        // Convert kind to big-endian 32-bit integer
        // NIP-19 requires 4-byte integer encoding in big-endian format
        // This means the most significant byte comes first:
        // - First byte: (kind >> 24) & 0xff - highest 8 bits
        // - Second byte: (kind >> 16) & 0xff - second highest 8 bits
        // - Third byte: (kind >> 8) & 0xff - second lowest 8 bits
        // - Fourth byte: kind & 0xff - lowest 8 bits
        const kindBytes = new Uint8Array(4);
        kindBytes[0] = (data.kind >> 24) & 0xff;
        kindBytes[1] = (data.kind >> 16) & 0xff;
        kindBytes[2] = (data.kind >> 8) & 0xff;
        kindBytes[3] = data.kind & 0xff;
        entries.push({
            type: TLVType.Kind,
            value: kindBytes,
        });
    }
    const tlvData = encodeTLV(entries);
    // Use direct encode with higher limit to support longer TLV data
    return encodeBech32WithLimit(Prefix.Event, base_1.bech32.toWords(tlvData));
}
/**
 * Decodes an nevent to event data
 */
function decodeEvent(nevent) {
    try {
        const { prefix, words } = decodeBech32WithLimit(nevent);
        if (prefix !== Prefix.Event) {
            throw new Error(`Invalid prefix: expected '${Prefix.Event}', got '${prefix}'`);
        }
        const data = base_1.bech32.fromWords(words);
        const entries = decodeTLV(data);
        if (entries.length > MAX_TLV_ENTRIES) {
            throw new Error(`Too many TLV entries: ${entries.length} exceeds maximum of ${MAX_TLV_ENTRIES}`);
        }
        const result = {
            id: '',
            relays: [],
        };
        let foundId = false;
        for (const entry of entries) {
            if (entry.type === TLVType.Special) {
                if (entry.value.length !== 32) {
                    throw new Error('TLV type 0 (event id) should be 32 bytes');
                }
                result.id = bytesToHex(entry.value);
                foundId = true;
            }
            else if (entry.type === TLVType.Relay) {
                const relay = new TextDecoder().decode(entry.value);
                if (!result.relays)
                    result.relays = [];
                result.relays.push(relay);
            }
            else if (entry.type === TLVType.Author) {
                if (entry.value.length !== 32) {
                    throw new Error('TLV type 2 (author) should be 32 bytes');
                }
                result.author = bytesToHex(entry.value);
            }
            else if (entry.type === TLVType.Kind) {
                if (entry.value.length !== 4) {
                    throw new Error('TLV type 3 (kind) should be 4 bytes');
                }
                // Decode big-endian 32-bit integer by combining 4 bytes
                // Shift each byte to its appropriate position and combine with bitwise OR
                // This is the reverse of the encoding operation in encodeEvent
                result.kind = (entry.value[0] << 24) | (entry.value[1] << 16) | (entry.value[2] << 8) | entry.value[3];
            }
            // Ignore unknown TLV types as per NIP-19 spec
        }
        if (!foundId) {
            throw new Error('Missing id in nevent');
        }
        return result;
    }
    catch (error) {
        handleDecodingError(error, 'nevent');
    }
}
/**
 * Encodes address data to an naddr
 */
function encodeAddress(data) {
    const entries = [];
    // Add identifier as special entry (type 0)
    if (data.identifier.length > MAX_IDENTIFIER_LENGTH) {
        throw new Error(`Identifier too long: ${data.identifier.length} bytes exceeds maximum of ${MAX_IDENTIFIER_LENGTH}`);
    }
    entries.push({
        type: TLVType.Special,
        value: new TextEncoder().encode(data.identifier),
    });
    // Add relays if provided
    if (data.relays && data.relays.length > 0) {
        if (data.relays.length > MAX_TLV_ENTRIES) {
            throw new Error(`Too many relay entries: ${data.relays.length} exceeds maximum of ${MAX_TLV_ENTRIES}`);
        }
        for (const relay of data.relays) {
            if (!validateRelayUrl(relay)) {
                throw new Error(`Invalid relay URL format: ${relay}. Must start with wss:// or ws://`);
            }
            if (relay.length > MAX_RELAY_URL_LENGTH) {
                throw new Error(`Relay URL too long: ${relay.length} bytes exceeds maximum of ${MAX_RELAY_URL_LENGTH}`);
            }
            entries.push({
                type: TLVType.Relay,
                value: new TextEncoder().encode(relay),
            });
        }
    }
    // Add author (required for naddr)
    entries.push({
        type: TLVType.Author,
        value: hexToBytes(data.pubkey),
    });
    // Add kind (required for naddr)
    // Convert kind to big-endian 32-bit integer (network byte order)
    // This is standard for binary protocol encoding:
    // - The high-order byte (MSB) comes first (index 0)
    // - The low-order byte (LSB) comes last (index 3)
    // Example: For kind 1, the bytes would be [0, 0, 0, 1]
    const kindBytes = new Uint8Array(4);
    kindBytes[0] = (data.kind >> 24) & 0xff;
    kindBytes[1] = (data.kind >> 16) & 0xff;
    kindBytes[2] = (data.kind >> 8) & 0xff;
    kindBytes[3] = data.kind & 0xff;
    entries.push({
        type: TLVType.Kind,
        value: kindBytes,
    });
    const tlvData = encodeTLV(entries);
    // Use direct encode with higher limit to support longer TLV data
    return encodeBech32WithLimit(Prefix.Address, base_1.bech32.toWords(tlvData));
}
/**
 * Decodes an naddr to address data
 */
function decodeAddress(naddr) {
    try {
        const { prefix, words } = decodeBech32WithLimit(naddr);
        if (prefix !== Prefix.Address) {
            throw new Error(`Invalid prefix: expected '${Prefix.Address}', got '${prefix}'`);
        }
        const data = base_1.bech32.fromWords(words);
        const entries = decodeTLV(data);
        const result = {
            identifier: '',
            pubkey: '',
            kind: 0,
            relays: [],
        };
        let foundPubkey = false;
        let foundKind = false;
        for (const entry of entries) {
            if (entry.type === TLVType.Special) {
                // identifier can be empty string for normal replaceable events
                result.identifier = new TextDecoder().decode(entry.value);
            }
            else if (entry.type === TLVType.Relay) {
                const relay = new TextDecoder().decode(entry.value);
                if (!result.relays)
                    result.relays = [];
                result.relays.push(relay);
            }
            else if (entry.type === TLVType.Author) {
                if (entry.value.length !== 32) {
                    throw new Error('TLV type 2 (pubkey) should be 32 bytes');
                }
                result.pubkey = bytesToHex(entry.value);
                foundPubkey = true;
            }
            else if (entry.type === TLVType.Kind) {
                if (entry.value.length !== 4) {
                    throw new Error('TLV type 3 (kind) should be 4 bytes');
                }
                // Decode big-endian 32-bit integer by reading each byte and shifting to its position
                // This converts from network byte order (big-endian) back to a JavaScript number
                result.kind = (entry.value[0] << 24) | (entry.value[1] << 16) | (entry.value[2] << 8) | entry.value[3];
                foundKind = true;
            }
            // Ignore unknown TLV types as per NIP-19 spec
        }
        if (!foundPubkey) {
            throw new Error('Missing pubkey in naddr');
        }
        if (!foundKind || result.kind === 0) {
            throw new Error('Missing or invalid kind in naddr');
        }
        return result;
    }
    catch (error) {
        handleDecodingError(error, 'naddr');
    }
}
/**
 * Utility function: convert hex string to Uint8Array
 */
function hexToBytes(hex) {
    // Ensure the hex string has even length by padding with a leading zero if needed
    hex = hex.length % 2 === 0 ? hex : '0' + hex;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        const b = parseInt(hex.substring(i, i + 2), 16);
        if (isNaN(b))
            throw new Error('Invalid hex character');
        bytes[i / 2] = b;
    }
    return bytes;
}
/**
 * Utility function: convert Uint8Array to hex string
 */
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Parses any NIP-19 entity and returns its type and data
 */
function decode(bech32Str) {
    try {
        const { prefix, words } = decodeBech32WithLimit(bech32Str);
        switch (prefix) {
            case Prefix.PublicKey:
                return {
                    type: 'npub',
                    data: bytesToHex(base_1.bech32.fromWords(words))
                };
            case Prefix.PrivateKey:
                return {
                    type: 'nsec',
                    data: bytesToHex(base_1.bech32.fromWords(words))
                };
            case Prefix.Note:
                return {
                    type: 'note',
                    data: bytesToHex(base_1.bech32.fromWords(words))
                };
            case Prefix.Profile:
                return {
                    type: 'nprofile',
                    data: decodeProfile(bech32Str)
                };
            case Prefix.Event:
                return {
                    type: 'nevent',
                    data: decodeEvent(bech32Str)
                };
            case Prefix.Address:
                return {
                    type: 'naddr',
                    data: decodeAddress(bech32Str)
                };
            default:
                throw new Error(`Unknown prefix: ${prefix}`);
        }
    }
    catch (error) {
        handleDecodingError(error, 'bech32 string');
    }
}
