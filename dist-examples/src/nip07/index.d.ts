import { NostrEvent } from '../types/nostr';
/**
 * Interface for the window.nostr extension API as defined in NIP-07
 */
export interface NostrWindow {
    getPublicKey(): Promise<string>;
    signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent>;
    nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
    nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
}
declare global {
    interface Window {
        nostr?: NostrWindow;
    }
}
/**
 * Checks if the browser has the NIP-07 extension available
 */
export declare const hasNip07Support: () => boolean;
/**
 * Gets the public key from the NIP-07 extension
 * @returns The public key in hex format
 * @throws Error if NIP-07 is not supported or fails
 */
export declare const getPublicKey: () => Promise<string>;
/**
 * Signs an event using the NIP-07 extension
 * @param event Event to sign (without id, pubkey, sig)
 * @returns Signed event with id, pubkey, and sig fields added
 * @throws Error if NIP-07 is not supported or fails
 */
export declare const signEvent: (event: Omit<NostrEvent, "id" | "pubkey" | "sig">) => Promise<NostrEvent>;
/**
 * Encrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
export declare const encryptNip04: (pubkey: string, plaintext: string) => Promise<string>;
/**
 * Decrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
export declare const decryptNip04: (pubkey: string, ciphertext: string) => Promise<string>;
/**
 * Encrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
export declare const encryptNip44: (pubkey: string, plaintext: string) => Promise<string>;
/**
 * Decrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
export declare const decryptNip44: (pubkey: string, ciphertext: string) => Promise<string>;
