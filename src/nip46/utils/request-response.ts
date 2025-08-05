/**
 * NIP-46 Request and Response Utilities
 *
 * This module contains types and helper functions for NIP-46 request/response handling.
 */
import { NIP46Method, NIP46Request, NIP46Response } from "../types";

/**
 * Generate a cryptographically secure random request ID
 * Uses crypto.randomBytes in Node.js or crypto.getRandomValues in browsers
 */
export function generateRequestId(): string {
  // Use Node.js crypto if available
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    try {
      // Safe import without eval - use top-level import for Node.js crypto
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require("crypto");
      return crypto.randomBytes(16).toString("hex");
    } catch (error) {
      // Don't fall back to weak randomness - fail securely
      throw new Error(
        "Secure random number generation not available in Node.js environment. This is required for NIP-46 security.",
      );
    }
  }

  // Use Web Crypto API if available (browsers)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  // SECURITY: Never fall back to Math.random() for cryptographic purposes
  // This would create predictable IDs that could be exploited for:
  // - Replay attacks
  // - Session hijacking
  // - Authentication bypass
  throw new Error(
    "Cryptographically secure random number generation not available. NIP-46 requires crypto.getRandomValues() or Node.js crypto module for security.",
  );
}

/**
 * Create a NIP-46 request object
 */
export function createRequest(
  method: NIP46Method,
  params: string[],
): NIP46Request {
  return {
    id: generateRequestId(),
    method,
    params,
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(
  id: string,
  result: string,
): NIP46Response {
  return { id, result };
}

/**
 * Create an error response
 */
export function createErrorResponse(id: string, error: string): NIP46Response {
  return { id, error };
}

// Re-export types for backward compatibility
export type { NIP46Request, NIP46Response };
export { NIP46Method };
