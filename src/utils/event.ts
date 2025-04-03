import { EventTemplate, NostrEvent } from '../types/nostr';
import { getPublicKey } from './crypto';
import { encrypt as encryptNIP04 } from '../nip04';
import { createHash } from 'crypto';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256Hex } from './crypto';
import { signEvent as signEventCrypto } from './crypto';

async function sha256Hash(data: string): Promise<string> {
  return createHash('sha256').update(data).digest('hex');
}

export type UnsignedEvent = Omit<NostrEvent, 'id' | 'sig'>;

export async function getEventHash(event: UnsignedEvent | NostrEvent): Promise<string> {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);

  return sha256Hex(serialized);
}

async function signEvent(
  event: Omit<NostrEvent, 'sig'>,
  privateKey: string
): Promise<NostrEvent> {
  const signatureBytes = await schnorr.sign(
    hexToBytes(event.id),
    hexToBytes(privateKey)
  );
  const signature = bytesToHex(signatureBytes);

  return {
    ...event,
    sig: signature
  };
}

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
  event: UnsignedEvent,
  privateKey: string
): Promise<NostrEvent> {
  const id = await getEventHash(event);
  const sig = await signEventCrypto(id, privateKey);

  return {
    ...event,
    id,
    sig
  };
}

/**
 * Create a text note event (kind 1)
 */
export function createTextNote(content: string, tags: string[][] = []): UnsignedEvent {
  return {
    pubkey: '',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content
  };
}

/**
 * Create a direct message event (kind 4)
 * Encrypts the content using NIP-04 specification
 */
export function createDirectMessage(
  content: string,
  recipientPubkey: string,
  privateKey: string,
  tags: string[][] = []
): UnsignedEvent {
  // Encrypt the content using NIP-04
  const encryptedContent = encryptNIP04(content, privateKey, recipientPubkey);

  return {
    pubkey: '',
    created_at: Math.floor(Date.now() / 1000),
    kind: 4,
    tags: [['p', recipientPubkey], ...tags],
    content: encryptedContent
  };
}

/**
 * Create a metadata event (kind 0)
 */
export function createMetadataEvent(
  metadata: Record<string, any>,
  privateKey: string
): UnsignedEvent {
  return {
    pubkey: '',
    created_at: Math.floor(Date.now() / 1000),
    kind: 0,
    tags: [],
    content: JSON.stringify(metadata)
  };
} 