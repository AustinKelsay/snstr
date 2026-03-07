import {
  REPORT_KIND,
  createReportEvent,
  getReportTargets,
  parseReportEvent,
} from "../../src/nip56";
import { hasProtectedTag, inheritProtectedTag, withProtectedTag } from "../../src/nip70";

describe("NIP-56 reporting helpers", () => {
  test("createReportEvent builds profile and event report tags", () => {
    const template = createReportEvent(
      [
        {
          type: "e",
          value: "event-id",
          reportType: "spam",
          pubkey: "author-pubkey",
        },
        {
          type: "p",
          value: "profile-pubkey",
          reportType: "impersonation",
        },
      ],
      "report body",
    );

    expect(template.kind).toBe(REPORT_KIND);
    expect(template.tags).toEqual(
      expect.arrayContaining([
        ["e", "event-id", "spam"],
        ["p", "author-pubkey"],
        ["p", "profile-pubkey", "impersonation"],
      ]),
    );
  });

  test("parseReportEvent extracts targets and server tags", () => {
    const event = {
      id: "id",
      pubkey: "pubkey",
      sig: "sig",
      kind: REPORT_KIND,
      created_at: 1,
      content: "malware report",
      tags: [
        ["x", "blob-hash", "malware"],
        ["e", "containing-event", "malware"],
        ["server", "https://cdn.example.com/file"],
        ["L", "social.nos.ontology"],
      ],
    };

    expect(getReportTargets(event)).toEqual([
      { type: "x", value: "blob-hash", reportType: "malware" },
      { type: "e", value: "containing-event", reportType: "malware" },
    ]);

    expect(parseReportEvent(event)).toEqual({
      content: "malware report",
      targets: [
        { type: "x", value: "blob-hash", reportType: "malware" },
        { type: "e", value: "containing-event", reportType: "malware" },
      ],
      serverUrls: ["https://cdn.example.com/file"],
      labelTags: [["L", "social.nos.ontology"]],
    });
  });
});

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
