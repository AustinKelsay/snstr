/**
 * NIP-46 request message format
 */

import type { RateLimitConfig } from './utils/rate-limiter';

export interface NIP46Request {
  id: string;
  method: NIP46Method;
  params: string[];
  pubkey?: string;
}

/**
 * NIP-46 response message format
 */
export interface NIP46Response {
  id: string;
  result?: string;
  error?: string;
  auth_url?: string; // For auth challenges
}

/**
 * Standardized error codes for NIP-46 operations
 */
export enum NIP46ErrorCode {
  // Connection errors
  INVALID_REQUEST = "INVALID_REQUEST",
  CONNECTION_REJECTED = "CONNECTION_REJECTED", 
  INVALID_SECRET = "INVALID_SECRET",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NOT_AUTHORIZED = "NOT_AUTHORIZED",
  
  // Method errors
  METHOD_NOT_SUPPORTED = "METHOD_NOT_SUPPORTED",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  
  // Signing errors
  SIGNING_FAILED = "SIGNING_FAILED",
  USER_PRIVATE_KEY_NOT_SET = "USER_PRIVATE_KEY_NOT_SET",
  
  // Encryption errors
  ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
  
  // General errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  TIMEOUT = "TIMEOUT",
  RATE_LIMITED = "RATE_LIMITED",
}

/**
 * Structured error response for NIP-46
 */
export interface NIP46ErrorResponse {
  code: NIP46ErrorCode;
  message: string;
  details?: string;
}

/**
 * Supported NIP-46 methods
 */
export enum NIP46Method {
  CONNECT = "connect",
  GET_PUBLIC_KEY = "get_public_key",
  SIGN_EVENT = "sign_event",
  GET_RELAYS = "get_relays",
  PING = "ping",
  DISCONNECT = "disconnect",
  NIP04_ENCRYPT = "nip04_encrypt",
  NIP04_DECRYPT = "nip04_decrypt",
  NIP44_ENCRYPT = "nip44_encrypt",
  NIP44_DECRYPT = "nip44_decrypt",
}

/**
 * Base connection options
 */
export interface NIP46ConnectionOptions {
  relays?: string[];
  secret?: string;
  permissions?: string[];
}

/**
 * Client-specific options extending base connection options
 */
export interface NIP46ClientOptions extends NIP46ConnectionOptions {
  name?: string;
  url?: string;
  image?: string;
  timeout?: number; // Request timeout in milliseconds
  debug?: boolean;
  authTimeout?: number; // Auth challenge timeout in milliseconds
  authDomainWhitelist?: string[]; // Allowed domains for auth URLs
}

/**
 * Bunker-specific options
 */
export interface NIP46BunkerOptions {
  userPubkey: string;
  signerPubkey?: string;
  relays?: string[];
  secret?: string;
  defaultPermissions?: string[];
  requireAuthChallenge?: boolean;
  authUrl?: string;
  authTimeout?: number;
  metadata?: NIP46Metadata;
  debug?: boolean;
  rateLimitConfig?: RateLimitConfig;
}

/**
 * Metadata for NIP-46 bunker/client identification
 */
export interface NIP46Metadata {
  name?: string;
  url?: string;
  image?: string;
  relays?: string[];
  nostrconnect_url?: string; // Changed to match NIP-46 spec
}

/**
 * Authentication challenge data
 */
export interface NIP46AuthChallenge {
  id: string;
  clientPubkey: string;
  timestamp: number;
  permissions?: string[];
}

/**
 * Connection information for bunker or nostrconnect
 */
export interface NIP46ConnectionInfo {
  type: "bunker" | "nostrconnect";
  pubkey: string;
  relays: string[];
  secret?: string;
  permissions?: string[];
  metadata?: NIP46Metadata;
}

/**
 * Encryption operation result
 */
export type NIP46EncryptionResult = {
  success: boolean;
  method: "nip44";
} & (
  | {
      success: true;
      data: string;
      error?: never;
    }
  | {
      success: false;
      data?: never;
      error: string;
    }
);

/**
 * Client session data
 */
export interface NIP46ClientSession {
  permissions: Set<string>;
  lastSeen: number;
}

/**
 * Data for an unsigned event to be signed
 */
export interface NIP46UnsignedEventData {
  kind: number;
  content: string;
  created_at: number;
  tags?: string[][];
  pubkey?: string;
}

/**
 * Error types for NIP-46 operations
 */
export class NIP46Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46Error";
  }
}

export class NIP46ConnectionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46ConnectionError";
  }
}

export class NIP46TimeoutError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46TimeoutError";
  }
}

export class NIP46AuthorizationError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46AuthorizationError";
  }
}

export class NIP46EncryptionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46EncryptionError";
  }
}

export class NIP46DecryptionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46DecryptionError";
  }
}

export class NIP46SigningError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46SigningError";
  }
}

export class NIP46SecurityError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46SecurityError";
  }
}

export class NIP46ReplayAttackError extends NIP46SecurityError {
  constructor(message: string) {
    super(message);
    this.name = "NIP46ReplayAttackError";
  }
}

/**
 * Utility functions for standardized error handling
 */
export class NIP46ErrorUtils {
  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    id: string,
    code: NIP46ErrorCode,
    message: string,
    details?: string
  ): NIP46Response {
    const errorObj: NIP46ErrorResponse = { code, message, details };
    return {
      id,
      error: JSON.stringify(errorObj),
    };
  }

  /**
   * Create a simple error response (for backwards compatibility)
   */
  static createSimpleErrorResponse(id: string, message: string): NIP46Response {
    return {
      id,
      error: message,
    };
  }

  /**
   * Map error codes to HTTP-like status descriptions
   */
  static getErrorDescription(code: NIP46ErrorCode): string {
    const descriptions: Record<NIP46ErrorCode, string> = {
      [NIP46ErrorCode.INVALID_REQUEST]: "The request format is invalid",
      [NIP46ErrorCode.CONNECTION_REJECTED]: "Connection was rejected by the signer",
      [NIP46ErrorCode.INVALID_SECRET]: "The provided secret is invalid",
      [NIP46ErrorCode.PERMISSION_DENIED]: "Insufficient permissions for this operation",
      [NIP46ErrorCode.NOT_AUTHORIZED]: "Client is not authorized",
      [NIP46ErrorCode.METHOD_NOT_SUPPORTED]: "The requested method is not supported",
      [NIP46ErrorCode.INVALID_PARAMETERS]: "The provided parameters are invalid",
      [NIP46ErrorCode.SIGNING_FAILED]: "Event signing failed",
      [NIP46ErrorCode.USER_PRIVATE_KEY_NOT_SET]: "User private key is not configured",
      [NIP46ErrorCode.ENCRYPTION_FAILED]: "Encryption operation failed",
      [NIP46ErrorCode.DECRYPTION_FAILED]: "Decryption operation failed",
      [NIP46ErrorCode.INTERNAL_ERROR]: "An internal error occurred",
      [NIP46ErrorCode.TIMEOUT]: "Operation timed out",
      [NIP46ErrorCode.RATE_LIMITED]: "Rate limit exceeded",
    };
    return descriptions[code] || "Unknown error";
  }
}

/**
 * Key pair for client or bunker
 */
export interface NIP46KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Simplified bunker options
 */
export interface SimpleNIP46BunkerOptions {
  timeout?: number;
  logLevel?: number; // Using LogLevel enum
  defaultPermissions?: string[];
  secret?: string;
  debug?: boolean;
}

/**
 * Simplified client options
 */
export interface SimpleNIP46ClientOptions {
  timeout?: number;
  logLevel?: number; // Using LogLevel enum
  debug?: boolean;
}
