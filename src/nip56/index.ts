import type { EventTemplate, NostrEvent } from "../types/nostr";

export const REPORT_KIND = 1984;

export const REPORT_TYPES = [
  "nudity",
  "malware",
  "profanity",
  "illegal",
  "spam",
  "impersonation",
  "other",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportTargetTag = "p" | "e" | "x";

export type ReportTargetInput =
  | {
      type: "p";
      value: string;
      reportType: ReportType;
    }
  | {
      type: "e";
      value: string;
      reportType: ReportType;
      pubkey: string;
    }
  | {
      type: "x";
      value: string;
      reportType: ReportType;
      eventId?: string;
      server?: string;
    };

export interface ParsedReportTarget {
  type: ReportTargetTag;
  value: string;
  reportType?: ReportType;
}

export interface ParsedReportEvent {
  content: string;
  targets: ParsedReportTarget[];
  serverUrls: string[];
  labelTags: string[][];
}

export function createReportEvent(
  targets: ReportTargetInput[],
  content = "",
): EventTemplate {
  if (targets.length === 0) {
    throw new Error("At least one report target is required");
  }

  const tags: string[][] = [];

  for (const target of targets) {
    tags.push([target.type, target.value, target.reportType]);

    if (target.type === "e") {
      tags.push(["p", target.pubkey]);
    }

    if (target.type === "x" && target.eventId) {
      tags.push(["e", target.eventId, target.reportType]);
    }

    if (target.type === "x" && target.server) {
      tags.push(["server", target.server]);
    }
  }

  return {
    kind: REPORT_KIND,
    content,
    tags,
  };
}

export function getReportTargets(event: NostrEvent): ParsedReportTarget[] {
  if (event.kind !== REPORT_KIND) {
    throw new Error("Invalid report event kind");
  }

  return event.tags
    .filter(
      (tag) =>
        Array.isArray(tag) &&
        tag.length >= 2 &&
        (tag[0] === "p" || tag[0] === "e" || tag[0] === "x") &&
        typeof tag[1] === "string",
    )
    .map((tag) => ({
      type: tag[0] as ReportTargetTag,
      value: tag[1],
      reportType: tag[2] as ReportType | undefined,
    }));
}

export function parseReportEvent(event: NostrEvent): ParsedReportEvent {
  return {
    content: event.content,
    targets: getReportTargets(event),
    serverUrls: event.tags
      .filter((tag) => Array.isArray(tag) && tag[0] === "server" && !!tag[1])
      .map((tag) => tag[1]),
    labelTags: event.tags.filter(
      (tag) => Array.isArray(tag) && (tag[0] === "l" || tag[0] === "L"),
    ),
  };
}
