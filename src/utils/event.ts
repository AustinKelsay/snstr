import { EventTemplate, NostrEvent } from "../types/nostr";
import { getPublicKey } from "./crypto";
import { encrypt as encryptNIP04 } from "../nip04";
import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { sha256Hex } from "./crypto";
import { signEvent as signEventCrypto } from "./crypto";

export type UnsignedEvent = Omit<NostrEvent, "id" | "sig">;

/**
 * Calculate the event hash following NIP-01 specification exactly
 * for deterministic serialization across different implementations
 */
export async function getEventHash(
  event: UnsignedEvent | NostrEvent,
): Promise<string> {
  // Validate event structure first - these fields are required by the Nostr protocol
  if (!event.pubkey) throw new Error("Invalid event: missing pubkey");
  if (!event.created_at) throw new Error("Invalid event: missing created_at");
  if (event.kind === undefined) throw new Error("Invalid event: missing kind");
  if (!Array.isArray(event.tags))
    throw new Error("Invalid event: tags must be an array");

  // Ensure the tags are valid arrays of strings
  for (const tag of event.tags) {
    if (!Array.isArray(tag))
      throw new Error("Invalid event: each tag must be an array");
    for (const item of tag) {
      if (typeof item !== "string")
        throw new Error("Invalid event: tag items must be strings");
    }
  }

  // Check that content is a string
  if (typeof event.content !== "string")
    throw new Error("Invalid event: content must be a string");

  // NIP-01 specifies the serialization format as:
  // [0, pubkey, created_at, kind, tags, content]
  // We need to ensure deterministic serialization

  // Create the array to be serialized
  const eventData = [
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ];

  // Per NIP-01: whitespace, line breaks or other unnecessary formatting
  // should not be included in the output JSON
  // JavaScript's JSON.stringify doesn't add whitespace by default
  // so we don't need to pass additional options

  // Serialize to JSON without pretty formatting
  // JSON.stringify on arrays is deterministic in all JS engines
  // because array order is preserved
  const serialized = JSON.stringify(eventData);

  // Hash the serialized data
  return sha256Hex(serialized);
}

async function signEvent(
  event: Omit<NostrEvent, "sig">,
  privateKey: string,
): Promise<NostrEvent> {
  const signatureBytes = await schnorr.sign(
    hexToBytes(event.id),
    hexToBytes(privateKey),
  );
  const signature = bytesToHex(signatureBytes);

  return {
    ...event,
    sig: signature,
  };
}

/**
 * Create an unsigned event from a template
 */
export function createEvent(
  template: EventTemplate,
  pubkey: string,
): Omit<NostrEvent, "id" | "sig"> {
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
  privateKey: string,
): Promise<NostrEvent> {
  const id = await getEventHash(event);
  const sig = await signEventCrypto(id, privateKey);

  return {
    ...event,
    id,
    sig,
  };
}

/**
 * Create a text note event (kind 1)
 *
 * @param content The content of the text note
 * @param privateKey The private key to derive the pubkey from
 * @param tags Optional tags for the event
 * @returns An unsigned event with pubkey automatically set
 */
export function createTextNote(
  content: string,
  privateKey: string,
  tags: string[][] = [],
): UnsignedEvent {
  const pubkey = getPublicKey(privateKey);

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content,
  };
}

/**
 * Create a direct message event (kind 4)
 * Encrypts the content using NIP-04 specification
 *
 * @param content The plaintext content to encrypt
 * @param recipientPubkey The public key of the recipient
 * @param privateKey The private key of the sender
 * @param tags Optional additional tags
 * @returns An unsigned event with pubkey automatically set and content encrypted
 */
export async function createDirectMessage(
  content: string,
  recipientPubkey: string,
  privateKey: string,
  tags: string[][] = [],
): Promise<UnsignedEvent> {
  const pubkey = getPublicKey(privateKey);

  // Encrypt the content using NIP-04
  const encryptedContent = await encryptNIP04(content, privateKey, recipientPubkey);

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 4,
    tags: [["p", recipientPubkey], ...tags],
    content: encryptedContent,
  };
}

/**
 * Create a metadata event (kind 0)
 */
export function createMetadataEvent(
  metadata: Record<string, any>,
  privateKey: string,
): UnsignedEvent {
  // Get the public key from the private key to ensure the pubkey is non-empty
  const pubkey = getPublicKey(privateKey);

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 0,
    tags: [],
    content: JSON.stringify(metadata),
  };
}

/**
 * Create an addressable event (kinds 30000-39999)
 * These are events that can be replaced based on kind, pubkey, and d-tag value
 *
 * @param kind The kind of the event (must be between 30000-39999)
 * @param dTagValue The value for the d tag that identifies this addressable event
 * @param content The content of the event
 * @param privateKey The private key to derive the pubkey from
 * @param additionalTags Optional additional tags for the event
 * @returns An unsigned event with pubkey automatically set
 */
export function createAddressableEvent(
  kind: number,
  dTagValue: string,
  content: string,
  privateKey: string,
  additionalTags: string[][] = [],
): UnsignedEvent {
  if (kind < 30000 || kind >= 40000) {
    throw new Error('Addressable events must have kind between 30000-39999');
  }

  const pubkey = getPublicKey(privateKey);
  
  // Ensure the d tag is included and is the first tag
  const dTag = ['d', dTagValue];
  const tags = [dTag, ...additionalTags];

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
  };
}
