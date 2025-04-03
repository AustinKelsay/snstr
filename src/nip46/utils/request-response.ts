/**
 * NIP-46 Request and Response Utilities
 * 
 * This module contains types and helper functions for NIP-46 request/response handling.
 */

// Basic request/response types
export interface NIP46Request {
  id: string;
  method: string;
  params: string[];
}

export interface NIP46Response {
  id: string;
  result?: string;
  error?: string;
}

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
export function createRequest(method: string, params: string[]): NIP46Request {
  return {
    id: generateRequestId(),
    method,
    params
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(id: string, result: string): NIP46Response {
  return { id, result };
}

/**
 * Create an error response
 */
export function createErrorResponse(id: string, error: string): NIP46Response {
  return { id, error };
} 