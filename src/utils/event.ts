import { EventTemplate, NostrEvent } from '../types/nostr';
import { getEventHash, signEvent, getPublicKey, encryptMessage } from './crypto';

/**
 * Create an unsigned event from a template
 */
export function createEvent(
  template: EventTemplate,
  pubkey: string
): Omit<NostrEvent, 'id' | 'sig'> {
  return {
    pubkey,
    created_at: template.created_at || Math.floor(Date.now() / 1000),
    kind: template.kind,
    tags: template.tags || [],
    content: template.content,
  };
}

/**
 * Create and sign an event
 */
export async function createSignedEvent(
  template: EventTemplate,
  privateKey: string,
  pubkey?: string
): Promise<NostrEvent> {
  // Get the public key from the private key if not provided
  const _pubkey = pubkey || getPublicKey(privateKey);
  const unsignedEvent = createEvent(template, _pubkey);
  const idEvent = {
    ...unsignedEvent,
    id: getEventHash(unsignedEvent),
  };
  return await signEvent(idEvent, privateKey);
}

/**
 * Create a text note event (kind 1)
 */
export function createTextNote(content: string, tags: string[][] = []): EventTemplate {
  return {
    kind: 1,
    content,
    tags,
  };
}

/**
 * Create a direct message event (kind 4)
 * Encrypts the content according to NIP-04
 */
export function createDirectMessage(
  content: string,
  recipientPubkey: string,
  senderPrivateKey: string,
  tags: string[][] = []
): EventTemplate {
  // Encrypt the content using NIP-04
  const encryptedContent = encryptMessage(content, senderPrivateKey, recipientPubkey);
  
  return {
    kind: 4,
    content: encryptedContent,
    tags: [['p', recipientPubkey], ...tags],
  };
}

/**
 * Create a metadata event (kind 0)
 */
export function createMetadataEvent(
  metadata: Record<string, any>
): EventTemplate {
  return {
    kind: 0,
    content: JSON.stringify(metadata),
    tags: [],
  };
} 