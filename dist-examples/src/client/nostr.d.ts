import { Relay } from './relay';
import { NostrEvent, Filter, RelayEvent } from '../types/nostr';
export declare class Nostr {
    private relays;
    private privateKey?;
    private publicKey?;
    constructor(relayUrls?: string[]);
    addRelay(url: string): Relay;
    removeRelay(url: string): void;
    connectToRelays(): Promise<void>;
    disconnectFromRelays(): void;
    setPrivateKey(privateKey: string): void;
    generateKeys(): Promise<{
        privateKey: string;
        publicKey: string;
    }>;
    getPublicKey(): string | undefined;
    publishEvent(event: NostrEvent): Promise<NostrEvent | null>;
    publishTextNote(content: string, tags?: string[][]): Promise<NostrEvent | null>;
    publishDirectMessage(content: string, recipientPubkey: string, tags?: string[][]): Promise<NostrEvent | null>;
    /**
     * Decrypt a direct message received from another user
     *
     * Uses NIP-04 encryption which is the standard for kind:4 direct messages
     */
    decryptDirectMessage(event: NostrEvent): string;
    publishMetadata(metadata: Record<string, any>): Promise<NostrEvent | null>;
    subscribe(filters: Filter[], onEvent: (event: NostrEvent, relay: string) => void, onEOSE?: () => void): string[];
    unsubscribe(subscriptionIds: string[]): void;
    unsubscribeAll(): void;
    on(event: RelayEvent, callback: (relay: string, ...args: any[]) => void): void;
}
