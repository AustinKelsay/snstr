import { EventTemplate, NostrEvent } from '../types/nostr';
export type UnsignedEvent = Omit<NostrEvent, 'id' | 'sig'>;
export declare function getEventHash(event: UnsignedEvent | NostrEvent): Promise<string>;
/**
 * Create an unsigned event from a template
 */
export declare function createEvent(template: EventTemplate, pubkey: string): Omit<NostrEvent, 'id' | 'sig'>;
/**
 * Create and sign an event
 */
export declare function createSignedEvent(event: UnsignedEvent, privateKey: string): Promise<NostrEvent>;
/**
 * Create a text note event (kind 1)
 */
export declare function createTextNote(content: string, tags?: string[][]): UnsignedEvent;
/**
 * Create a direct message event (kind 4)
 * Encrypts the content using NIP-04 specification
 */
export declare function createDirectMessage(content: string, recipientPubkey: string, privateKey: string, tags?: string[][]): UnsignedEvent;
/**
 * Create a metadata event (kind 0)
 */
export declare function createMetadataEvent(metadata: Record<string, any>, privateKey: string): UnsignedEvent;
