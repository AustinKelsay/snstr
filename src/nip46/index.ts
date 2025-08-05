/**
 * NIP-46 Remote Signing Protocol
 *
 * This implementation provides a way to manage private keys remotely
 * and sign events from different clients. The protocol establishes a secure
 * connection between clients and a "bunker" which holds the private keys.
 *
 * Reference: https://github.com/nostr-protocol/nips/blob/master/46.md
 *
 * Two implementations are provided:
 *
 * 1. NostrRemoteSignerClient/NostrRemoteSignerBunker:
 *    - Full-featured implementation with all NIP-46 capabilities
 *    - Supports auth challenges via URL
 *    - Handles permissions for specific event kinds
 *    - Supports both NIP-04 and NIP-44 encryption
 *    - Connection metadata for better UX
 *    - Secret token support for secure connections
 *
 * 2. SimpleNIP46Client/SimpleNIP46Bunker:
 *    - Simplified implementation for basic use cases
 *    - Minimal code with core functionality
 *    - NIP-04 encryption only
 *    - Basic permission handling
 *    - No auth challenges or metadata support
 *    - Good for learning and simple applications
 *
 * Choose the implementation that best fits your needs based on the complexity
 * and security requirements of your application.
 */

// Export types
export * from "./types";

// Export client and bunker implementations
export { NostrRemoteSignerClient } from "./client";
export { NostrRemoteSignerBunker } from "./bunker";

// Export simplified implementation
export { SimpleNIP46Client } from "./simple-client";
export { SimpleNIP46Bunker } from "./simple-bunker";

// Export utilities
export { Logger, LogLevel } from "./utils/logger";

export {
  generateRequestId,
  createRequest,
  createSuccessResponse,
  createErrorResponse,
} from "./utils/request-response";
export {
  buildConnectionString,
  parseConnectionString,
} from "./utils/connection";
export {
  // Constants
  MAX_CONTENT_SIZE,
  MAX_ID_LENGTH,
  MAX_PARAMS_COUNT,
  MAX_PARAM_LENGTH,
  MAX_TAGS_COUNT,
  MAX_TAG_ELEMENT_LENGTH,
  // Validation functions
  validateEventContent,
  validatePubkey,
  validateEventId,
  validateSignature,
  validatePrivateKey,
  validateRequestPayload,
  isValidMethod,
  validateParams,
  validateRelayUrl,
  validatePermission,
  validateConnectionString,
  validateAndParseJson,
  sanitizeString,
  validateTimestamp,
  // Error handler class
  SecureErrorHandler,
} from "./utils/validator";

// Re-export utility functions from crypto to make the API more convenient
export { generateKeypair } from "../utils/crypto";
