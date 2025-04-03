/**
 * NIP-46 Request and Response Utilities
 *
 * This module contains types and helper functions for NIP-46 request/response handling.
 */
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
export declare function generateRequestId(): string;
/**
 * Create a NIP-46 request object
 */
export declare function createRequest(method: string, params: string[]): NIP46Request;
/**
 * Create a success response
 */
export declare function createSuccessResponse(id: string, result: string): NIP46Response;
/**
 * Create an error response
 */
export declare function createErrorResponse(id: string, error: string): NIP46Response;
