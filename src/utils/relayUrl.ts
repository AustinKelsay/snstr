import { isValidRelayUrl } from "../nip19";

/**
 * Preprocesses a relay URL before normalization and validation.
 * Adds wss:// prefix only to URLs without any scheme.
 * Throws an error for URLs with incompatible schemes.
 */
export function preprocessRelayUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new Error("URL must be a non-empty string");
  }

  let trimmedUrl = url.trim();

  // Handle scheme-relative URLs ("//example.com") by removing the slashes
  // so that the normal fallback of `wss://` works as intended.
  if (trimmedUrl.startsWith("//")) {
    trimmedUrl = trimmedUrl.slice(2);
  }

  if (!trimmedUrl) {
    throw new Error("URL cannot be empty or whitespace only");
  }
  // Detect an existing scheme of the form <scheme>://
  const schemePattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
  const schemeMatch = trimmedUrl.match(schemePattern);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "ws" || scheme === "wss") {
      return trimmedUrl;
    }
    throw new Error(
      `Invalid relay URL scheme: "${scheme}://". ` +
        `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
        `Got: "${trimmedUrl}"`,
    );
  }

  // Check if input already has a scheme and validate it
  if (trimmedUrl.includes('://')) {
    try {
      const originalParsed = new URL(trimmedUrl);
      if (originalParsed.protocol !== 'ws:' && originalParsed.protocol !== 'wss:') {
        throw new Error(
          `Invalid relay URL scheme: "${originalParsed.protocol}//". ` +
            `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
            `Got: "${trimmedUrl}"`,
        );
      }
      return trimmedUrl; // Return original URL with valid scheme
    } catch (urlError) {
      throw new Error(
        `Invalid URL format: "${trimmedUrl}". ` +
          `Unable to parse the provided URL.`
      );
    }
  }

  // No scheme in input, so try to construct a valid URL with wss:// prefix
  // Handle IPv6 addresses by adding brackets if needed
  let hostPart = trimmedUrl;
  
  // Check if this looks like an IPv6 address without brackets
  if (hostPart.includes(':') && !hostPart.startsWith('[') && !hostPart.includes('/')) {
    // Try to parse as IPv6 - if it contains multiple colons and no slash, it's likely IPv6
    const colonCount = (hostPart.match(/:/g) || []).length;
    if (colonCount > 1) {
      // Looks like IPv6, add brackets
      hostPart = `[${hostPart}]`;
    }
  }

  const testUrl = `wss://${hostPart}`;
  
  try {
    new URL(testUrl);
    return testUrl;
  } catch (urlError) {
    throw new Error(
      `Invalid URL format: "${trimmedUrl}". ` +
        `Unable to construct a valid WebSocket URL.`
    );
  }
}

/**
 * Canonicalises a relay URL by lowercasing scheme & host and removing the root pathname.
 * Path, query and fragment parts keep their case.
 * Validates the normalized URL for security and throws an error if invalid.
 */
export function normalizeRelayUrl(url: string): string {
  const preprocessed = preprocessRelayUrl(url);
  const parsed = new URL(preprocessed);

  // For the root path ("/"), most libraries omit the trailing slash in their
  // canonical representation (e.g. `wss://example.com`).  Only keep the
  // pathname when it is not exactly "/".

  const includePathname = parsed.pathname && parsed.pathname !== "/";

  let normalized = `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;

  if (includePathname) {
    normalized += parsed.pathname;
  }

  if (parsed.search) {
    normalized += parsed.search;
  }
  if (parsed.hash) {
    normalized += parsed.hash;
  }

  // Validate the normalized URL for security before returning
  if (!isValidRelayUrl(normalized)) {
    throw new Error(
      `Normalized URL failed security validation: "${normalized}". ` +
        `The URL may contain invalid characters or unsafe patterns.`
    );
  }

  return normalized;
}

/**
 * Combines normalisation and validation. Returns undefined when the URL is invalid.
 */
export function validateAndNormalizeRelayUrl(url: string): string | undefined {
  try {
    const normalized = normalizeRelayUrl(url);
    return isValidRelayUrl(normalized) ? normalized : undefined;
  } catch {
    return undefined;
  }
} 