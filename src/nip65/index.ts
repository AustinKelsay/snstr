import { NostrEvent } from "../types/nostr";
import { isValidRelayUrl } from "../nip19/secure";
import { getUnixTime } from "../utils/time";

/** Relay list entry describing read/write preferences */
export interface RelayListEntry {
  /** Relay URL */
  url: string;
  /** Whether the user reads from this relay */
  read: boolean;
  /** Whether the user writes to this relay */
  write: boolean;
}

/** Kind constant for NIP-65 relay list metadata */
export const RELAY_LIST_KIND = 10002;

export interface RelayListEvent extends NostrEvent {
  kind: typeof RELAY_LIST_KIND;
}

/**
 * Create an unsigned relay list event (kind 10002) according to NIP-65.
 *
 * @param relays Array of relay list entries
 * @param content Optional content field (usually empty)
 */
export function createRelayListEvent(
  relays: RelayListEntry[],
  content = "",
): Omit<RelayListEvent, "id" | "sig" | "pubkey"> {
  const tags: string[][] = [];

  for (const r of relays) {
    // skip entries with missing or invalid URL
    if (!r.url || !isValidRelayUrl(r.url)) {
      if (!r.url) {
        console.warn("Skipping relay entry with missing URL", r);
      } else {
        console.warn(`Skipping relay entry with invalid URL: ${r.url}`, r);
      }
      continue;
    }
    let marker: string | undefined;
    const read = r.read ?? true; // default to true if undefined
    const write = r.write ?? true; // default to true if undefined

    if (read && !write) marker = "read";
    else if (write && !read) marker = "write";

    if (marker) tags.push(["r", r.url, marker]);
    else if (read || write) tags.push(["r", r.url]);
  }

  return {
    kind: RELAY_LIST_KIND,
    tags,
    content,
    created_at: getUnixTime(),
  };
}

/**
 * Parse relay list entries from a NIP-65 event.
 */
export function parseRelayList(event: RelayListEvent): RelayListEntry[] {
  if (event.kind !== RELAY_LIST_KIND) {
    throw new Error("Invalid relay list event kind");
  }
  const result: RelayListEntry[] = [];

  for (const tag of event.tags) {
    // Validate tag structure and content in a single condition
    if (
      Array.isArray(tag) &&
      tag.length >= 2 &&
      tag[0] === "r" &&
      typeof tag[1] === "string" &&
      tag[1].trim()
    ) {
      const url = tag[1].trim();
      const marker =
        tag.length > 2 && typeof tag[2] === "string"
          ? tag[2].trim().toLowerCase()
          : undefined;

      // Default to both read and write if no marker specified
      let read = true;
      let write = true;

      if (marker === "read") {
        read = true;
        write = false;
      } else if (marker === "write") {
        read = false;
        write = true;
      }
      // If marker exists but isn't "read" or "write", keep defaults (both true)

      result.push({ url, read, write });
    }
  }

  return result;
}

/** Get relay URLs marked for writing */
export function getWriteRelays(
  input: RelayListEntry[] | RelayListEvent,
): string[] {
  const entries = Array.isArray(input) ? input : parseRelayList(input);
  return entries.filter((e) => e.write).map((e) => e.url);
}

/** Get relay URLs marked for reading */
export function getReadRelays(
  input: RelayListEntry[] | RelayListEvent,
): string[] {
  const entries = Array.isArray(input) ? input : parseRelayList(input);
  return entries.filter((e) => e.read).map((e) => e.url);
}
