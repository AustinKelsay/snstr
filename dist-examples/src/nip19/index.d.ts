export declare enum Prefix {
    PublicKey = "npub",
    PrivateKey = "nsec",
    Note = "note",
    Profile = "nprofile",
    Event = "nevent",
    Address = "naddr"
}
export declare enum TLVType {
    Special = 0,// Depends on prefix: pubkey for nprofile, event id for nevent, identifier (d tag) for naddr
    Relay = 1,// Optional relay URL where the entity might be found
    Author = 2,// Author pubkey (for naddr, required; for nevent, optional)
    Kind = 3
}
/**
 * Encodes a hex string to a bech32 string with the given prefix
 */
export declare function encodeBech32(prefix: string, data: string): string;
/**
 * Decodes a bech32 string to a hex string
 */
export declare function decodeBech32(bech32Str: string): {
    prefix: string;
    data: string;
};
/**
 * Encodes a public key to npub format
 */
export declare function encodePublicKey(publicKey: string): string;
/**
 * Decodes an npub to a public key
 */
export declare function decodePublicKey(npub: string): string;
/**
 * Encodes a private key to nsec format
 */
export declare function encodePrivateKey(privateKey: string): string;
/**
 * Decodes an nsec to a private key
 */
export declare function decodePrivateKey(nsec: string): string;
/**
 * Encodes a note ID to note format
 */
export declare function encodeNoteId(noteId: string): string;
/**
 * Decodes a note to a note ID
 */
export declare function decodeNoteId(note: string): string;
/**
 * Interface for Profile data (nprofile)
 */
export interface ProfileData {
    pubkey: string;
    relays?: string[];
}
/**
 * Encodes profile data to an nprofile
 */
export declare function encodeProfile(data: ProfileData): string;
/**
 * Decodes an nprofile to profile data
 */
export declare function decodeProfile(nprofile: string): ProfileData;
/**
 * Interface for Event data (nevent)
 */
export interface EventData {
    id: string;
    relays?: string[];
    author?: string;
    kind?: number;
}
/**
 * Encodes event data to an nevent
 */
export declare function encodeEvent(data: EventData): string;
/**
 * Decodes an nevent to event data
 */
export declare function decodeEvent(nevent: string): EventData;
/**
 * Interface for Address data (naddr)
 */
export interface AddressData {
    identifier: string;
    pubkey: string;
    kind: number;
    relays?: string[];
}
/**
 * Encodes address data to an naddr
 */
export declare function encodeAddress(data: AddressData): string;
/**
 * Decodes an naddr to address data
 */
export declare function decodeAddress(naddr: string): AddressData;
/**
 * Parses any NIP-19 entity and returns its type and data
 */
export declare function decode(bech32Str: string): {
    type: string;
    data: string | ProfileData | EventData | AddressData;
};
