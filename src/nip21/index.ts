/**
 * NIP-21: `nostr:` URI scheme
 *
 * Provides helpers to create and parse `nostr:` URIs which
 * wrap NIP-19 bech32 identifiers.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/21.md
 */

import { decode, Prefix, Bech32String, DecodedEntity } from "../nip19";

/** Prefix for nostr URIs */
export const NOSTR_URI_PREFIX = "nostr:";

/**
 * Create a `nostr:` URI from a NIP-19 identifier.
 *
 * @param entity - Bech32 encoded entity (npub, note, nprofile, nevent, naddr)
 * @returns URI string in the form `nostr:<entity>`
 * @throws Error if the entity is an nsec or invalid string
 */
export function encodeNostrURI(entity: Bech32String): string {
  if (!entity || typeof entity !== "string") {
    throw new Error("Invalid NIP-19 entity");
  }
  if (entity.startsWith(Prefix.PrivateKey)) {
    throw new Error("nsec entities are not allowed in nostr URIs");
  }
  // Basic prefix check to ensure it looks like bech32
  if (!entity.includes("1")) {
    throw new Error("Invalid bech32 format for NIP-19 entity");
  }
  return `${NOSTR_URI_PREFIX}${entity}`;
}

/**
 * Parse a `nostr:` URI and decode the underlying NIP-19 entity.
 *
 * @param uri - URI string starting with `nostr:`
 * @returns Decoded NIP-19 entity
 * @throws Error if the URI is malformed or contains an invalid entity
 */
export function decodeNostrURI(uri: string): DecodedEntity {
  if (!uri.startsWith(NOSTR_URI_PREFIX)) {
    throw new Error("Invalid nostr URI format");
  }
  const entity = uri.slice(NOSTR_URI_PREFIX.length) as Bech32String;
  return decode(entity);
}
