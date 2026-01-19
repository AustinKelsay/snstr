/**
 * NIP-46 Auth URL validation utilities
 */

import { Logger } from "./logger";

/**
 * Sanitize URL for safe logging by removing sensitive parts
 * @param url - The URL to sanitize
 * @returns Sanitized URL string with only hostname and protocol
 */
function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    // Only return protocol and hostname, no path/query/hash that may contain secrets
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    // If URL parsing fails, return a generic placeholder
    return "<invalid-url>";
  }
}

/**
 * Options for auth URL validation
 */
export interface AuthUrlValidationOptions {
  /**
   * List of allowed domains for auth URLs
   */
  authDomainWhitelist?: string[];
  /**
   * Logger instance for debugging
   */
  logger?: Logger;
}

/**
 * Validate if an auth URL is safe to open
 * @param url - The URL to validate
 * @param options - Validation options including domain whitelist and logger
 * @returns true if the URL is valid and safe, false otherwise
 */
export function isValidAuthUrl(
  url: string,
  options: AuthUrlValidationOptions = {},
): boolean {
  const logger = options.logger || new Logger({ prefix: "auth-validator" });

  try {
    const parsed = new URL(url);

    // Only allow HTTPS URLs for security
    if (parsed.protocol !== "https:") {
      logger.warn("Auth URL must use HTTPS", {
        hostname: parsed.hostname,
        protocol: parsed.protocol,
      });
      return false;
    }

    // Basic hostname validation
    if (!parsed.hostname || parsed.hostname.length < 3) {
      logger.warn("Invalid hostname in auth URL", {
        hostname: parsed.hostname || "<empty>",
      });
      return false;
    }

    // Prevent potential XSS in URL
    if (
      url.includes("<") ||
      url.includes(">") ||
      url.includes('"') ||
      url.includes("'")
    ) {
      logger.warn("Auth URL contains dangerous characters", {
        hostname: parsed.hostname,
      });
      return false;
    }

    // Check against domain whitelist if configured
    if (options.authDomainWhitelist && options.authDomainWhitelist.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowed = options.authDomainWhitelist.some((allowedDomain) => {
        const normalizedDomain = allowedDomain.toLowerCase();
        // Support exact match or subdomain matching
        // SECURITY: Ensure proper subdomain matching to prevent bypass attacks
        // For subdomain matching, we need to ensure there's a dot before the domain
        // to prevent "badexample.com" from matching "example.com"
        if (hostname === normalizedDomain) {
          return true; // Exact match
        }
        // Check for proper subdomain (must have dot separator)
        const subdomainPattern = "." + normalizedDomain;
        return (
          hostname.endsWith(subdomainPattern) &&
          hostname.length > subdomainPattern.length
        );
      });

      if (!isAllowed) {
        logger.warn("Auth URL hostname not in domain whitelist", {
          hostname,
          whitelist: options.authDomainWhitelist,
        });
        return false;
      }

      logger.debug("Auth URL hostname validated against whitelist", {
        hostname,
        whitelist: options.authDomainWhitelist,
      });
    }

    return true;
  } catch (error) {
    logger.error("Failed to parse auth URL", {
      sanitizedUrl: sanitizeUrlForLogging(url),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
