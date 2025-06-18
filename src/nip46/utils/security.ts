/**
 * Security validation utilities for NIP-46
 */

import { isValidPrivateKey } from "../../nip44";
import { NIP46SecurityError } from "../types";

export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export class NIP46SecurityValidator {
  /**
   * Validate private key with comprehensive security checks (throws on error)
   */
  static validatePrivateKey(privateKey: string, context: string = "private key"): void {
    const result = this.validatePrivateKeyResult(privateKey, context);
    if (!result.valid) {
      throw new NIP46SecurityError(result.error!);
    }
  }

  /**
   * Validate private key with comprehensive security checks (returns result)
   */
  static validatePrivateKeyResult(privateKey: string, context: string = "private key"): SecurityValidationResult {
    // Check for null/undefined/empty
    if (!privateKey) {
      return {
        valid: false,
        error: `${context} is required and cannot be empty`,
        code: "PRIVATE_KEY_EMPTY"
      };
    }

    // Check for empty string specifically
    if (privateKey === "") {
      return {
        valid: false,
        error: `${context} cannot be an empty string`,
        code: "PRIVATE_KEY_EMPTY_STRING"
      };
    }

    // Check for placeholder values
    const placeholderValues = ["", "undefined", "null", "0", "00", "000"];
    if (placeholderValues.includes(privateKey.toLowerCase())) {
      return {
        valid: false,
        error: `${context} appears to be a placeholder value`,
        code: "PRIVATE_KEY_PLACEHOLDER"
      };
    }

    // Use the existing NIP-44 validation which includes curve order validation
    if (!isValidPrivateKey(privateKey)) {
      return {
        valid: false,
        error: `${context} is not a valid private key format or is outside curve order`,
        code: "PRIVATE_KEY_INVALID_FORMAT"
      };
    }

    return { valid: true };
  }

  /**
   * Validate that keypair is properly initialized for crypto operations
   */
  static validateKeypairForCrypto(keypair: { publicKey: string; privateKey: string }, context: string = "keypair"): void {
    // Validate private key
    this.validatePrivateKey(keypair.privateKey, `${context} private key`);

    // Validate public key is not empty
    if (!keypair.publicKey || keypair.publicKey === "") {
      throw new NIP46SecurityError(`${context} public key is required and cannot be empty`);
    }

    // Basic hex validation for public key (64 chars hex)
    if (!/^[0-9a-f]{64}$/i.test(keypair.publicKey)) {
      throw new NIP46SecurityError(`${context} public key must be 64 character hex string`);
    }
  }

  /**
   * Validate user keypair before signing operations
   */
  static validateUserKeypairForSigning(userKeypair: { publicKey: string; privateKey: string }): void {
    this.validateKeypairForCrypto(userKeypair, "user keypair");

    // Additional validation for signing context
    if (userKeypair.privateKey.length !== 64) {
      throw new NIP46SecurityError("User private key must be exactly 64 characters");
    }
  }

  /**
   * Validate signer keypair before bunker operations
   */
  static validateSignerKeypairForBunker(signerKeypair: { publicKey: string; privateKey: string }): void {
    this.validateKeypairForCrypto(signerKeypair, "signer keypair");

    // Additional validation for bunker context
    if (signerKeypair.privateKey.length !== 64) {
      throw new NIP46SecurityError("Signer private key must be exactly 64 characters");
    }
  }

  /**
   * Validate encryption parameters
   */
  static validateEncryptionParams(
    privateKey: string, 
    thirdPartyPubkey: string, 
    data: string,
    operation: string = "encryption"
  ): void {
    // Validate private key
    this.validatePrivateKey(privateKey, `${operation} private key`);

    // Validate third party public key
    if (!thirdPartyPubkey || thirdPartyPubkey === "") {
      throw new NIP46SecurityError(`${operation} requires a valid third party public key`);
    }

    if (!/^[0-9a-f]{64}$/i.test(thirdPartyPubkey)) {
      throw new NIP46SecurityError(`${operation} third party public key must be 64 character hex string`);
    }

    // Validate data
    if (typeof data !== 'string') {
      throw new NIP46SecurityError(`${operation} data must be a string`);
    }

    // Prevent encryption of extremely large data (DoS protection)
    if (data.length > 100000) { // 100KB limit
      throw new NIP46SecurityError(`${operation} data too large (max 100KB)`);
    }
  }

  /**
   * Secure check for empty or uninitialized private keys
   */
  static isPrivateKeyEmpty(privateKey: string): boolean {
    return !privateKey || 
           privateKey === "" || 
           privateKey === "undefined" || 
           privateKey === "null" ||
           privateKey === "0" ||
           /^0+$/.test(privateKey); // All zeros
  }

  /**
   * Validate before any signing operation
   */
  static validateBeforeSigning(userKeypair: { publicKey: string; privateKey: string }, eventData: any): void {
    // Validate user keypair
    this.validateUserKeypairForSigning(userKeypair);

    // Validate event data
    if (!eventData) {
      throw new NIP46SecurityError("Event data is required for signing");
    }

    if (typeof eventData !== 'object') {
      throw new NIP46SecurityError("Event data must be an object");
    }

    // Validate required event fields
    const requiredFields = ['kind', 'content', 'created_at'];
    for (const field of requiredFields) {
      if (!(field in eventData)) {
        throw new NIP46SecurityError(`Event data missing required field: ${field}`);
      }
    }

    // Validate field types
    if (typeof eventData.kind !== 'number') {
      throw new NIP46SecurityError("Event kind must be a number");
    }

    if (typeof eventData.content !== 'string') {
      throw new NIP46SecurityError("Event content must be a string");
    }

    if (typeof eventData.created_at !== 'number') {
      throw new NIP46SecurityError("Event created_at must be a number");
    }

    // Validate kind range
    if (eventData.kind < 0 || eventData.kind > 65535) {
      throw new NIP46SecurityError("Event kind must be between 0 and 65535");
    }

    // Validate content size (DoS protection)
    if (eventData.content.length > 100000) { // 100KB limit
      throw new NIP46SecurityError("Event content too large (max 100KB)");
    }
  }

  /**
   * Validate before any encryption operation
   */
  static validateBeforeEncryption(
    userKeypair: { publicKey: string; privateKey: string },
    thirdPartyPubkey: string,
    plaintext: string,
    method: string = "NIP-44"
  ): void {
    this.validateKeypairForCrypto(userKeypair, "user keypair");
    this.validateEncryptionParams(userKeypair.privateKey, thirdPartyPubkey, plaintext, `${method} encryption`);
  }

  /**
   * Validate before any decryption operation
   */
  static validateBeforeDecryption(
    userKeypair: { publicKey: string; privateKey: string },
    thirdPartyPubkey: string,
    ciphertext: string,
    method: string = "NIP-44"
  ): void {
    this.validateKeypairForCrypto(userKeypair, "user keypair");
    this.validateEncryptionParams(userKeypair.privateKey, thirdPartyPubkey, ciphertext, `${method} decryption`);

    // Additional validation for ciphertext
    if (!ciphertext || ciphertext.trim() === "") {
      throw new NIP46SecurityError(`${method} decryption requires non-empty ciphertext`);
    }
  }

  /**
   * Validate bunker initialization
   */
  static validateBunkerInitialization(options: {
    userPubkey: string;
    signerPubkey?: string;
    userKeypair?: { publicKey: string; privateKey: string };
    signerKeypair?: { publicKey: string; privateKey: string };
  }): void {
    // Validate user public key
    if (!options.userPubkey || options.userPubkey === "") {
      throw new NIP46SecurityError("User public key is required for bunker initialization");
    }

    if (!/^[0-9a-f]{64}$/i.test(options.userPubkey)) {
      throw new NIP46SecurityError("User public key must be 64 character hex string");
    }

    // Validate signer public key if provided
    if (options.signerPubkey && !/^[0-9a-f]{64}$/i.test(options.signerPubkey)) {
      throw new NIP46SecurityError("Signer public key must be 64 character hex string");
    }

    // Validate keypairs if provided
    if (options.userKeypair) {
      this.validateUserKeypairForSigning(options.userKeypair);
    }

    if (options.signerKeypair) {
      this.validateSignerKeypairForBunker(options.signerKeypair);
    }
  }

  /**
   * Check if initialization is complete and secure
   */
  static validateSecureInitialization(bunkerInstance: {
    userKeypair: { publicKey: string; privateKey: string };
    signerKeypair: { publicKey: string; privateKey: string };
  }): void {
    // Check user keypair
    if (this.isPrivateKeyEmpty(bunkerInstance.userKeypair.privateKey)) {
      throw new NIP46SecurityError("User private key not properly initialized - cannot perform cryptographic operations");
    }

    // Check signer keypair
    if (this.isPrivateKeyEmpty(bunkerInstance.signerKeypair.privateKey)) {
      throw new NIP46SecurityError("Signer private key not properly initialized - cannot perform cryptographic operations");
    }

    // Validate both keypairs
    this.validateUserKeypairForSigning(bunkerInstance.userKeypair);
    this.validateSignerKeypairForBunker(bunkerInstance.signerKeypair);
  }
} 