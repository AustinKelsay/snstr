import { NostrEvent } from '../types/nostr';
import { Nostr } from '../client/nostr';
/**
 * NIP-07 enabled Nostr client that uses browser extension for signing
 * and key management instead of keeping keys in memory
 */
export declare class Nip07Nostr extends Nostr {
    private nip07PublicKey?;
    /**
     * Creates a new Nostr client that uses NIP-07 browser extension
     * @param relayUrls Array of relay URLs to connect to
     * @throws Error if NIP-07 extension is not available
     */
    constructor(relayUrls?: string[]);
    /**
     * Initialize the client with the public key from the NIP-07 extension
     * @returns The initialized public key
     */
    initializeWithNip07(): Promise<string>;
    /**
     * Override getPublicKey to use the NIP-07 public key
     * @returns The public key from NIP-07 extension
     */
    getPublicKey(): string | undefined;
    /**
     * Override setPrivateKey to prevent setting private key directly
     * @throws Error as private key can't be set manually with NIP-07
     */
    setPrivateKey(_privateKey: string): void;
    /**
     * Override generateKeys to use NIP-07 extension
     * @returns Object with publicKey (privateKey is empty string)
     */
    generateKeys(): Promise<{
        privateKey: string;
        publicKey: string;
    }>;
    /**
     * Publishes a text note using the NIP-07 extension for signing
     * @param content Content of the note
     * @param tags Optional tags to add to the note
     * @returns The published event or null if failed
     */
    publishTextNote(content: string, tags?: string[][]): Promise<NostrEvent | null>;
    /**
     * Publishes a direct message to a recipient using the NIP-07 extension
     * @param content Message content
     * @param recipientPubkey Recipient's public key
     * @param tags Additional tags
     * @returns The published event or null if failed
     */
    publishDirectMessage(content: string, recipientPubkey: string, tags?: string[][]): Promise<NostrEvent | null>;
    /**
     * Decrypt a direct message using the NIP-07 extension
     * @param event The encrypted message event
     * @returns The decrypted content
     * @throws Error if decryption fails
     */
    decryptDirectMessage(event: NostrEvent): string;
    /**
     * Async version of decryptDirectMessage that works with NIP-07
     * @param event The encrypted message event
     * @returns Promise resolving to the decrypted content
     */
    decryptDirectMessageAsync(event: NostrEvent): Promise<string>;
}
