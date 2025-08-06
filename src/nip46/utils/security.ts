/**
 * Security validation utilities for NIP-46
 */

import { isValidPrivateKey } from "../../nip44";
import { NIP46SecurityError, NIP46UnsignedEventData } from "../types";

/**
 * Constant-time string comparison to prevent timing attacks
 * Always runs in time proportional to the longer string to avoid length-based timing leaks
 */
function constantTimeStringEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  const lengthMismatch = a.length ^ b.length;
  let contentMismatch = 0;

  for (let i = 0; i < maxLength; i++) {
    // Use conditional masking to handle out-of-bounds access without branching
    const aChar = i < a.length ? a.charCodeAt(i) : 0;
    const bChar = i < b.length ? b.charCodeAt(i) : 0;
    contentMismatch |= aChar ^ bChar;
  }

  // Combine length and content mismatches
  return (lengthMismatch | contentMismatch) === 0;
}

/**
 * Secure permission checking with timing attack protection
 */
export function securePermissionCheck(
  clientPermissions: Set<string>,
  requiredPermission: string,
): boolean {
  // Convert to array to avoid set enumeration timing differences
  const permissions = Array.from(clientPermissions);

  let hasPermission = false;

  // Check all permissions to avoid early exit timing attacks
  for (const permission of permissions) {
    if (constantTimeStringEqual(permission, requiredPermission)) {
      hasPermission = true;
    }
  }

  return hasPermission;
}

export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Create production-safe error message
 */
export function createProductionSafeMessage(
  debugMessage: string,
  prodMessage: string = "Security validation failed",
): string {
  return process.env.NODE_ENV === "production" ? prodMessage : debugMessage;
}

/**
 * Enhanced private key validation with production-safe errors
 */
export function validatePrivateKeySecure(
  privateKey: string,
  context: string = "private key",
): void {
  const result = validatePrivateKeyResult(privateKey, context);
  if (!result.valid) {
    const prodSafeMessage = createProductionSafeMessage(
      result.error!,
      "Invalid key format",
    );
    throw new NIP46SecurityError(prodSafeMessage);
  }
}

/**
 * Validate private key with comprehensive security checks (throws on error)
 */
export function validatePrivateKey(
  privateKey: string,
  context: string = "private key",
): void {
  const result = validatePrivateKeyResult(privateKey, context);
  if (!result.valid) {
    throw new NIP46SecurityError(result.error!);
  }
}

/**
 * Validate private key with comprehensive security checks (returns result)
 */
export function validatePrivateKeyResult(
  privateKey: string,
  context: string = "private key",
): SecurityValidationResult {
  // Check for null/undefined specifically
  if (privateKey == null) {
    return {
      valid: false,
      error: `${context} is required and cannot be null or undefined`,
      code: "PRIVATE_KEY_NULL",
    };
  }

  // Check for empty string specifically
  if (privateKey === "") {
    return {
      valid: false,
      error: `${context} cannot be an empty string`,
      code: "PRIVATE_KEY_EMPTY_STRING",
    };
  }

  // Check for placeholder values
  const placeholderValues = ["", "undefined", "null", "0", "00", "000"];
  if (placeholderValues.includes(privateKey.toLowerCase())) {
    return {
      valid: false,
      error: `${context} appears to be a placeholder value`,
      code: "PRIVATE_KEY_PLACEHOLDER",
    };
  }

  // Use the existing NIP-44 validation which includes curve order validation
  if (!isValidPrivateKey(privateKey)) {
    return {
      valid: false,
      error: `${context} is not a valid private key format or is outside curve order`,
      code: "PRIVATE_KEY_INVALID_FORMAT",
    };
  }

  return { valid: true };
}

/**
 * Validate that keypair is properly initialized for crypto operations
 */
export function validateKeypairForCrypto(
  keypair: { publicKey: string; privateKey: string },
  context: string = "keypair",
): void {
  // Validate private key
  validatePrivateKey(keypair.privateKey, `${context} private key`);

  // Validate public key is not empty
  if (!keypair.publicKey || keypair.publicKey === "") {
    throw new NIP46SecurityError(
      `${context} public key is required and cannot be empty`,
    );
  }

  // Basic hex validation for public key (64 chars hex)
  if (!/^[0-9a-f]{64}$/i.test(keypair.publicKey)) {
    throw new NIP46SecurityError(
      `${context} public key must be 64 character hex string`,
    );
  }
}

/**
 * Validate user keypair before signing operations
 */
export function validateUserKeypairForSigning(userKeypair: {
  publicKey: string;
  privateKey: string;
}): void {
  validateKeypairForCrypto(userKeypair, "user keypair");

  // Additional validation for signing context
  if (userKeypair.privateKey.length !== 64) {
    throw new NIP46SecurityError(
      "User private key must be exactly 64 characters",
    );
  }
}

/**
 * Validate signer keypair before bunker operations
 */
export function validateSignerKeypairForBunker(signerKeypair: {
  publicKey: string;
  privateKey: string;
}): void {
  validateKeypairForCrypto(signerKeypair, "signer keypair");

  // Additional validation for bunker context
  if (signerKeypair.privateKey.length !== 64) {
    throw new NIP46SecurityError(
      "Signer private key must be exactly 64 characters",
    );
  }
}

/**
 * Validate encryption parameters
 */
export function validateEncryptionParams(
  privateKey: string,
  thirdPartyPubkey: string,
  data: string,
  operation: string = "encryption",
): void {
  // Validate private key
  validatePrivateKey(privateKey, `${operation} private key`);

  // Validate third party public key
  if (!thirdPartyPubkey || thirdPartyPubkey === "") {
    throw new NIP46SecurityError(
      `${operation} requires a valid third party public key`,
    );
  }

  if (!/^[0-9a-f]{64}$/i.test(thirdPartyPubkey)) {
    throw new NIP46SecurityError(
      `${operation} third party public key must be 64 character hex string`,
    );
  }

  // Validate data
  if (typeof data !== "string") {
    throw new NIP46SecurityError(`${operation} data must be a string`);
  }

  // Check for empty or whitespace-only data
  if (data.trim() === "") {
    throw new NIP46SecurityError(
      `${operation} data must not be empty or whitespace-only`,
    );
  }

  // Prevent encryption of extremely large data (DoS protection)
  if (data.length > 100000) {
    // 100KB limit
    throw new NIP46SecurityError(`${operation} data too large (max 100KB)`);
  }
}

/**
 * Secure check for empty or uninitialized private keys
 */
export function isPrivateKeyEmpty(privateKey: string): boolean {
  return (
    !privateKey ||
    privateKey === "" ||
    privateKey === "undefined" ||
    privateKey === "null" ||
    privateKey === "0" ||
    /^0+$/.test(privateKey)
  ); // All zeros
}

/**
 * Validate before any signing operation
 */
export function validateBeforeSigning(
  userKeypair: { publicKey: string; privateKey: string },
  eventData: NIP46UnsignedEventData,
): void {
  // Validate user keypair
  validateUserKeypairForSigning(userKeypair);

  // Validate event data
  if (!eventData) {
    throw new NIP46SecurityError("Event data is required for signing");
  }

  if (typeof eventData !== "object") {
    throw new NIP46SecurityError("Event data must be an object");
  }

  // Validate required event fields
  const requiredFields = ["kind", "content", "created_at"];
  for (const field of requiredFields) {
    if (!(field in eventData)) {
      throw new NIP46SecurityError(
        `Event data missing required field: ${field}`,
      );
    }
  }

  // Validate field types
  if (typeof eventData.kind !== "number") {
    throw new NIP46SecurityError("Event kind must be a number");
  }

  if (typeof eventData.content !== "string") {
    throw new NIP46SecurityError("Event content must be a string");
  }

  if (typeof eventData.created_at !== "number") {
    throw new NIP46SecurityError("Event created_at must be a number");
  }

  // Validate kind range
  if (eventData.kind < 0 || eventData.kind > 65535) {
    throw new NIP46SecurityError("Event kind must be between 0 and 65535");
  }

  // Validate content size (DoS protection)
  if (eventData.content.length > 100000) {
    // 100KB limit
    throw new NIP46SecurityError("Event content too large (max 100KB)");
  }
}

/**
 * Validate before any encryption operation
 */
export function validateBeforeEncryption(
  userKeypair: { publicKey: string; privateKey: string },
  thirdPartyPubkey: string,
  plaintext: string,
  method: string = "NIP-44",
): void {
  validateKeypairForCrypto(userKeypair, "user keypair");
  validateEncryptionParams(
    userKeypair.privateKey,
    thirdPartyPubkey,
    plaintext,
    `${method} encryption`,
  );
}

/**
 * Validate before any decryption operation
 */
export function validateBeforeDecryption(
  userKeypair: { publicKey: string; privateKey: string },
  thirdPartyPubkey: string,
  ciphertext: string,
  method: string = "NIP-44",
): void {
  validateKeypairForCrypto(userKeypair, "user keypair");
  validateEncryptionParams(
    userKeypair.privateKey,
    thirdPartyPubkey,
    ciphertext,
    `${method} decryption`,
  );

  // Additional validation for ciphertext
  if (!ciphertext || ciphertext.trim() === "") {
    throw new NIP46SecurityError(
      `${method} decryption requires non-empty ciphertext`,
    );
  }
}

/**
 * Validate bunker initialization
 */
export function validateBunkerInitialization(options: {
  userPubkey: string;
  signerPubkey?: string;
  userKeypair?: { publicKey: string; privateKey: string };
  signerKeypair?: { publicKey: string; privateKey: string };
}): void {
  // Validate user public key
  if (!options.userPubkey || options.userPubkey === "") {
    throw new NIP46SecurityError(
      "User public key is required for bunker initialization",
    );
  }

  if (!/^[0-9a-f]{64}$/i.test(options.userPubkey)) {
    throw new NIP46SecurityError(
      "User public key must be 64 character hex string",
    );
  }

  // Validate signer public key if provided
  if (options.signerPubkey && !/^[0-9a-f]{64}$/i.test(options.signerPubkey)) {
    throw new NIP46SecurityError(
      "Signer public key must be 64 character hex string",
    );
  }

  // Validate keypairs if provided
  if (options.userKeypair) {
    validateUserKeypairForSigning(options.userKeypair);
  }

  if (options.signerKeypair) {
    validateSignerKeypairForBunker(options.signerKeypair);
  }
}

/**
 * Check if initialization is complete and secure
 */
export function validateSecureInitialization(bunkerInstance: {
  userKeypair: { publicKey: string; privateKey: string };
  signerKeypair: { publicKey: string; privateKey: string };
}): void {
  // Check user keypair
  if (isPrivateKeyEmpty(bunkerInstance.userKeypair.privateKey)) {
    throw new NIP46SecurityError(
      "User private key not properly initialized - cannot perform cryptographic operations",
    );
  }

  // Check signer keypair
  if (isPrivateKeyEmpty(bunkerInstance.signerKeypair.privateKey)) {
    throw new NIP46SecurityError(
      "Signer private key not properly initialized - cannot perform cryptographic operations",
    );
  }

  // Validate both keypairs
  validateUserKeypairForSigning(bunkerInstance.userKeypair);
  validateSignerKeypairForBunker(bunkerInstance.signerKeypair);
}
