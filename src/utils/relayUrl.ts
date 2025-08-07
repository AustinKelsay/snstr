import { isValidRelayUrl } from "../nip19";

/**
 * Custom error class for relay URL validation errors
 */
export class RelayUrlValidationError extends Error {
  /** The type of validation error */
  readonly errorType: "scheme" | "format" | "security" | "construction";
  /** The invalid URL that caused the error */
  readonly invalidUrl?: string;

  constructor(
    message: string,
    errorType: "scheme" | "format" | "security" | "construction",
    invalidUrl?: string,
  ) {
    super(message);
    this.name = "RelayUrlValidationError";
    this.errorType = errorType;
    this.invalidUrl = invalidUrl;
  }
}

/**
 * Preprocesses a relay URL before normalization and validation.
 * Adds wss:// prefix only to URLs without any scheme.
 * Throws an error for URLs with incompatible schemes.
 */
export function preprocessRelayUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new RelayUrlValidationError(
      "URL must be a non-empty string",
      "format",
    );
  }

  let trimmedUrl = url.trim();

  // Handle scheme-relative URLs ("//example.com") by removing the slashes
  // so that the normal fallback of `wss://` works as intended.
  if (trimmedUrl.startsWith("//")) {
    trimmedUrl = trimmedUrl.slice(2);
  }

  if (!trimmedUrl) {
    throw new RelayUrlValidationError(
      "URL cannot be empty or whitespace only",
      "format",
    );
  }
  // Detect an existing scheme of the form <scheme>://
  const schemePattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
  const schemeMatch = trimmedUrl.match(schemePattern);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "ws" || scheme === "wss") {
      return trimmedUrl;
    }
    throw new RelayUrlValidationError(
      `Invalid relay URL scheme: "${scheme}://". ` +
        `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
        `Got: "${trimmedUrl}"`,
      "scheme",
      trimmedUrl,
    );
  }

  // Check if input already has a scheme and validate it
  if (trimmedUrl.includes("://")) {
    try {
      const originalParsed = new URL(trimmedUrl);
      if (
        originalParsed.protocol !== "ws:" &&
        originalParsed.protocol !== "wss:"
      ) {
        throw new RelayUrlValidationError(
          `Invalid relay URL scheme: "${originalParsed.protocol}//". ` +
            `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
            `Got: "${trimmedUrl}"`,
          "scheme",
          trimmedUrl,
        );
      }
      return trimmedUrl; // Return original URL with valid scheme
    } catch (urlError) {
      throw new RelayUrlValidationError(
        `Invalid URL format: "${trimmedUrl}". ` +
          `Unable to parse the provided URL.`,
        "format",
        trimmedUrl,
      );
    }
  }

  // No scheme in input, so try to construct a valid URL with wss:// prefix
  // First split the input into host and path/query/fragment parts
  const firstSlashIndex = trimmedUrl.indexOf("/");
  const hostPortPart =
    firstSlashIndex === -1
      ? trimmedUrl
      : trimmedUrl.substring(0, firstSlashIndex);
  const pathQueryFragmentPart =
    firstSlashIndex === -1 ? "" : trimmedUrl.substring(firstSlashIndex);

  // Handle IPv6 addresses by properly separating port and applying brackets correctly
  let hostPart = hostPortPart;
  let portPart = "";

  // Check if this looks like an IPv6 address without brackets
  if (hostPart.includes(":") && !hostPart.startsWith("[")) {
    // For IPv6 addresses with ports, we need to separate the port first
    // A port is typically the last segment after the final colon that's all digits
    const lastColonIndex = hostPart.lastIndexOf(":");
    if (lastColonIndex !== -1) {
      const potentialPort = hostPart.substring(lastColonIndex + 1);
      const potentialHost = hostPart.substring(0, lastColonIndex);

      // Check if the part after the last colon looks like a port (all digits, 1-5 chars)
      if (/^\d{1,5}$/.test(potentialPort)) {
        const portNumber = parseInt(potentialPort, 10);

        // Valid port range: 1-65535
        if (portNumber >= 1 && portNumber <= 65535) {
          // Now check if the remaining part (without the potential port) looks like IPv6
          // IPv6 addresses must have at least 1 colon or contain "::" for compression
          const hostColonCount = (potentialHost.match(/:/g) || []).length;
          const hasDoubleColon = potentialHost.includes("::");

          // More precise IPv6 detection for the host part
          // Only separate port if it's actually IPv6 (has colons or :: notation)
          const isLikelyIPv6 = hostColonCount >= 1 || hasDoubleColon;

          if (isLikelyIPv6) {
            // This appears to be IPv6 with a port, separate them
            hostPart = potentialHost;
            portPart = `:${potentialPort}`;
          }
        }
      }
    }

    // Now check if the remaining host part looks like IPv6 and needs brackets
    const colonCount = (hostPart.match(/:/g) || []).length;
    const hasDoubleColon = hostPart.includes("::");

    // IPv6 addresses have multiple colons or contain "::" for compression
    // Only add brackets if it's clearly IPv6 (multiple colons or double colon notation)
    if (colonCount >= 2 || hasDoubleColon) {
      // Looks like IPv6, add brackets to the host part only
      hostPart = `[${hostPart}]`;
    }
  }

  // Reconstruct the full URL
  const fullHost = hostPart + portPart + pathQueryFragmentPart;
  const testUrl = `wss://${fullHost}`;

  try {
    new URL(testUrl);
    return testUrl;
  } catch (urlError) {
    throw new RelayUrlValidationError(
      `Invalid URL format: "${trimmedUrl}". ` +
        `Unable to construct a valid WebSocket URL.`,
      "construction",
      trimmedUrl,
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
    throw new RelayUrlValidationError(
      `Normalized URL failed security validation: "${normalized}". ` +
        `The URL may contain invalid characters or unsafe patterns.`,
      "security",
      normalized,
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
