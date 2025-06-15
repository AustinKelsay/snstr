import {
  createReplyTags,
  createQuoteTag,
  parseThreadReferences,
} from "../../src/nip10";
import { NostrEvent } from "../../src/types/nostr";

describe("NIP-10 utilities", () => {
  test("createReplyTags should build root and reply tags", () => {
    const tags = createReplyTags(
      { id: "root", relay: "wss://relay" },
      { id: "reply" },
    );
    expect(tags).toEqual([
      ["e", "root", "wss://relay", "root"],
      ["e", "reply", "", "reply"],
    ]);
  });

  test("createQuoteTag should build e tag with mention marker", () => {
    expect(createQuoteTag({ id: "abc" })).toEqual(["e", "abc", "", "mention"]);
  });

  test("parseThreadReferences handles marked tags", () => {
    const event: NostrEvent = {
      id: "1",
      pubkey: "a",
      created_at: 0,
      kind: 1,
      content: "",
      tags: [
        ["e", "root", "", "root", "pub1"],
        ["e", "reply", "", "reply", "pub2"],
        ["e", "quote", "relay", "mention"],
      ],
      sig: "sig",
    };

    const refs = parseThreadReferences(event);
    expect(refs.root?.id).toBe("root");
    expect(refs.reply?.id).toBe("reply");
    expect(refs.quotes[0].id).toBe("quote");
  });

  test("parseThreadReferences handles positional scheme", () => {
    const event: NostrEvent = {
      id: "1",
      pubkey: "a",
      created_at: 0,
      kind: 1,
      content: "",
      tags: [
        ["e", "root"],
        ["e", "mention"],
        ["e", "reply"],
      ],
      sig: "sig",
    };

    const refs = parseThreadReferences(event);
    expect(refs.root?.id).toBe("root");
    expect(refs.reply?.id).toBe("reply");
    expect(refs.mentions.map((m) => m.id)).toEqual(["mention"]);
  });

  test("createReplyTags should build only root tag when no reply", () => {
    expect(createReplyTags({ id: "root" })).toEqual([
      ["e", "root", "", "root"],
    ]);
  });

  test("createReplyTags should include all fields when present", () => {
    const tags = createReplyTags(
      { id: "root", relay: "wss://relay1", pubkey: "pub1" },
      { id: "reply", relay: "wss://relay2", pubkey: "pub2" },
    );
    expect(tags).toEqual([
      ["e", "root", "wss://relay1", "root", "pub1"],
      ["e", "reply", "wss://relay2", "reply", "pub2"],
    ]);
  });

  test("createQuoteTag should include all fields when present", () => {
    expect(createQuoteTag({ id: "abc", relay: "wss://relay", pubkey: "pub" })).toEqual([
      "e", "abc", "wss://relay", "mention", "pub"
    ]);
  });

  test("parseThreadReferences collects mentions with marked tags", () => {
    const event: NostrEvent = {
      id: "1",
      pubkey: "pk",
      created_at: 0,
      kind: 1,
      content: "",
      tags: [
        ["e", "root", "", "root"],
        ["e", "reply", "", "reply"],
        ["e", "mention"],
        ["e", "quote", "wss://relay", "mention", "pub"],
      ],
      sig: "s",
    };
    const refs = parseThreadReferences(event);
    expect(refs.mentions.map((m) => m.id)).toEqual(["mention"]);
    expect(refs.quotes[0]).toEqual({
      id: "quote",
      relay: "wss://relay",
      pubkey: "pub",
    });
  });
});
