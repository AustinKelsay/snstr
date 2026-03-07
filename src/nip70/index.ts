import type { NostrEvent } from "../types/nostr";

export const PROTECTED_TAG_NAME = "-";
export const PROTECTED_TAG = [PROTECTED_TAG_NAME] as const;

function cloneTags(tags: string[][]): string[][] {
  return tags.map((tag) => [...tag]);
}

function getTags(input: NostrEvent | string[][]): string[][] {
  return Array.isArray(input) ? input : input.tags;
}

export function hasProtectedTag(input: NostrEvent | string[][]): boolean {
  return getTags(input).some((tag) => tag.length === 1 && tag[0] === "-");
}

export function withProtectedTag(tags: string[][] = []): string[][] {
  const nextTags = cloneTags(tags);

  if (!hasProtectedTag(nextTags)) {
    nextTags.push([...PROTECTED_TAG]);
  }

  return nextTags;
}

export function inheritProtectedTag(
  parent: NostrEvent | string[][],
  tags: string[][] = [],
): string[][] {
  return hasProtectedTag(parent) ? withProtectedTag(tags) : cloneTags(tags);
}
