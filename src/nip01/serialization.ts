import { NostrEvent } from "../types/nostr";
import { sha256Hex } from "../utils/crypto";

export type EventHashInput = Pick<
  NostrEvent,
  "pubkey" | "created_at" | "kind" | "tags" | "content"
>;

/**
 * Calculate the event hash following NIP-01 serialization.
 */
export function calculateEventHash(event: EventHashInput): string {
  return sha256Hex(
    JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]),
  );
}
