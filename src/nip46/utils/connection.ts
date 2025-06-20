export interface BuildConnectionStringOptions {
  pubkey: string;
  relays?: string[];
  secret?: string;
}

/**
 * Build a bunker connection string from parameters.
 */
export function buildConnectionString(options: BuildConnectionStringOptions): string {
  const params = new URLSearchParams();
  options.relays?.forEach((relay) => params.append("relay", relay));
  if (options.secret) {
    params.append("secret", options.secret);
  }
  const queryString = params.toString();
  return `bunker://${options.pubkey}${queryString ? `?${queryString}` : ''}`;
}

import { NIP46ConnectionError, NIP46SecurityError } from "../types";
import type { NIP46ConnectionInfo, NIP46Metadata } from "../types";
import { NIP46Validator } from "./validator";

/**
 * Enhanced security patterns to detect potential injection attacks
 */
const SECURITY_PATTERNS = {
  // Script injection patterns
  SCRIPT_TAGS: /<script[^>]*>/i,
  JAVASCRIPT_PROTOCOL: /javascript:/i,
  DATA_URLS: /data:/i,
  VBSCRIPT: /vbscript:/i,
  EVENT_HANDLERS: /on\w+\s*=/i,
  CSS_EXPRESSIONS: /expression\s*\(/i,
  // Basic XSS patterns
  BASIC_XSS: /[<>"']/,
  // Protocol confusion
  PROTOCOL_CONFUSION: /https?:\/\/.*:\/\//i
};

/**
 * Validate connection string for security threats
 */
function validateConnectionSecurity(str: string): void {
  // Check each security pattern
  for (const [name, pattern] of Object.entries(SECURITY_PATTERNS)) {
    if (pattern.test(str)) {
      throw new NIP46SecurityError(`Connection string contains potentially dangerous pattern: ${name.toLowerCase()}`);
    }
  }
  
  // Additional validation for URL structure
  const urlParts = str.split('?');
  if (urlParts.length > 2) {
    throw new NIP46SecurityError("Connection string has malformed query parameters");
  }
}

/**
 * Parse a bunker or nostrconnect connection string with enhanced security validation.
 */
export function parseConnectionString(str: string): NIP46ConnectionInfo {
  // Basic format validation
  if (!str || typeof str !== 'string') {
    throw new NIP46ConnectionError("Connection string must be a non-empty string");
  }

  // Prevent potential DoS attacks with extremely long strings
  if (str.length > 8192) { // 8KB limit
    throw new NIP46SecurityError("Connection string too long");
  }

  // Validate protocol
  if (!str.startsWith("bunker://") && !str.startsWith("nostrconnect://")) {
    throw new NIP46ConnectionError(
      "Invalid connection string format. Must start with bunker:// or nostrconnect://",
    );
  }

  // Enhanced security validation
  validateConnectionSecurity(str);

  // Determine connection type and extract pubkey first before URL parsing
  const type = str.startsWith("bunker://") ? "bunker" : "nostrconnect";
  const protocolPrefix = type === "bunker" ? "bunker://" : "nostrconnect://";
  const afterProtocol = str.slice(protocolPrefix.length);
  
  // Extract pubkey from original string to preserve case for validation
  // Match pattern: protocol://pubkey?params or protocol://pubkey#fragment or protocol://pubkey/path or protocol://pubkey
  // Find the earliest occurrence of '/', '?' (query), or '#' (fragment) to properly delimit the pubkey
  const pathStart = afterProtocol.indexOf("/");
  const queryStart = afterProtocol.indexOf("?");
  const fragmentStart = afterProtocol.indexOf("#");
  
  // Find the earliest delimiter (path, query, or fragment), or use the entire string if none exist
  const delimiters = [pathStart, queryStart, fragmentStart].filter(pos => pos !== -1);
  const delimiterStart = delimiters.length > 0 ? Math.min(...delimiters) : -1;
  
  const pubkey = delimiterStart === -1 ? afterProtocol : afterProtocol.slice(0, delimiterStart);

  // Validate pubkey using secure validator
  if (!NIP46Validator.validatePubkey(pubkey)) {
    throw new NIP46ConnectionError(
      "Invalid signer public key in connection string",
    );
  }

  try {
    const url = new URL(str);

         // Validate and filter relay URLs securely
     const allRelays = url.searchParams.getAll("relay");
     const relays = allRelays.filter(relay => {
       // Use enhanced relay validation
       return NIP46Validator.validateRelayUrl(relay);
     });

    // Validate secret token if present
    const secret = url.searchParams.get("secret") || undefined;
    if (secret && (secret.length < 8 || secret.length > 128)) {
      throw new NIP46SecurityError("Secret token must be between 8 and 128 characters");
    }

    // Validate and parse permissions
    const permissionsParam = url.searchParams.get("perms");
    let permissions: string[] | undefined;
    if (permissionsParam) {
      permissions = permissionsParam.split(",").map(p => p.trim()).filter(p => {
        return NIP46Validator.validatePermission(p);
      });
    }

    // Sanitize metadata fields
    const metadata: NIP46Metadata = {};
    const name = url.searchParams.get("name");
    const metadataUrl = url.searchParams.get("url");
    const image = url.searchParams.get("image");

    if (name) {
      metadata.name = NIP46Validator.sanitizeString(name, 256);
    }
    if (metadataUrl) {
      // Basic URL validation for metadata
      try {
        new URL(metadataUrl);
        metadata.url = NIP46Validator.sanitizeString(metadataUrl, 512);
      } catch {
        // Invalid URL, skip it
      }
    }
    if (image) {
      // Basic URL validation for image
      try {
        new URL(image);
        metadata.image = NIP46Validator.sanitizeString(image, 512);
      } catch {
        // Invalid URL, skip it
      }
    }

    return { type, pubkey, relays, secret, permissions, metadata };
  } catch (error) {
    if (error instanceof NIP46SecurityError || error instanceof NIP46ConnectionError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new NIP46ConnectionError(`Failed to parse connection string: ${errorMessage}`);
  }
}

