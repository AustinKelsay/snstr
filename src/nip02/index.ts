// NIP-02 implementation will go here

import { NostrEvent, ContactsEvent } from "../types/nostr";
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
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Parses a NIP-02 contact list event (kind 3) to extract the list of contacts.
 *
 * @param event The contact list event (must be kind 3).
 * @returns An array of `Contact` objects.
 * @throws Error if the event is not a valid kind 3 event.
 */
export function parseContactsFromEvent(event: ContactsEvent): Contact[] {
  // Assuming ContactsEvent is suitable
  if (event.kind !== 3) {
    throw new Error("Invalid event: Expected kind 3 for contact list.");
  }

  const parsedContacts: Contact[] = [];
  const pubkeyRegex = /^[0-9a-fA-F]{64}$/; // Regex for 64 hex characters
  const relayUrlRegex = /^(wss?:\/\/).+/; // Regex for ws:// or wss://

  for (const tag of event.tags) {
    if (
      tag[0] === "p" &&
      typeof tag[1] === "string" &&
      pubkeyRegex.test(tag[1]) // Enhanced pubkey validation
    ) {
      const contact: Contact = {
        pubkey: tag[1],
      };
      if (typeof tag[2] === "string" && tag[2].length > 0) {
        if (relayUrlRegex.test(tag[2])) { // Relay URL validation
          contact.relayUrl = tag[2];
        } else {
          console.warn("Invalid relay URL:", tag[2]);
        }
      }
      if (typeof tag[3] === "string" && tag[3].length > 0) {
        contact.petname = tag[3];
      }
      parsedContacts.push(contact);
    }
  }
  return parsedContacts;
}
