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
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // Safe import without eval - use top-level import for Node.js crypto
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require('crypto');
      return crypto.randomBytes(16).toString('hex');
    } catch (error) {
      // Fallback if crypto is not available
    }
  }
  
  // Use Web Crypto API if available (browsers)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Final fallback - should only happen in very unusual environments
  // Include timestamp to reduce collision probability
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random1}-${random2}`;
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
