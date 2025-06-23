// NIP-02 implementation will go here

import { NostrEvent, ContactsEvent } from "../types/nostr";
import { getUnixTime } from "../utils/time";
import { isValidPublicKeyPoint } from "../nip44";
import { isValidRelayUrl } from "../nip19";
import { normalizeRelayUrl as canonicalizeRelayUrl } from "../utils/relayUrl";
import { 
  validateArrayAccess, 
  safeArrayAccess,
  SecurityValidationError
} from "../utils/security-validator";
// Assuming NostrEvent and NostrTag are defined in a central types file.
// Adjust the import path if necessary.

/**
 * NIP-02: Contact List and Petnames
 *
 * Defines a format for users to publish their contact list (follows)
 * as a Nostr event of kind 3. Each contact can include a public key,
 * a recommended relay URL, and a petname.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/02.md
 */

/**
 * Represents a contact in a NIP-02 contact list.
 */
export interface Contact {
  /** The public key of the followed user (hex format). */
  pubkey: string;
  /** An optional recommended relay URL for the followed user. */
  relayUrl?: string;
  /** An optional petname for the followed user. */
  petname?: string;
}

/**
 * Context information for warnings that provides additional details about where the warning occurred.
 */
export interface WarningContext {
  /** The index of the tag in the event.tags array where the warning occurred. */
  tagIndex?: number;
  /** The public key associated with the warning (for relay URL warnings). */
  pubkey?: string;
  /** Additional metadata that might be relevant for debugging. */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Warning message for invalid data encountered during parsing.
 */
export interface ParseWarning {
  /** The type of warning. */
  type: 'invalid_relay_url' | 'invalid_pubkey' | 'duplicate_pubkey';
  /** Human-readable warning message. */
  message: string;
  /** The invalid value that triggered the warning. */
  value: string;
  /** Additional context about where the warning occurred. */
  context?: WarningContext;
}

/**
 * Result of parsing contacts from an event.
 */
export interface ParseContactsResult {
  /** Successfully parsed contacts. */
  contacts: Contact[];
  /** Warnings encountered during parsing. */
  warnings: ParseWarning[];
}

/**
 * Data that can be logged alongside warning messages.
 */
export interface LogData {
  /** The invalid value that triggered the warning. */
  value: string;
  /** Additional context about where the warning occurred. */
  context?: WarningContext;
}

/**
 * Optional logger interface for handling warnings externally.
 */
export interface Logger {
  warn(message: string, data?: LogData): void;
}

/**
 * Represents a NIP-02 contact list event (kind 3).
 * The `tags` array contains "p" tags formatted as:
 * ["p", <pubkey_hex>, <recommended_relay_url_or_empty_string>, <petname_or_empty_string>]
 * The `content` of a kind 3 event is typically an empty string or a JSON string
 * containing legacy petname information (mapping pubkeys to names).
 * This implementation prioritizes petnames from tags.
 */
export interface ContactListEvent extends NostrEvent {
  kind: 3;
  // Tags should conform to NostrEvent's string[][] while carrying NIP-02 semantics.
  // The functions createContactListEvent and parseContactsFromEvent will handle
  // the specific structure: ["p", pubkey, relayUrl?, petname?]
  tags: string[][];
}

/**
 * Creates a NIP-02 contact list event (kind 3).
 *
 * @param contacts An array of `Contact` objects.
 * @param existingContent Optional content for the event.
 *                        NIP-02 allows for legacy petnames in a JSON string here,
 *                        but recommends petnames in tags.
 * @returns A NostrEvent object (unsigned) representing the contact list.
 */
export function createContactListEvent(
  contacts: Contact[],
  existingContent: string = "",
): Omit<ContactsEvent, "id" | "sig" | "pubkey"> {
  // Assuming ContactsEvent is a more generic kind 3 type
  const tags: string[][] = contacts.map((contact) => {
    const tag: string[] = ["p", contact.pubkey];
    if (contact.relayUrl || contact.petname) {
      // Need to add relayUrl even if empty if petname is present
      tag.push(contact.relayUrl || "");
    }
    if (contact.petname) {
      tag.push(contact.petname);
    }
    return tag;
  });

  return {
    kind: 3,
    tags,
    content: existingContent,
    created_at: getUnixTime(),
  };
}

/**
 * Parses a NIP-02 contact list event (kind 3) to extract the list of contacts.
 *
 * @param event The contact list event (must be kind 3).
 * @param options Optional configuration for parsing behavior.
 * @param options.logger Optional logger to handle warnings externally.
 * @param options.returnWarnings If true, returns an object with contacts and warnings. Default: false.
 * @returns An array of `Contact` objects, or a `ParseContactsResult` object if returnWarnings is true.
 * @throws Error if the event is not a valid kind 3 event.
 */
export function parseContactsFromEvent(
  event: ContactsEvent,
  options?: { logger?: Logger; returnWarnings?: false }
): Contact[];
export function parseContactsFromEvent(
  event: ContactsEvent,
  options: { logger?: Logger; returnWarnings: true }
): ParseContactsResult;
export function parseContactsFromEvent(
  event: ContactsEvent,
  options: { logger?: Logger; returnWarnings?: boolean } = {}
): Contact[] | ParseContactsResult {
  // Assuming ContactsEvent is suitable
  if (event.kind !== 3) {
    throw new Error("Invalid event: Expected kind 3 for contact list.");
  }

  const parsedContacts: Contact[] = [];
  const warnings: ParseWarning[] = [];
  const seenPubkeys = new Set<string>();
  
  const addWarning = (type: ParseWarning['type'], message: string, value: string, context?: WarningContext) => {
    const warning: ParseWarning = { type, message, value, context };
    warnings.push(warning);
    if (options.logger) {
      try {
        options.logger.warn(message, { value, context });
      } catch {
        // Ignore logger errors to prevent parsing from being aborted
      }
    }
  };

  // Use shared validators for pubkeys and relay URLs
  event.tags.forEach((tag, tagIndex) => {
    try {
      // Bounds check for basic tag structure
      if (!validateArrayAccess(tag, 0) || safeArrayAccess(tag, 0) !== "p") {
        return; // Skip non-p tags
      }

      // Safe access to tag[1] (pubkey)
      const pubkeyValue = safeArrayAccess(tag, 1);
      if (typeof pubkeyValue !== "string") {
        addWarning('invalid_pubkey', `Invalid p tag structure: pubkey at index 1 must be a string`, String(pubkeyValue), { tagIndex });
        return;
      }

      // Normalize to lowercase first to accept legacy uppercase pubkeys
      const normalizedPubkey = pubkeyValue.toLowerCase();

      // Validate that the public key is a valid curve point on secp256k1
      if (!isValidPublicKeyPoint(normalizedPubkey)) {
        addWarning('invalid_pubkey', `Invalid public key (not a valid curve point): ${pubkeyValue}`, pubkeyValue, { tagIndex });
        return; // Skip invalid keys
      }

      // Skip duplicate pubkeys (normalize to lowercase for consistent deduplication)
      if (seenPubkeys.has(normalizedPubkey)) {
        addWarning('duplicate_pubkey', `Duplicate public key: ${normalizedPubkey}`, normalizedPubkey, { tagIndex });
        return;
      }
      seenPubkeys.add(normalizedPubkey);

      const contact: Contact = {
        pubkey: normalizedPubkey,
      };
      
      // Safe access to tag[2] (relay URL) - optional
      const relayUrlValue = safeArrayAccess(tag, 2);
      if (typeof relayUrlValue === "string" && relayUrlValue.length > 0) {
        // Trim and canonicalize the relay URL (lowercase scheme + host) for consistency
        const trimmedRelayUrl = relayUrlValue.trim();
        if (trimmedRelayUrl.length > 0) {
          // Require the tag value itself to include a valid ws:// or wss:// scheme.
          // This prevents "naked" hostnames from being auto-upgraded and accepted.
          const hasWebSocketScheme = /^wss?:\/\//i.test(trimmedRelayUrl);

          if (!hasWebSocketScheme) {
            // Treat as invalid and keep relayUrl undefined but retain petname.
            addWarning('invalid_relay_url', `Invalid relay URL (missing ws/wss scheme): ${relayUrlValue}`, relayUrlValue, { 
              pubkey: normalizedPubkey, 
              tagIndex 
            });
          } else {
            let canonicalUrl: string | undefined;
            try {
              canonicalUrl = canonicalizeRelayUrl(trimmedRelayUrl);
            } catch {
              canonicalUrl = undefined;
            }

            if (canonicalUrl && isValidRelayUrl(canonicalUrl)) {
              contact.relayUrl = canonicalUrl;
            } else {
              addWarning('invalid_relay_url', `Invalid relay URL (failed validation): ${relayUrlValue}`, relayUrlValue, { 
                pubkey: normalizedPubkey, 
                tagIndex 
              });
            }
          }
        }
      }
      
      // Safe access to tag[3] (petname) - optional
      const petnameValue = safeArrayAccess(tag, 3);
      if (typeof petnameValue === "string" && petnameValue.length > 0) {
        contact.petname = petnameValue;
      }
      
      parsedContacts.push(contact);
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        addWarning('invalid_pubkey', `Bounds checking error: ${error.message}`, '', { tagIndex });
      }
      // Continue processing other tags
    }
  });
  
  if (options.returnWarnings) {
    return { contacts: parsedContacts, warnings };
  }
  
  return parsedContacts;
}

/**
 * Parses a NIP-02 contact list event with detailed warnings.
 * This is a convenience function that always returns warnings.
 *
 * @param event The contact list event (must be kind 3).
 * @param logger Optional logger to handle warnings externally.
 * @returns A `ParseContactsResult` object containing contacts and warnings.
 * @throws Error if the event is not a valid kind 3 event.
 */
export function parseContactsFromEventWithWarnings(
  event: ContactsEvent,
  logger?: Logger
): ParseContactsResult {
  return parseContactsFromEvent(event, { logger, returnWarnings: true });
}
