import { hasProtectedTag, inheritProtectedTag, withProtectedTag } from "../../src/nip70";

describe("NIP-70 protected tag helpers", () => {
  test("withProtectedTag adds the protected tag once", () => {
    const tags = withProtectedTag([["p", "pubkey"]]);

    expect(tags).toEqual([["p", "pubkey"], ["-"]]);
    expect(withProtectedTag(tags)).toEqual([["p", "pubkey"], ["-"]]);
  });

  test("inheritProtectedTag copies protection from the parent", () => {
    const parentEvent = {
      id: "id",
      pubkey: "pubkey",
      sig: "sig",
      kind: 1,
      created_at: 1,
      content: "protected",
      tags: [["-"]],
    };

    expect(hasProtectedTag(parentEvent)).toBe(true);
    expect(inheritProtectedTag(parentEvent, [["e", "reply-id"]])).toEqual([
      ["e", "reply-id"],
      ["-"],
    ]);
  });
});
