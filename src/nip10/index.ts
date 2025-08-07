/**
 * NIP-10: Text Notes and Threads
 *
 * Utilities for working with thread references as defined in
 * https://github.com/nostr-protocol/nips/blob/master/10.md
 */

import { NostrEvent } from "../types/nostr";
import {
  validateArrayAccess,
  safeArrayAccess,
  SecurityValidationError,
} from "../utils/security-validator";

/** Event pointer used in thread references */
export interface ThreadPointer {
  id: string;
  relay?: string;
  pubkey?: string;
}

/** Parsed thread references from an event */
export interface ThreadReferences {
  /** Root event of the thread */
  root?: ThreadPointer;
  /** Direct parent being replied to */
  reply?: ThreadPointer;
  /** Other mentioned events */
  mentions: ThreadPointer[];
  /** Quoted events using e tags with mention markers */
  quotes: ThreadPointer[];
}

/**
 * Create marked "e" tags for a reply as defined in NIP-10.
 * The tags are returned in the recommended order from root to reply.
 */
export function createReplyTags(
  root: ThreadPointer,
  reply?: ThreadPointer,
): string[][] {
  const tags: string[][] = [];

  // Build root tag with consistent column order
  const rootTag = ["e", root.id];
  // Always include relay field to maintain proper column order
  rootTag.push(root.relay || "");
  rootTag.push("root");
  if (root.pubkey) {
    rootTag.push(root.pubkey);
  }
  tags.push(rootTag);

  if (reply) {
    // Build reply tag with consistent column order
    const replyTag = ["e", reply.id];
    // Always include relay field to maintain proper column order
    replyTag.push(reply.relay || "");
    replyTag.push("reply");
    if (reply.pubkey) {
      replyTag.push(reply.pubkey);
    }
    tags.push(replyTag);
  }

  return tags;
}

/** Create an "e" tag with "mention" marker for quoting an event */
export function createQuoteTag(pointer: ThreadPointer): string[] {
  const tag = ["e", pointer.id];
  // Always include relay field to maintain proper column order
  tag.push(pointer.relay || "");
  tag.push("mention");
  if (pointer.pubkey) {
    tag.push(pointer.pubkey);
  }
  return tag;
}

/**
 * Parse thread references (e tags) from an event. Handles both
 * marked and deprecated positional e tags.
 */
export function parseThreadReferences(event: NostrEvent): ThreadReferences {
  const eTags = event.tags.filter((t) => {
    try {
      return validateArrayAccess(t, 0) && safeArrayAccess(t, 0) === "e";
    } catch {
      return false;
    }
  });

  let root: ThreadPointer | undefined;
  let reply: ThreadPointer | undefined;
  const mentions: ThreadPointer[] = [];
  const quotes: ThreadPointer[] = [];
  const unmarked: ThreadPointer[] = [];

  for (const tag of eTags) {
    try {
      // Skip tags that don't have an ID or have invalid ID
      const id = tag[1];
      if (!id || typeof id !== "string" || !id.trim()) {
        continue;
      }

      // Safe access to optional fields using safeArrayAccess helper
      const relay = safeArrayAccess(tag, 2);
      const marker = safeArrayAccess(tag, 3);
      const pubkey = safeArrayAccess(tag, 4);

      const relayValue =
        typeof relay === "string" && relay.trim() ? relay : undefined;
      const pubkeyValue =
        typeof pubkey === "string" && pubkey.trim() && pubkey !== ""
          ? pubkey
          : undefined;

      if (marker === "root") {
        root = { id, relay: relayValue, pubkey: pubkeyValue };
      } else if (marker === "reply") {
        reply = { id, relay: relayValue, pubkey: pubkeyValue };
      } else if (marker === "mention") {
        quotes.push({ id, relay: relayValue, pubkey: pubkeyValue });
      } else {
        unmarked.push({ id, relay: relayValue, pubkey: pubkeyValue });
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        console.warn(
          `NIP-10: Bounds checking error in thread parsing: ${error.message}`,
        );
      }
      continue; // Skip invalid tags
    }
  }

  // Handle deprecated positional scheme if no marked tags were found
  if (!root && !reply && unmarked.length > 0) {
    try {
      if (unmarked.length === 1) {
        reply = unmarked[0];
      } else {
        root = unmarked[0];
        reply = unmarked[unmarked.length - 1];

        // Safe slice operation for mentions
        if (unmarked.length > 2) {
          mentions.push(...unmarked.slice(1, -1));
        }
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        console.warn(
          `NIP-10: Bounds checking error in positional parsing: ${error.message}`,
        );
      }
    }
  } else {
    mentions.push(...unmarked);
  }

  return { root, reply, mentions, quotes };
}
