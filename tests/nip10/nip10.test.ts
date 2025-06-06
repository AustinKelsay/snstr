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
      ["e", "root", "wss://relay", "root", ""],
      ["e", "reply", "", "reply", ""],
    ]);
  });

  test("createQuoteTag should build q tag", () => {
    expect(createQuoteTag({ id: "abc" })).toEqual(["q", "abc", "", ""]);
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
        ["q", "quote", "relay"],
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
      ["e", "root", "", "root", ""],
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
        ["q", "quote", "wss://relay", "pub"],
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
