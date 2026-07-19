import { matchesFilter } from "../../src/utils/ephemeral-relay/filter-match";
import type { NostrEvent } from "../../src/types/nostr";

const event: NostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [["t", "nostr"]],
  content: "A public note",
  sig: "c".repeat(128),
};

describe("ephemeral Relay Subscription Filter matching", () => {
  test("matches identifiers, authors, kinds, and inclusive time bounds", () => {
    expect(
      matchesFilter(event, {
        ids: [event.id],
        authors: [event.pubkey],
        kinds: [1],
        since: event.created_at,
        until: event.created_at,
      }),
    ).toBe(true);

    expect(matchesFilter(event, { ids: ["d".repeat(64)] })).toBe(false);
    expect(matchesFilter(event, { authors: ["e".repeat(64)] })).toBe(false);
    expect(matchesFilter(event, { kinds: [7] })).toBe(false);
    expect(matchesFilter(event, { since: event.created_at + 1 })).toBe(false);
    expect(matchesFilter(event, { until: event.created_at - 1 })).toBe(false);
  });

  test("requires every tag filter and allows any value within each tag", () => {
    const taggedEvent = {
      ...event,
      tags: [
        ["t", "nostr"],
        ["p", "friend"],
      ],
    };

    expect(
      matchesFilter(taggedEvent, {
        "#t": ["bitcoin", "nostr"],
        "#p": ["friend"],
      }),
    ).toBe(true);
    expect(
      matchesFilter(taggedEvent, {
        "#t": ["nostr"],
        "#p": ["stranger"],
      }),
    ).toBe(false);
  });

  test("searches content and tag values case-insensitively", () => {
    expect(matchesFilter(event, { search: "PUBLIC NOTE" })).toBe(true);
    expect(matchesFilter(event, { search: "NOSTR" })).toBe(true);
    expect(matchesFilter(event, { search: "missing" })).toBe(false);
  });
});
