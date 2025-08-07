/**
 * NIP-50: Search Capability
 *
 * Provides helper utilities for creating search filters as defined in
 * https://github.com/nostr-protocol/nips/blob/master/50.md
 */

import { Filter } from "../types/nostr";

/**
 * Create a NIP-50 search filter.
 *
 * @param query - Human readable search query string
 * @param other - Optional additional filter fields
 * @returns Filter including the search term
 */
export function createSearchFilter(
  query: string,
  other: Partial<Filter> = {},
): Filter {
  if (!query || typeof query !== "string" || query.trim() === "") {
    throw new Error("Query must be a non-empty string");
  }
  return { ...other, search: query } as Filter;
}
