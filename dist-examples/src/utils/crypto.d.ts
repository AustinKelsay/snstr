import { NostrEvent } from '../types/nostr';
/**
 * Compute the event ID from the event data
 */
export declare function getEventHash(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<string>;
/**
 * Sign an event with the given private key
 */
export declare function signEvent(eventId: string, privateKey: string): Promise<string>;
/**
 * Verify the signature of an event
 */
export declare function verifySignature(eventId: string, signature: string, publicKey: string): Promise<boolean>;
/**
 * Generate a keypair for Nostr
 */
export declare function generateKeypair(): Promise<{
    privateKey: string;
    publicKey: string;
}>;
/**
 * Get the public key from a private key
 */
export declare function getPublicKey(privateKey: string): string;
export declare function sha256(data: string | Uint8Array): Uint8Array;
export declare function sha256Hex(data: string | Uint8Array): string;
