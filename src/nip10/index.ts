/**
 * NIP-10: Text Notes and Threads
 *
 * Utilities for working with thread references as defined in
 * https://github.com/nostr-protocol/nips/blob/master/10.md
 */

import { NostrEvent } from "../types/nostr";

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
  /** Quoted events using q tags */
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

  // Build root tag conditionally
  const rootTag = ["e", root.id];
  if (root.relay) {
    rootTag.push(root.relay);
  }
  rootTag.push("root");
  if (root.pubkey) {
    rootTag.push(root.pubkey);
  }
  tags.push(rootTag);

  if (reply) {
    // Build reply tag conditionally
    const replyTag = ["e", reply.id];
    if (reply.relay) {
      replyTag.push(reply.relay);
    }
    replyTag.push("reply");
    if (reply.pubkey) {
      replyTag.push(reply.pubkey);
    }
    tags.push(replyTag);
  }

  return tags;
}

/** Create a "q" tag for quoting an event */
export function createQuoteTag(pointer: ThreadPointer): string[] {
  const tag = ["q", pointer.id];
  if (pointer.relay) {
    tag.push(pointer.relay);
  }
  if (pointer.pubkey) {
    tag.push(pointer.pubkey);
  }
  return tag;
}

/**
 * Parse thread references (e and q tags) from an event. Handles both
 * marked and deprecated positional e tags.
 */
export function parseThreadReferences(event: NostrEvent): ThreadReferences {
  const eTags = event.tags.filter((t) => t[0] === "e");
  const qTags = event.tags.filter((t) => t[0] === "q");

  let root: ThreadPointer | undefined;
  let reply: ThreadPointer | undefined;
  const mentions: ThreadPointer[] = [];
  const unmarked: ThreadPointer[] = [];

  for (const tag of eTags) {
    const [_, id, relay, marker, pubkey] = tag;
    const relayValue = relay || undefined;
    const pubkeyValue = pubkey === "" ? undefined : pubkey;
    if (marker === "root") {
      root = { id, relay: relayValue, pubkey: pubkeyValue };
    } else if (marker === "reply") {
      reply = { id, relay: relayValue, pubkey: pubkeyValue };
    } else {
      unmarked.push({ id, relay: relayValue, pubkey: pubkeyValue });
    }
  }

  // Handle deprecated positional scheme if no marked tags were found
  if (!root && !reply && unmarked.length > 0) {
    if (unmarked.length === 1) {
      reply = unmarked[0];
    } else {
      root = unmarked[0];
      reply = unmarked[unmarked.length - 1];
      mentions.push(...unmarked.slice(1, -1));
    }
  } else {
    mentions.push(...unmarked);
  }

  const quotes: ThreadPointer[] = qTags.map((tag) => ({
    id: tag[1],
    relay: tag[2] || undefined,
    pubkey: tag[3] === "" ? undefined : tag[3],
  }));

  return { root, reply, mentions, quotes };
}

export default {
  createReplyTags,
  createQuoteTag,
  parseThreadReferences,
};
