"use strict";
/**
 * NIP-46 Request and Response Utilities
 *
 * This module contains types and helper functions for NIP-46 request/response handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestId = generateRequestId;
exports.createRequest = createRequest;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
/**
 * Generate a unique request ID
 * Uses a combination of timestamp and random characters
 */
function generateRequestId() {
    const randomChars = Math.random().toString(36).substring(2, 12);
    return randomChars;
}
/**
 * Create a NIP-46 request object
 */
function createRequest(method, params) {
    return {
        id: generateRequestId(),
        method,
        params
    };
}
/**
 * Create a success response
 */
function createSuccessResponse(id, result) {
    return { id, result };
}
/**
 * Create an error response
 */
function createErrorResponse(id, error) {
    return { id, error };
}
