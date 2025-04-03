import { NostrEvent } from '../types/nostr';
import { LogLevel } from './utils/logger';
export interface SimpleNIP46ClientOptions {
    timeout?: number;
    logLevel?: LogLevel;
}
/**
 * Simple implementation of a NIP-46 client
 *
 * This class implements the client-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export declare class SimpleNIP46Client {
    private nostr;
    private clientKeys;
    private signerPubkey;
    private userPubkey;
    private pendingRequests;
    private subId;
    private timeout;
    private logger;
    /**
     * Create a new SimpleNIP46Client
     *
     * @param relays - Array of relay URLs to connect to
     * @param options - Client options
     */
    constructor(relays: string[], options?: SimpleNIP46ClientOptions);
    /**
     * Connect to a remote signer
     *
     * @param connectionString - The bunker:// connection string
     * @returns The user's public key
     */
    connect(connectionString: string): Promise<string>;
    /**
     * Get the user's public key
     */
    getPublicKey(): Promise<string>;
    /**
     * Ping the bunker to check connectivity
     */
    ping(): Promise<boolean>;
    /**
     * Sign an event remotely
     * @param eventData - Event data to sign
     * @returns Signed event
     */
    signEvent(eventData: any): Promise<NostrEvent>;
    /**
     * Encrypt a message using NIP-04
     */
    nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>;
    /**
     * Decrypt a message using NIP-04
     */
    nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>;
    /**
     * Disconnect from the remote signer
     */
    disconnect(): Promise<void>;
    /**
     * Send a request to the remote signer
     *
     * @param method - The request method
     * @param params - The request parameters
     * @returns A promise that resolves with the response
     */
    private sendRequest;
    /**
     * Handle a response from the remote signer
     *
     * @param event - The response event
     */
    private handleResponse;
    /**
     * Set the log level
     */
    setLogLevel(level: LogLevel): void;
}
