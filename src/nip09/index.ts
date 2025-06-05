/**
 * NIP-09: Event Deletion Request
 *
 * Utilities for creating and processing deletion request events.
 * https://github.com/nostr-protocol/nips/blob/master/09.md
 */

import { createEvent } from "../nip01/event";
import { NostrEvent, NostrKind } from "../types/nostr";
import { UnsignedEvent } from "../nip01/event";

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
  const result: DeletionTargets = { ids: [], addresses: [], kinds: [] };
  for (const tag of event.tags) {
    if (tag[0] === "e" && tag[1]) {
      result.ids.push(tag[1]);
    } else if (tag[0] === "a" && tag[1]) {
      result.addresses.push(tag[1]);
    } else if (tag[0] === "k" && tag[1]) {
      const k = parseInt(tag[1], 10);
      if (!isNaN(k)) result.kinds.push(k);
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

  const dTag = event.tags.find((t) => t[0] === "d")?.[1];
  if (dTag) {
    const addr = `${event.kind}:${event.pubkey}:${dTag}`;
    if (targets.addresses.includes(addr)) return true;
  }
  return false;
}
