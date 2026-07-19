import type { NostrEvent, NostrFilter } from "../../types/nostr";
import { safeArrayAccess, validateArrayAccess } from "../security-validator";

/** Return whether a Nostr Event satisfies one Subscription Filter. */
export function matchesFilter(
  event: NostrEvent,
  filter: NostrFilter = {},
): boolean {
  const { authors, ids, kinds, since, until, search, ...rest } = filter;

  const tagFilters: string[][] = Object.entries(rest)
    .filter(([key]) => key.startsWith("#"))
    .map(([key, values]) => [key.slice(1), ...(values as string[])]);

  if (ids !== undefined && !ids.includes(event.id)) {
    return false;
  }
  if (since !== undefined && event.created_at < since) {
    return false;
  }
  if (until !== undefined && event.created_at > until) {
    return false;
  }
  if (authors !== undefined && !authors.includes(event.pubkey)) {
    return false;
  }
  if (kinds !== undefined && !kinds.includes(event.kind)) {
    return false;
  }
  if (search !== undefined && search.length > 0) {
    const query = search.toLowerCase();
    const contentMatch = event.content.toLowerCase().includes(query);
    const tagMatch = event.tags.some((tag) =>
      tag.some((value) => value.toLowerCase().includes(query)),
    );
    if (!contentMatch && !tagMatch) return false;
    return tagFilters.length > 0 ? matchesTags(tagFilters, event.tags) : true;
  }
  return tagFilters.length > 0 ? matchesTags(tagFilters, event.tags) : true;
}

function matchesTags(filters: string[][], tags: string[][]): boolean {
  for (const filter of filters) {
    let filterMatched = false;

    try {
      if (!validateArrayAccess(filter, 0)) {
        filterMatched = true;
        continue;
      }

      const key = safeArrayAccess(filter, 0);
      const terms = filter.slice(1);

      if (terms.length === 0) {
        filterMatched = true;
        continue;
      }

      for (const tag of tags) {
        try {
          if (!validateArrayAccess(tag, 0) || safeArrayAccess(tag, 0) !== key) {
            continue;
          }

          const params = tag.slice(1);
          if (terms.some((term) => params.includes(term))) {
            filterMatched = true;
            break;
          }
        } catch {
          // Malformed tags do not satisfy a filter.
        }
      }
    } catch {
      // Malformed filters do not match.
    }

    if (!filterMatched) return false;
  }

  return true;
}
