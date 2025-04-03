import { NostrEvent } from '../types/nostr';
import { NIP46ClientOptions } from './types';
export declare class NostrRemoteSignerClient {
    private nostr;
    private clientKeypair;
    private signerPubkey;
    private userPubkey;
    private pendingRequests;
    private options;
    private preferredEncryption;
    private authWindow;
    private connected;
    private subId;
    constructor(options?: NIP46ClientOptions);
    /**
     * Set up subscription to receive responses from the signer
     */
    private setupSubscription;
    /**
     * Clean up resources and reset state
     */
    private cleanup;
    /**
     * Connect to a remote signer
     * @throws {Error} If connection fails or validation fails
     */
    connect(connectionString: string): Promise<string>;
    /**
     * Parse a connection string into connection info
     */
    private parseConnectionString;
    /**
     * Disconnect from the remote signer
     */
    disconnect(): Promise<void>;
    /**
     * Sign an event using the remote signer
     */
    signEvent(eventData: Partial<NostrEvent>): Promise<NostrEvent>;
    /**
     * Get the user's public key from the remote signer
     */
    getPublicKey(): Promise<string>;
    /**
     * Send a ping to the remote signer
     */
    ping(): Promise<string>;
    /**
     * Encrypt a message using NIP-04
     */
    nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>;
    /**
     * Decrypt a message using NIP-04
     */
    nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>;
    /**
     * Encrypt a message using NIP-44
     */
    nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>;
    /**
     * Decrypt a message using NIP-44
     */
    nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>;
    /**
     * Send a request to the remote signer
     */
    private sendRequest;
    /**
     * Encrypt and send a request to the signer
     */
    private sendEncryptedRequest;
    /**
     * Handle a response from the signer
     */
    private handleResponse;
    /**
     * Decrypt content from the signer
     * @private
     */
    private decryptContent;
    /**
     * Handle authentication challenge
     * @private
     */
    private handleAuthChallenge;
    /**
     * Generate a nostrconnect:// URL to allow the signer to connect to the client
     */
    static generateConnectionString(clientPubkey: string, options?: NIP46ClientOptions): string;
}
