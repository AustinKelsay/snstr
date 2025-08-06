/**
 * NIP-09: Event Deletion Request
 *
 * Utilities for creating and processing deletion request events.
 * https://github.com/nostr-protocol/nips/blob/master/09.md
 */

import { createEvent } from "../nip01/event";
import { NostrEvent, NostrKind } from "../types/nostr";
import { UnsignedEvent } from "../nip01/event";
import {
  validateArrayAccess,
  safeArrayAccess,
  SecurityValidationError,
} from "../utils/security-validator";

export interface DeletionRequestOptions {
  ids?: string[]; // event ids referenced with 'e' tags
  addresses?: string[]; // addresses referenced with 'a' tags
  kinds?: number[]; // event kinds referenced with 'k' tags
  content?: string; // reason for deletion
}

/**
 * Create an unsigned deletion request event (kind 5)
 */
export function createDeletionRequest(
  opts: DeletionRequestOptions,
  pubkey: string,
): UnsignedEvent {
  const tags: string[][] = [];
  for (const id of opts.ids || []) {
    tags.push(["e", id]);
  }
  for (const addr of opts.addresses || []) {
    tags.push(["a", addr]);
  }
  for (const kind of opts.kinds || []) {
    tags.push(["k", kind.toString()]);
  }

  return createEvent(
    {
      kind: NostrKind.Deletion,
      content: opts.content || "",
      tags,
    },
    pubkey,
  );
}

export interface DeletionTargets {
  ids: string[];
  addresses: string[];
  kinds: number[];
}

/**
 * Extract referenced ids, addresses and kinds from a deletion event
 */
export function parseDeletionTargets(event: NostrEvent): DeletionTargets {
  const result: DeletionTargets = {
    ids: [],
    addresses: [],
    kinds: [],
  };

  for (const tag of event.tags) {
    try {
      // Safe access to tag elements with bounds checking
      if (!validateArrayAccess(tag, 0) || !validateArrayAccess(tag, 1)) {
        continue; // Skip malformed tags
      }

      const tagName = safeArrayAccess(tag, 0);
      const tagValue = safeArrayAccess(tag, 1);

      if (typeof tagName !== "string" || typeof tagValue !== "string") {
        continue; // Skip malformed tags
      }

      if (tagName === "e" && tagValue) {
        result.ids.push(tagValue);
      } else if (tagName === "a" && tagValue) {
        result.addresses.push(tagValue);
      } else if (tagName === "k" && tagValue) {
        const k = parseInt(tagValue, 10);
        if (!isNaN(k)) {
          result.kinds.push(k);
        }
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        // Log bounds checking error but continue processing
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `NIP-09: Bounds checking error in tag processing: ${error.message}`,
          );
        }
      }
    }
  }

  return result;
}

/**
 * Check if a deletion request targets the given event
 */
export function isDeletionRequestForEvent(
  deletion: NostrEvent,
  event: NostrEvent,
): boolean {
  if (deletion.kind !== NostrKind.Deletion) return false;
  if (deletion.pubkey !== event.pubkey) return false;
  const targets = parseDeletionTargets(deletion);
  if (targets.ids.includes(event.id)) return true;

  // Safe access to d-tag with bounds checking
  try {
    const dTag = event.tags.find((t) => {
      try {
        return validateArrayAccess(t, 0) && safeArrayAccess(t, 0) === "d";
      } catch {
        return false;
      }
    });

    if (dTag && validateArrayAccess(dTag, 1)) {
      const dValue = safeArrayAccess(dTag, 1);
      if (typeof dValue === "string") {
        const addr = `${event.kind}:${event.pubkey}:${dValue}`;
        if (targets.addresses.includes(addr)) return true;
      }
    }
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          `NIP-09: Bounds checking error in d-tag processing: ${error.message}`,
        );
      }
    }
  }

  return false;
}
