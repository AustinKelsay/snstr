import { LogLevel } from './utils/logger';
export interface SimpleNIP46BunkerOptions {
    timeout?: number;
    logLevel?: LogLevel;
    defaultPermissions?: string[];
    secret?: string;
}
/**
 * Simple implementation of a NIP-46 bunker (remote signer)
 *
 * This class implements the signer-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export declare class SimpleNIP46Bunker {
    private nostr;
    private relays;
    private userKeys;
    private signerKeys;
    private clients;
    private defaultPermissions;
    private subId;
    private secret?;
    private logger;
    /**
     * Create a new SimpleNIP46Bunker
     *
     * @param relays - Array of relay URLs to connect to
     * @param userPubkey - The user's public key
     * @param signerPubkey - Optional separate signer public key (defaults to user pubkey)
     * @param options - Bunker options
     */
    constructor(relays: string[], userPubkey: string, signerPubkey?: string, options?: SimpleNIP46BunkerOptions);
    /**
     * Start the bunker and listen for requests
     */
    start(): Promise<void>;
    /**
     * Stop the bunker
     */
    stop(): Promise<void>;
    /**
     * Get a connection string for clients
     */
    getConnectionString(): string;
    /**
     * Set the user's private key
     */
    setUserPrivateKey(privateKey: string): void;
    /**
     * Set the signer's private key
     */
    setSignerPrivateKey(privateKey: string): void;
    /**
     * Set default permissions for all clients
     */
    setDefaultPermissions(permissions: string[]): void;
    /**
     * Add a permission for a specific client
     */
    addClientPermission(clientPubkey: string, permission: string): boolean;
    /**
     * Remove a permission from a specific client
     */
    removeClientPermission(clientPubkey: string, permission: string): boolean;
    /**
     * Handle an incoming request event
     */
    private handleRequest;
    /**
     * Handle a connect request
     */
    private handleConnect;
    /**
     * Handle a sign_event request
     */
    private handleSignEvent;
    /**
     * Handle a nip04_encrypt request
     */
    private handleNIP04Encrypt;
    /**
     * Handle a nip04_decrypt request
     */
    private handleNIP04Decrypt;
    /**
     * Send a response to a client
     */
    private sendResponse;
    /**
     * Check if a client is authorized
     */
    private isClientAuthorized;
    /**
     * Set the log level
     */
    setLogLevel(level: LogLevel): void;
}
