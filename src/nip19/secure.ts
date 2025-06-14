/**
 * NIP-19 Security Utilities
 *
 * This module provides security enhancements for NIP-19 decoded entities
 * to prevent attacks like XSS through invalid relay URLs.
 */

import { ProfileData, EventData, AddressData, RelayUrl } from "./types";

/**
 * Validates if a hostname is valid according to RFC standards
 * - Must not be empty
 * - Must not exceed 255 characters total
 * - Each label must be 1-63 characters
 * - Labels must not start or end with hyphens
 * - Labels must contain only alphanumeric characters and hyphens
 * - Must not have consecutive dots
 * - Must not start or end with dots
 * - Must have at least one label (no bare TLD restriction for flexibility)
 */
function isValidHostname(hostname: string): boolean {
  // Basic checks
  if (!hostname || typeof hostname !== "string") {
    return false;
  }

  // Check total length (RFC 1035: 255 characters max)
  if (hostname.length > 255) {
    return false;
  }

  // Check for leading or trailing dots
  if (hostname.startsWith(".") || hostname.endsWith(".")) {
    return false;
  }

  // Check for consecutive dots
  if (hostname.includes("..")) {
    return false;
  }

  // Split into labels and validate each
  const labels = hostname.split(".");
  
  // Must have at least one label
  if (labels.length === 0) {
    return false;
  }

  for (const label of labels) {
    // Each label must be 1-63 characters (RFC 1035)
    if (label.length === 0 || label.length > 63) {
      return false;
    }

    // Labels must not start or end with hyphens (RFC 1035)
    if (label.startsWith("-") || label.endsWith("-")) {
      return false;
    }

    // Labels must contain only alphanumeric characters and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates if a relay URL is safe to use
 * - Must start with wss:// or ws://
 * - Must be a valid URL
 * - No credentials (username/password) in URL
 * - No URL confusion or redirection tricks
 * - Valid port numbers (1-65535, not 0)
 * - No null bytes or dangerous characters in hostname
 * - No null bytes in query parameters
 */
export function isValidRelayUrl(url: RelayUrl): boolean {
  try {
    // Basic protocol check
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      return false;
    }

    // Check for null bytes and other control characters in the entire URL
    // Use a function to check each character code instead of regex with control chars
    if (
      [...url].some((char) => {
        const code = char.charCodeAt(0);
        return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
      })
    ) {
      return false;
    }

    // Check for encoded null bytes in the URL
    if (
      url.includes("%00") ||
      url.toLowerCase().includes("%0a") ||
      url.toLowerCase().includes("%0d")
    ) {
      return false;
    }

    // Check for URL confusion attacks (@ symbol in host part)
    if (url.includes("@")) {
      return false;
    }

    // Check for backslashes that might be used for escaping
    if (url.includes("\\")) {
      return false;
    }

    // Check for multiple slashes (protocol:///)
    if (/^ws+:\/\/\//.test(url)) {
      return false;
    }

    // Normalize the URL to catch sneaky tricks
    const normalized = url.toLowerCase();

    // Check for exactly the right protocol pattern
    if (!normalized.match(new RegExp("^wss://[^/]|^ws://[^/]"))) {
      return false;
    }

    const parsedUrl = new URL(url);

    // Check for credentials in the URL (username or password)
    if (parsedUrl.username || parsedUrl.password) {
      return false;
    }

    // Validate port number if specified
    if (parsedUrl.port) {
      const portNum = parseInt(parsedUrl.port, 10);
      // Port must be between 1 and 65535
      if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        return false;
      }
    }

    // Ensure the host doesn't contain any suspicious characters
    // Handle IPv6 addresses (bracketed) and regular hostnames separately
    if (parsedUrl.hostname.startsWith("[") && parsedUrl.hostname.endsWith("]")) {
      // IPv6 literal - brackets are required and content can contain colons
      // We trust the URL parser's validation for IPv6 format
      const ipv6Content = parsedUrl.hostname.slice(1, -1);
      if (ipv6Content.length === 0) {
        return false; // Empty brackets not allowed
      }
    } else {
      // Regular hostname - validate with strict hostname rules
      if (!isValidHostname(parsedUrl.hostname)) {
        return false;
      }
    }

    // Additional sanity: disallow empty hostname (should never happen with URL parser)
    if (parsedUrl.hostname.length === 0) {
      return false;
    }

    // Check search params for encoded null bytes and other dangerous characters
    if (
      parsedUrl.search &&
      (parsedUrl.search.includes("%00") ||
        parsedUrl.search.toLowerCase().includes("%0a") ||
        parsedUrl.search.toLowerCase().includes("%0d"))
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Filter invalid relay URLs from a decoded profile
 * Use this after decoding with decodeProfile() for enhanced security
 */
export function filterProfile(profile: ProfileData): ProfileData {
  if (!profile.relays || profile.relays.length === 0) {
    return profile;
  }

  return {
    ...profile,
    relays: profile.relays.filter(isValidRelayUrl),
  };
}

/**
 * Filter invalid relay URLs from a decoded event
 * Use this after decoding with decodeEvent() for enhanced security
 */
export function filterEvent(event: EventData): EventData {
  if (!event.relays || event.relays.length === 0) {
    return event;
  }

  return {
    ...event,
    relays: event.relays.filter(isValidRelayUrl),
  };
}

/**
 * Filter invalid relay URLs from a decoded address
 * Use this after decoding with decodeAddress() for enhanced security
 */
export function filterAddress(address: AddressData): AddressData {
  if (!address.relays || address.relays.length === 0) {
    return address;
  }

  return {
    ...address,
    relays: address.relays.filter(isValidRelayUrl),
  };
}

/**
 * Safely decode any NIP-19 entity that contains relay URLs
 * Returns the filtered result with only valid relay URLs
 *
 * @param entity The decoded entity (from decodeProfile, decodeEvent, decodeAddress)
 * @returns A filtered entity with only valid relay URLs
 */
export function filterEntity<T extends ProfileData | EventData | AddressData>(
  entity: T,
): T {
  if ("pubkey" in entity && "relays" in entity) {
    return filterProfile(entity as ProfileData) as T;
  } else if ("id" in entity && "relays" in entity) {
    return filterEvent(entity as EventData) as T;
  } else if ("identifier" in entity && "kind" in entity && "relays" in entity) {
    return filterAddress(entity as AddressData) as T;
  }

  // If we can't determine the type, return as is
  return entity;
}
