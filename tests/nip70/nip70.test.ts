import { hasProtectedTag, inheritProtectedTag, withProtectedTag } from "../../src/nip70";

describe("NIP-70 protected tag helpers", () => {
  test("withProtectedTag adds the protected tag once without mutating the input", () => {
    const originalTags = [["p", "pubkey"]];
    const tags = withProtectedTag(originalTags);

    expect(tags).toEqual([["p", "pubkey"], ["-"]]);
    expect(withProtectedTag(tags)).toEqual([["p", "pubkey"], ["-"]]);
    expect(tags).not.toBe(originalTags);
    expect(originalTags).toEqual([["p", "pubkey"]]);
  });

  test("inheritProtectedTag copies protection from the parent without mutating inputs", () => {
    const parentEvent = {
      id: "id",
      pubkey: "pubkey",
      sig: "sig",
      kind: 1,
      created_at: 1,
      content: "protected",
      tags: [["-"]],
    };
    const childTags = [["e", "reply-id"]];

    expect(hasProtectedTag(parentEvent)).toBe(true);
    expect(inheritProtectedTag(parentEvent, childTags)).toEqual([
      ["e", "reply-id"],
      ["-"],
    ]);
    expect(parentEvent.tags).toEqual([["-"]]);
    expect(childTags).toEqual([["e", "reply-id"]]);
  });

  test("inheritProtectedTag is a no-op for unprotected parents", () => {
    const parentEvent = {
      id: "id",
      pubkey: "pubkey",
      sig: "sig",
      kind: 1,
      created_at: 1,
      content: "public",
      tags: [["p", "pubkey"]],
    };
    const childTags = [["e", "reply-id"]];

    expect(hasProtectedTag(parentEvent)).toBe(false);
    expect(inheritProtectedTag(parentEvent, childTags)).toEqual([["e", "reply-id"]]);
    expect(parentEvent.tags).toEqual([["p", "pubkey"]]);
    expect(childTags).toEqual([["e", "reply-id"]]);
  });
});
