/**
 * NIP-05: Mapping Nostr keys to DNS-based internet identifiers
 * Implementation based on https://github.com/nostr-protocol/nips/blob/master/05.md
 */
interface NIP05Response {
    names: Record<string, string>;
    relays?: Record<string, string[]>;
}
/**
 * Verify if a NIP-05 identifier matches a given public key
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @param pubkey - The Nostr public key in hex format
 * @returns Promise that resolves to boolean indicating if verification was successful
 */
export declare function verifyNIP05(identifier: string, pubkey: string): Promise<boolean>;
/**
 * Lookup a NIP-05 identifier to get the associated public key and relays
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to NIP05Response or null if not found/invalid
 */
export declare function lookupNIP05(identifier: string): Promise<NIP05Response | null>;
/**
 * Get the public key associated with a NIP-05 identifier
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to the public key or null if not found/invalid
 */
export declare function getPublicKeyFromNIP05(identifier: string): Promise<string | null>;
/**
 * Get the recommended relays for a Nostr public key from a NIP-05 identifier
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @param pubkey - Optional public key to verify against
 * @returns Promise that resolves to an array of relay URLs or null
 */
export declare function getRelaysFromNIP05(identifier: string, pubkey?: string): Promise<string[] | null>;
export {};
