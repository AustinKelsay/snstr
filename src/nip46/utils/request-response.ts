/**
 * NIP-46 Request and Response Utilities
 *
 * This module contains types and helper functions for NIP-46 request/response handling.
 */
import { NIP46Method, NIP46Request, NIP46Response } from "../types";

/**
 * Generate a unique request ID
 * Uses a combination of timestamp and random characters
 */
export function generateRequestId(): string {
  const randomChars = Math.random().toString(36).substring(2, 12);
  return randomChars;
}

/**
 * Create a NIP-46 request object
 */
export function createRequest(method: NIP46Method, params: string[]): NIP46Request {
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
