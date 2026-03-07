import {
  REPORT_KIND,
  createReportEvent,
  getReportTargets,
  parseReportEvent,
} from "../../src/nip56";

describe("NIP-56 reporting helpers", () => {
  test("createReportEvent round-trips report targets without leaking event context p-tags", () => {
    const targets = [
      {
        type: "e" as const,
        value: "event-id",
        reportType: "spam" as const,
        pubkey: "author-pubkey",
      },
      {
        type: "p" as const,
        value: "profile-pubkey",
        reportType: "impersonation" as const,
      },
    ];
    const template = createReportEvent(
      targets,
      "report body",
    );
    const event = {
      id: "id",
      pubkey: "pubkey",
      sig: "sig",
      kind: template.kind,
      content: template.content,
      created_at: 1,
      tags: template.tags ?? [],
    };

    expect(template.kind).toBe(REPORT_KIND);
    expect(template.tags).toEqual(
      expect.arrayContaining([
        ["e", "event-id", "spam"],
        ["p", "author-pubkey"],
        ["p", "profile-pubkey", "impersonation"],
      ]),
    );
    expect(getReportTargets(event)).toEqual([
      { type: "e", value: "event-id", reportType: "spam" },
      { type: "p", value: "profile-pubkey", reportType: "impersonation" },
    ]);
    expect(parseReportEvent(event)).toEqual({
      content: "report body",
      targets: [
        { type: "e", value: "event-id", reportType: "spam" },
        { type: "p", value: "profile-pubkey", reportType: "impersonation" },
      ],
      serverUrls: [],
      labelTags: [],
    });
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
