import { NostrEvent } from '../types/nostr';
import { NIP46BunkerOptions, NIP46Metadata } from './types';
export declare class NostrRemoteSignerBunker {
    private nostr;
    private userKeypair;
    private signerKeypair;
    private options;
    private connectedClients;
    private pendingAuthChallenges;
    private preferredEncryption;
    private subId;
    constructor(options: NIP46BunkerOptions);
    /**
     * Get the public key of the signer
     */
    getSignerPubkey(): string;
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Set the user's private key
     */
    setUserPrivateKey(privateKey: string): void;
    /**
     * Set the signer's private key
     */
    setSignerPrivateKey(privateKey: string): void;
    /**
     * Initialize both user and signer private keys
     */
    setPrivateKeys(userPrivateKey: string, signerPrivateKey?: string): void;
    /**
     * Resolves an authentication challenge for a user
     * @param pubkey The public key of the user to resolve the auth challenge for
     * @returns boolean indicating if any challenge was resolved
     */
    resolveAuthChallenge(pubkey: string): boolean;
    private cleanup;
    private handleRequest;
    private handleConnect;
    private handleSignEvent;
    private handleGetPublicKey;
    private handleEncryption;
    private sendResponse;
    private isClientAuthorized;
    getConnectionString(): string;
    publishMetadata(metadata: NIP46Metadata): Promise<NostrEvent | undefined>;
}
