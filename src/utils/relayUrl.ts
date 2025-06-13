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

  // Handle hostnames with explicit port (example.com:8080 or [::1]:443)
  const hasPort = /^(?:[^:/]+:\d+|\[[0-9a-fA-F:]+\]:\d+)$/.test(trimmedUrl);
  if (hasPort) {
    return `wss://${trimmedUrl}`;
  }

  // Reject anything that looks like a scheme but is not ws/wss
  const colonIndex = trimmedUrl.indexOf(":");
  if (colonIndex !== -1) {
    const beforeColon = trimmedUrl.substring(0, colonIndex);
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(beforeColon) && !hasPort) {
      throw new Error(
        `Invalid relay URL scheme: "${beforeColon}://". ` +
          `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
          `Got: "${trimmedUrl}"`,
      );
    }
  }

  // Default case – prepend secure WebSocket scheme
  return `wss://${trimmedUrl}`;
}

/**
 * Canonicalises a relay URL by lowercasing scheme & host and removing the root pathname.
 * Path, query and fragment parts keep their case.
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