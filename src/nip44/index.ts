import { randomBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha2";
import {
  extract as hkdf_extract,
  expand as hkdf_expand,
} from "@noble/hashes/hkdf";
import { hmac } from "@noble/hashes/hmac";
import { secp256k1 } from "@noble/curves/secp256k1";
import { chacha20 } from "@noble/ciphers/chacha";

// NIP-44 constants as specified in https://github.com/nostr-protocol/nips/blob/master/44.md
// const VERSION = 2; // Original hardcoded version
// NONCE_SIZE = 32; // NIP-44 v2 uses 32-byte nonce
// const KEY_SIZE = 32; // 32-byte key for ChaCha20
// const MAC_SIZE = 32; // HMAC-SHA256 produces 32-byte tags

// Current supported version for encryption
const CURRENT_VERSION = 2;
// Minimum supported version for decryption
const MIN_SUPPORTED_VERSION = 0;
// Maximum supported version for decryption (for future extensibility)
const MAX_SUPPORTED_VERSION = 2;

// NIP-44 Version-specific constants
// Per NIP-44 specification (Decryption, point 4): 
// "Implementations MUST be able to decrypt versions 0 and 1 for compatibility, 
// using the same algorithms as above [i.e., version 2's algorithms] with the respective version byte. 
// The `message_nonce` is 32 bytes, `mac` is 32 bytes."
//
// This confirms that all versions (0, 1, 2) use:
// - 32-byte nonces
// - 32-byte MAC tags
// - Same cryptographic algorithms (ChaCha20, HMAC-SHA256, HKDF with "nip44-v2" salt)
export const NONCE_SIZE_V0 = 32;
export const NONCE_SIZE_V1 = 32;
export const NONCE_SIZE_V2 = 32;

export const MAC_SIZE_V0 = 32;
export const MAC_SIZE_V1 = 32;
export const MAC_SIZE_V2 = 32;

const KEY_SIZE = 32; // 32-byte key for ChaCha20 (consistent across versions)
const MIN_PLAINTEXT_SIZE = 1;
const MAX_PLAINTEXT_SIZE = 65535; // 64KB - 1

// Payload format constants
const VERSION_BYTE_SIZE = 1;

// NIP-44 payload length limits (from specification)
const MIN_BASE64_PAYLOAD_LENGTH = 132;  // Minimum base64 payload length
const MAX_BASE64_PAYLOAD_LENGTH = 87472; // Maximum base64 payload length  
const MIN_DECODED_PAYLOAD_LENGTH = 99;   // Minimum decoded payload length
const MAX_DECODED_PAYLOAD_LENGTH = 65603; // Maximum decoded payload length

// MIN_CIPHERTEXT_SIZE and MIN_PAYLOAD_SIZE will now depend on the version, so they are calculated dynamically.
// const MIN_CIPHERTEXT_SIZE = VERSION_BYTE_SIZE + NONCE_SIZE + 1; // Version + nonce + at least 1 byte
// const MIN_PAYLOAD_SIZE = MIN_CIPHERTEXT_SIZE + MAC_SIZE;
// const MIN_BASE64_LENGTH = Math.ceil((MIN_PAYLOAD_SIZE * 4) / 3); // Minimum valid base64 length

// RFC 4648 compliant Base64 implementation with proper environment detection
// NIP-44 spec requires: "Base64 ([RFC 4648](https://datatracker.ietf.org/doc/html/rfc4648), with padding)"
function base64Encode(bytes: Uint8Array): string {
  // Try browser environment first (most common)
  if (typeof globalThis?.btoa === 'function') {
    try {
      // Browser environment: use btoa with binary string conversion
      return globalThis.btoa(String.fromCharCode(...bytes));
    } catch (error) {
      // Fall through to Node.js or manual implementation
    }
  }
  
  // Try Node.js environment
  if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(bytes).toString("base64");
    } catch (error) {
      // Fall through to manual implementation
    }
  }
  
  // Manual RFC 4648 compliant base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
}

// Base64 validation regex - compiled once for efficiency
// Base64 alphabet: A-Z, a-z, 0-9, +, / with optional padding (=) at the end
// Enforce proper base64 structure:
// - String must be non-empty (either 4-char groups OR padded ending)
// - String length must be multiple of 4 (including padding)
// - Padding characters '=' can only appear at the end, either as '=' or '=='
// - No padding characters allowed in the middle of the string
// - Empty strings are rejected by requiring at least one valid ending pattern
const BASE64_VALIDATION_REGEX = /^(?:(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

function base64Decode(str: string): Uint8Array {
  // Validate base64 alphabet before decoding to prevent silent acceptance of malformed strings
  if (!BASE64_VALIDATION_REGEX.test(str)) {
    throw new Error("NIP-44: Invalid base64 alphabet in ciphertext");
  }
  
  // Try browser environment first (most common)
  if (typeof globalThis?.atob === 'function') {
    try {
      const binaryString = globalThis.atob(str);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      throw new Error("NIP-44: Invalid base64 encoding in ciphertext");
    }
  }
  
  // Try Node.js environment
  if (typeof Buffer !== 'undefined') {
    try {
      return new Uint8Array(Buffer.from(str, "base64"));
    } catch (error) {
      throw new Error("NIP-44: Invalid base64 encoding in ciphertext");
    }
  }
  
  // Fallback: manual RFC 4648 compliant base64 decoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Array(256).fill(-1);
  
  // Build lookup table
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  lookup['='.charCodeAt(0)] = 0; // Padding character
  
  const len = str.length;
  let bufferLength = Math.floor(len * 0.75);
  if (str[len - 1] === '=') {
    bufferLength--;
    if (str[len - 2] === '=') {
      bufferLength--;
    }
  }
  
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[str.charCodeAt(i)];
    const encoded2 = lookup[str.charCodeAt(i + 1)];
    const encoded3 = lookup[str.charCodeAt(i + 2)];
    const encoded4 = lookup[str.charCodeAt(i + 3)];
    
    if (encoded1 === -1 || encoded2 === -1 || encoded3 === -1 || encoded4 === -1) {
      throw new Error("NIP-44: Invalid base64 encoding in ciphertext");
    }
    
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  
  return bytes;
}

/**
 * Calculate the padded length for a plaintext of given length
 * Implements the padding scheme from NIP-44 v2
 */
function calcPaddedLen(unpadded_len: number): number {
  if (unpadded_len <= 0 || unpadded_len > MAX_PLAINTEXT_SIZE) {
    throw new Error(`NIP-44: Invalid plaintext length: ${unpadded_len}`);
  }

  if (unpadded_len <= 32) {
    return 32;
  }

  const nextPower = 1 << (Math.floor(Math.log2(unpadded_len - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;

  return chunk * (Math.floor((unpadded_len - 1) / chunk) + 1);
}

/**
 * Apply padding to a plaintext according to NIP-44 v2 spec
 */
function pad(plaintext: string): Uint8Array {
  const unpadded = utf8ToBytes(plaintext);
  const unpadded_len = unpadded.length;

  // Check if plaintext meets the size requirements
  if (unpadded_len < MIN_PLAINTEXT_SIZE || unpadded_len > MAX_PLAINTEXT_SIZE) {
    throw new Error(
      `NIP-44: Invalid plaintext length: ${unpadded_len}. Must be between ${MIN_PLAINTEXT_SIZE} and ${MAX_PLAINTEXT_SIZE}.`,
    );
  }

  // Create prefix with length as 16-bit big-endian integer
  const prefix = new Uint8Array(2);
  prefix[0] = (unpadded_len >> 8) & 0xff;
  prefix[1] = unpadded_len & 0xff;

  // Create suffix filled with zeros
  const padded_len = calcPaddedLen(unpadded_len);
  const suffix = new Uint8Array(padded_len - unpadded_len);

  // Concatenate prefix, unpadded text, and suffix
  return concatBytes(prefix, unpadded, suffix);
}

/**
 * Remove padding from a padded plaintext
 */
function unpad(padded: Uint8Array): string {
  // Ensure we have at least the length prefix (2 bytes) plus some data
  if (padded.length < 2) {
    throw new Error("NIP-44: Padded data too short to contain length prefix");
  }

  // Get length from first two bytes (big-endian uint16)
  const unpadded_len = (padded[0] << 8) | padded[1];

  // Validate the claimed unpadded length
  if (unpadded_len < MIN_PLAINTEXT_SIZE || unpadded_len > MAX_PLAINTEXT_SIZE) {
    throw new Error(
      `NIP-44: Invalid unpadded length in padded data: ${unpadded_len}`,
    );
  }

  // Check if padded data is long enough to contain the claimed unpadded data
  if (padded.length < 2 + unpadded_len) {
    throw new Error(
      `NIP-44: Padded data too short (${padded.length}) to contain claimed unpadded length (${unpadded_len})`,
    );
  }

  // Calculate expected padded length based on the claimed unpadded length
  const expected_padded_len = 2 + calcPaddedLen(unpadded_len);

  // Verify the total padded length matches what we expect from the padding scheme
  if (padded.length !== expected_padded_len) {
    throw new Error(
      `NIP-44: Padded length mismatch: ${padded.length} vs expected ${expected_padded_len}`,
    );
  }

  // Extract the actual data (skipping the 2-byte length prefix)
  const unpadded = padded.slice(2, 2 + unpadded_len);

  // Verify the unpadded slice length matches the claimed length
  if (unpadded.length !== unpadded_len) {
    throw new Error(
      `NIP-44: Extracted data length (${unpadded.length}) doesn't match claimed length (${unpadded_len})`,
    );
  }

  try {
    return new TextDecoder().decode(unpadded);
  } catch (error) {
    throw new Error(
      `NIP-44: Failed to decode unpadded data: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Validate if a string is a valid hex format public key
 * This function validates the FORMAT (64 lowercase hex characters) and
 * rejects problematic edge cases that are cryptographically invalid.
 * It does NOT validate if the hex string represents a valid curve point.
 * For full cryptographic validation, use isValidPublicKeyPoint.
 */
// secp256k1 field prime (P) as BigInt, defined once
const FIELD_PRIME = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");

export function isValidPublicKeyFormat(publicKey: string): boolean {
  // Check format: must be 64 hex characters (case-insensitive)
  if (!/^[0-9a-f]{64}$/i.test(publicKey)) {
    return false;
  }
  
  // Reject problematic edge cases that are invalid for cryptographic use
  
  // All zeros - invalid public key (point at infinity)
  if (publicKey === "0000000000000000000000000000000000000000000000000000000000000000") {
    return false;
  }
  
  // All 'f's - invalid public key (field prime - 1, not a valid x-coordinate)
  if (publicKey === "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") {
    return false;
  }
  
  // Any value ≥ field prime is invalid as an x-coordinate
  try {
    const keyValue = BigInt("0x" + publicKey);
    if (keyValue >= FIELD_PRIME) {
      return false;
    }
  } catch {
    // If BigInt conversion fails, it's not a valid hex string anyway
    return false;
  }
  
  return true;
}

/**
 * Validate if a hex string represents a valid point on the secp256k1 curve
 * This function does cryptographic validation in addition to format validation.
 * Use this when you need to ensure the public key is actually usable for cryptographic operations.
 * 
 * This implementation uses efficient point validation instead of expensive ECDH operations,
 * significantly improving performance while maintaining the same validation behavior.
 */
export function isValidPublicKeyPoint(publicKey: string): boolean {
  // First check format
  if (!isValidPublicKeyFormat(publicKey)) {
    return false;
  }

  // For Nostr x-only public keys, we need to check if the x-coordinate
  // represents a valid point on the secp256k1 curve.
  // We try both possible y-coordinates (even and odd) efficiently using
  // ProjectivePoint.fromHex which validates curve membership without
  // performing expensive ECDH operations.
  
  const prefixes = ['02', '03'];
  for (const prefix of prefixes) {
    try {
      secp256k1.ProjectivePoint.fromHex(prefix + publicKey);
      return true;
    } catch {
      // Continue to next prefix
    }
  }
  
  return false;
}

/**
 * Validate if a string is a valid hex format private key
 * A valid private key must be a 32-byte hex string with a value less than the curve order
 */
export function isValidPrivateKey(privateKey: string): boolean {
  // Check format: must be 64 hex characters (case-insensitive)
  if (!/^[0-9a-f]{64}$/i.test(privateKey)) {
    return false;
  }

  try {
    // Check that the value is a valid scalar (less than curve order)
    // This will throw if the private key is invalid
    secp256k1.getPublicKey(privateKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get conversation key (shared secret) between two users
 * According to NIP-44 v2 spec, this is:
 * 1. Execute ECDH (secp256k1) between private key A and public key B
 *    - This produces a shared point on the curve
 * 2. Extract only the x-coordinate of the shared point (32 bytes)
 *    - NIP-44 only uses the x-coordinate and discards the y-coordinate
 * 3. Use HKDF-extract with SHA-256, with:
 *    - IKM (Input Key Material) = shared_x (the x-coordinate from step 2)
 *    - salt = utf8-encoded string "nip44-v2"
 *
 * The derived conversation key is the same regardless of which user initiates:
 * getSharedSecret(privA, pubB) === getSharedSecret(privB, pubA)
 *
 * This symmetrical property is essential for bidirectional communication.
 *
 * Note: This is different from NIP-04 which uses the raw ECDH output without
 * proper key derivation, making it vulnerable to various attacks.
 *
 * @param privateKey - Hex-encoded 32-byte private key (64 hex chars)
 * @param publicKey - Hex-encoded 32-byte public key x-coordinate (64 hex chars)
 * @returns 32-byte conversation key as Uint8Array
 */
export function getSharedSecret(
  privateKey: string,
  publicKey: string,
): Uint8Array {
  // Validate private key - must be a valid scalar (less than curve order)
  if (!isValidPrivateKey(privateKey)) {
    throw new Error("NIP-44: Invalid private key format or value.");
  }

  // Validate public key - must be a valid x-coordinate on the curve
  if (!isValidPublicKeyPoint(publicKey)) {
    throw new Error(
      "NIP-44: Invalid public key format. Expected 64-character hex string.",
    );
  }

  try {
    // For Nostr, we have x-only public keys, so we need to try both possible y-coordinates
    // First, add '02' prefix (even y-coordinate) and try
    let sharedPoint: Uint8Array;
    try {
      sharedPoint = secp256k1.getSharedSecret(privateKey, "02" + publicKey);
    } catch {
      // If that fails, try with '03' prefix (odd y-coordinate)
      try {
        sharedPoint = secp256k1.getSharedSecret(privateKey, "03" + publicKey);
      } catch {
        throw new Error(
          "NIP-44: Invalid public key: not a point on the secp256k1 curve",
        );
      }
    }

    // Extract the x-coordinate (first byte is format, next 32 bytes are x-coordinate)
    const shared_x = sharedPoint.subarray(1, 33);

    // Use HKDF-extract with SHA-256, with the x-coordinate as IKM and "nip44-v2" as salt
    const salt = utf8ToBytes("nip44-v2");

    // Return the 32-byte conversation key
    return hkdf_extract(sha256, shared_x, salt);
  } catch (error) {
    if (error instanceof Error) {
      // If it's already a NIP-44 error, rethrow it
      if (error.message.startsWith("NIP-44:")) {
        throw error;
      }
      throw new Error(
        `NIP-44: Failed to derive shared secret: ${error.message}`,
      );
    }
    throw new Error("NIP-44: Failed to derive shared secret");
  }
}

/**
 * Generate message keys from conversation key and nonce
 *
 * According to NIP-44 v2 spec, this derives three separate keys from the conversation key:
 * 1. Uses HKDF-expand with SHA-256 to derive 76 bytes of key material:
 *    - Input: conversation_key (32 bytes) from getSharedSecret
 *    - Info: nonce (32 bytes), unique random value for each message
 * 2. The resulting 76 bytes are split into three distinct keys:
 *    - chacha_key (32 bytes): Used as the key for ChaCha20 encryption
 *    - chacha_nonce (12 bytes): Used as the nonce for ChaCha20 encryption
 *    - hmac_key (32 bytes): Used as the key for HMAC-SHA256 authentication
 *
 * This approach ensures that:
 * - Each message uses a unique set of encryption and authentication keys
 * - Compromise of one message's keys doesn't affect other messages
 * - The nonce for ChaCha20 is cryptographically derived rather than directly using the message nonce
 *
 * @param conversation_key - 32-byte shared secret derived from getSharedSecret
 * @param nonce - 32-byte random nonce, unique for each message
 * @returns Object containing the three derived keys
 */
export function getMessageKeys(
  conversation_key: Uint8Array,
  nonce: Uint8Array,
): {
  chacha_key: Uint8Array;
  chacha_nonce: Uint8Array;
  hmac_key: Uint8Array;
} {
  if (conversation_key.length !== KEY_SIZE) {
    throw new Error(
      `NIP-44: Invalid conversation key length: ${conversation_key.length}`,
    );
  }

  if (nonce.length < NONCE_SIZE_V0) {
    // Assuming V0 has the smallest possible nonce, check against it.
    // This check might need refinement if V0/V1 nonces are smaller and still valid inputs here.
    // However, getMessageKeys is currently only called by encrypt/decrypt which would use version-specific nonce sizes.
    throw new Error(
      `NIP-44: Nonce too short for key derivation. Min expected: ${NONCE_SIZE_V0}, got: ${nonce.length}`,
    );
  }

  // Use HKDF-expand to derive 76 bytes of key material from the conversation key and nonce
  // The nonce length here refers to the input NIP-44 nonce (e.g. 32 bytes for v2)
  // not the derived chacha_nonce (12 bytes)
  const keys = hkdf_expand(sha256, conversation_key, nonce, 76);

  // Split the derived key material into three parts for specific purposes
  return {
    chacha_key: keys.subarray(0, 32), // 32 bytes for ChaCha20 encryption key
    chacha_nonce: keys.subarray(32, 44), // 12 bytes for ChaCha20 nonce
    hmac_key: keys.subarray(44, 76), // 32 bytes for HMAC-SHA256 key
  };
}

/**
 * Generate a random nonce for NIP-44 encryption
 * According to NIP-44 v2 spec, this is a random 32-byte value
 */
export function generateNonce(): Uint8Array {
  return randomBytes(NONCE_SIZE_V2); // Generate nonces for the current version (V2)
}

/**
 * Calculate HMAC with associated data (AAD)
 *
 * This function implements the authentication scheme for NIP-44 v2:
 * 1. It binds the ciphertext to the nonce by using the nonce as "associated data"
 * 2. It concatenates the AAD (nonce) with the message (ciphertext) before HMAC calculation
 * 3. It uses HMAC-SHA256 with the derived hmac_key to produce a 32-byte authentication tag
 *
 * Using AAD provides several security benefits:
 * - Prevents attackers from mixing nonces and ciphertexts from different messages
 * - Ensures the integrity of both the ciphertext and nonce
 * - Authenticates the ciphertext before decryption attempts (preventing oracle attacks)
 *
 * This is a crucial part of the NIP-44 authenticated encryption scheme, as ChaCha20
 * itself does not provide authentication.
 *
 * @param key - 32-byte HMAC key derived from getMessageKeys
 * @param message - The ciphertext to authenticate
 * @param aad - The 32-byte nonce serving as associated data
 * @returns 32-byte authentication tag
 */
export function hmacWithAAD(
  key: Uint8Array,
  message: Uint8Array,
  aad: Uint8Array, // aad is the NIP-44 nonce (e.g. 32 bytes for v2)
): Uint8Array {
  if (aad.length < NONCE_SIZE_V0) {
    // Allow for potentially smaller nonces from older versions.
    // This check needs to be correct for the SMALLEST valid nonce size.
    throw new Error(
      `NIP-44: AAD (nonce) too short. Min expected: ${NONCE_SIZE_V0} bytes, got: ${aad.length}`,
    );
  }

  // Concatenate the nonce (AAD) with the ciphertext, then calculate HMAC-SHA256
  return hmac(sha256, key, concatBytes(aad, message));
}

/**
 * Securely wipe a buffer by overwriting it with random bytes, then zeros
 * This helps prevent sensitive data from remaining in memory
 * 
 * Note: This is a best-effort approach. Modern JavaScript engines and
 * garbage collectors may still leave copies of sensitive data in memory.
 * For maximum security in high-risk environments, consider using
 * dedicated secure memory management libraries.
 * 
 * @param buffer - The buffer to wipe
 */
export function secureWipe(buffer: Uint8Array): void {
  if (buffer.length === 0) return;
  
  try {
    // First overwrite with random data (harder to recover)
    const randomData = randomBytes(buffer.length);
    buffer.set(randomData);
    
    // Then overwrite with zeros
    buffer.fill(0);
    
    // Clear the random data buffer as well
    randomData.fill(0);
  } catch (error) {
    // Fallback: just zero the buffer
    buffer.fill(0);
  }
}

/**
 * Performs a constant-time comparison of two Uint8Arrays
 *
 * This implementation takes several precautions against timing attacks:
 * 1. Always processes all bytes regardless of matches/mismatches
 * 2. Returns a constant (1 or 0) to avoid boolean conversion optimizations
 * 3. Uses bitwise operations which are less susceptible to timing variations
 * 4. Prevents length-based timing attacks with separate length check
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns 1 if arrays are equal, 0 if they're different or have different length
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): number {
  // First check: different lengths mean different content
  // We do this check separately to avoid potential length-based timing attacks
  if (a.length !== b.length) {
    return 0;
  }

  // XOR each byte and OR the results together
  // If any byte is different, the result will be non-zero
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  // Convert to a binary 0 or 1 result (0 = equal, 1 = different)
  // Using this additional step to avoid potential JavaScript VM optimizations
  // around boolean conversions
  result =
    (result |
      (result >>> 1) |
      (result >>> 2) |
      (result >>> 3) |
      (result >>> 4) |
      (result >>> 5) |
      (result >>> 6) |
      (result >>> 7)) &
    1;

  // Invert the result: 1 means equal, 0 means different
  return 1 - result;
}

// Internal function for NIP-44 v2 encryption
function encryptV2(
  plaintext: string,
  privateKey: string,
  publicKey: string,
  nonce?: Uint8Array,
): string {
  // Generate random nonce if not provided
  const nonceBytes = nonce || generateNonce(); // generateNonce uses NONCE_SIZE_V2
  if (nonceBytes.length !== NONCE_SIZE_V2) {
    throw new Error(
      `NIP-44 (v2): Nonce must be ${NONCE_SIZE_V2} bytes, got ${nonceBytes.length}`,
    );
  }

  // Get the conversation key (shared secret)
  const conversation_key = getSharedSecret(privateKey, publicKey);

  // Derive message-specific keys
  const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(
    conversation_key,
    nonceBytes,
  );

  // Apply padding to plaintext
  const padded = pad(plaintext);

  // Encrypt with ChaCha20
  const ciphertext = chacha20(chacha_key, chacha_nonce, padded);

  // Calculate HMAC with nonce as AAD
  const mac = hmacWithAAD(hmac_key, ciphertext, nonceBytes);

  // Combine the version, nonce, ciphertext, and MAC
  const payload = concatBytes(
    new Uint8Array([2]), // Hardcode version 2 for V2 encryption
    nonceBytes,
    ciphertext,
    mac,
  );
  return base64Encode(payload);
}

// Placeholder for NIP-44 v1 encryption -- REMOVED as per NIP-44 spec (MUST NOT encrypt with v1)
/*
function encryptV1(
  plaintext: string,
  privateKey: string,
  publicKey: string,
  nonce?: Uint8Array,
): string {
  // ... (original implementation removed) ...
  throw new Error("NIP-44: Encryption with version 1 is not permitted by the NIP-44 specification.");
}
*/

// Placeholder for NIP-44 v0 encryption -- REMOVED as per NIP-44 spec (MUST NOT encrypt with v0)
/*
function encryptV0(
  plaintext: string,
  privateKey: string,
  publicKey: string,
  nonce?: Uint8Array,
): string {
  // ... (original implementation removed) ...
  throw new Error("NIP-44: Encryption with version 0 is not permitted by the NIP-44 specification.");
}
*/

/**
 * Encrypt a message using NIP-44 v2 (ChaCha20 + HMAC-SHA256)
 *
 * @param plaintext - The message to encrypt
 * @param privateKey - Sender's private key (hex)
 * @param publicKey - Recipient's public key (hex)
 * @param nonce - Optional 32-byte nonce, will be randomly generated if not provided
 * @param options - Optional parameters, e.g., { version: number } to specify NIP-44 version for encryption
 * @returns The encrypted message in the format specified by NIP-44 (base64)
 */
export function encrypt(
  plaintext: string,
  privateKey: string,
  publicKey: string,
  nonce?: Uint8Array, // This nonce is version-specific if a version is also passed in options
  options?: { version?: number },
): string {
  // Validate keys
  if (!isValidPublicKeyPoint(publicKey)) {
    throw new Error(
      "NIP-44: Invalid public key format. Expected 64-character hex string.",
    );
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new Error("NIP-44: Invalid private key format or value.");
  }

  // Default to CURRENT_VERSION but allow override for testing/compatibility
  const versionToEncryptWith = options?.version ?? CURRENT_VERSION;

  // Validate requested version is supported for encryption.
  // NIP-44 spec (versions 0 and 1): "Implementations MUST NOT encrypt with this version."
  // NIP-44 spec (version 2): This is the current and recommended version for encryption.
  if (versionToEncryptWith === 0) {
    throw new Error(
      "NIP-44: Encryption with version 0 is not permitted by the NIP-44 specification. Only decryption is supported for v0.",
    );
  }
  if (versionToEncryptWith === 1) {
    throw new Error(
      "NIP-44: Encryption with version 1 is not permitted by the NIP-44 specification. Only decryption is supported for v1.",
    );
  }
  if (versionToEncryptWith !== CURRENT_VERSION) {
    // Currently CURRENT_VERSION is 2
    // This condition will catch any other non-current versions if CURRENT_VERSION changes
    // or if a version > 2 is somehow passed and not caught by MAX_SUPPORTED_VERSION check.
    throw new Error(
      `NIP-44: Unsupported encryption version: ${versionToEncryptWith}. Only version ${CURRENT_VERSION} is supported for encryption.`,
    );
  }

  // Further check if it's in the decryptable range just in case (MAX_SUPPORTED_VERSION for future extensibility).
  // MIN_SUPPORTED_VERSION for encryption is effectively CURRENT_VERSION due to above checks.
  if (versionToEncryptWith > MAX_SUPPORTED_VERSION) {
    throw new Error(
      `NIP-44: Encryption version ${versionToEncryptWith} is outside the maximum supported range [${MIN_SUPPORTED_VERSION}-${MAX_SUPPORTED_VERSION}].`,
    );
  }

  // At this point, versionToEncryptWith must be CURRENT_VERSION (e.g., 2)
  try {
    if (versionToEncryptWith === 2) {
      // Explicitly check for v2, which is CURRENT_VERSION
      return encryptV2(plaintext, privateKey, publicKey, nonce);
    } else {
      // This path should ideally not be reached due to the extensive checks above.
      // If it is, it indicates an issue with the version validation logic.
      throw new Error(
        `NIP-44: Unexpected encryption version after validation: ${versionToEncryptWith}. Expected ${CURRENT_VERSION}.`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      // If it's already a NIP-44 error, rethrow it
      if (error.message.startsWith("NIP-44:")) {
        throw error;
      }
      throw new Error(
        `NIP-44: Encryption failed (version ${versionToEncryptWith}): ${error.message}`,
      );
    }
    throw new Error(
      `NIP-44: Encryption failed (version ${versionToEncryptWith})`,
    );
  }
}

/**
 * Parse NIP-44 v2 payload into its components
 */
export function decodePayload(payload: string): {
  version: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  mac: Uint8Array;
} {
  // NIP-44 Decryption Step 1: Normalize payload and check for non-base64 encoding (# prefix)
  // Trim whitespace and newlines to prevent bypass of # prefix detection
  const raw = payload.trim();
  if (raw.length > 0 && raw[0] === '#') {
    throw new Error("NIP-44: Unsupported version (non-base64 encoding detected)");
  }

  // NIP-44 Decryption Step 2: Validate base64 payload length bounds
  if (raw.length < MIN_BASE64_PAYLOAD_LENGTH) {
    throw new Error(
      `NIP-44: Invalid ciphertext length. Base64 payload must be between ${MIN_BASE64_PAYLOAD_LENGTH} and ${MAX_BASE64_PAYLOAD_LENGTH} characters, got ${raw.length}.`,
    );
  }
  
  if (raw.length > MAX_BASE64_PAYLOAD_LENGTH) {
    throw new Error(
      `NIP-44: Invalid ciphertext length. Base64 payload must be between ${MIN_BASE64_PAYLOAD_LENGTH} and ${MAX_BASE64_PAYLOAD_LENGTH} characters, got ${raw.length}.`,
    );
  }

  // Decode the base64 payload using the normalized (trimmed) version
  let data: Uint8Array;
  try {
    data = base64Decode(raw);
  } catch (error) {
    // Re-throw the specific error from base64Decode (e.g., alphabet validation)
    if (error instanceof Error && error.message.includes("NIP-44:")) {
      throw error;
    }
    throw new Error("NIP-44: Invalid base64 encoding in ciphertext");
  }

  // Validate decoded payload length bounds
  if (data.length < MIN_DECODED_PAYLOAD_LENGTH) {
    throw new Error(
      `NIP-44: Invalid decoded payload length. Must be between ${MIN_DECODED_PAYLOAD_LENGTH} and ${MAX_DECODED_PAYLOAD_LENGTH} bytes, got ${data.length}.`,
    );
  }
  
  if (data.length > MAX_DECODED_PAYLOAD_LENGTH) {
    throw new Error(
      `NIP-44: Invalid decoded payload length. Must be between ${MIN_DECODED_PAYLOAD_LENGTH} and ${MAX_DECODED_PAYLOAD_LENGTH} bytes, got ${data.length}.`,
    );
  }

  // Extract version byte
  if (data.length < 1) {
    // Should be caught by earlier length check, but good for robustness
    throw new Error(
      `NIP-44: Invalid payload, too short to contain version byte.`,
    );
  }
  const version = data[0];

  // Validate version is in supported range for decryption
  if (version < MIN_SUPPORTED_VERSION || version > MAX_SUPPORTED_VERSION) {
    throw new Error(
      `NIP-44: Unsupported version: ${version}. This implementation supports versions ${MIN_SUPPORTED_VERSION}-${MAX_SUPPORTED_VERSION}.`,
    );
  }

  // Determine nonce and MAC sizes based on version
  const nonceSize =
    version === 0
      ? NONCE_SIZE_V0
      : version === 1
        ? NONCE_SIZE_V1
        : NONCE_SIZE_V2;

  const macSize =
    version === 0 ? MAC_SIZE_V0 : version === 1 ? MAC_SIZE_V1 : MAC_SIZE_V2;

  // Verify minimum payload length for the detected version
  const minVersionedPayloadSize = VERSION_BYTE_SIZE + nonceSize + 1 + macSize; // version + nonce + min_ciphertext (1 byte) + mac
  if (data.length < minVersionedPayloadSize) {
    throw new Error(
      `NIP-44: Payload too short (${data.length} bytes) for version ${version}. Minimum is ${minVersionedPayloadSize} bytes.`,
    );
  }

  // Extract components
  const nonce = data.subarray(VERSION_BYTE_SIZE, VERSION_BYTE_SIZE + nonceSize);
  const mac = data.subarray(data.length - macSize);
  const ciphertext = data.subarray(
    VERSION_BYTE_SIZE + nonceSize,
    data.length - macSize,
  );

  if (ciphertext.length === 0) {
    throw new Error(
      `NIP-44: Ciphertext cannot be empty for version ${version}.`,
    );
  }

  return { version, nonce, ciphertext, mac };
}

// Internal function for NIP-44 v2 decryption
function decryptV2(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  mac: Uint8Array,
  privateKey: string,
  publicKey: string,
): string {
  // Get the conversation key (shared secret)
  const conversation_key = getSharedSecret(privateKey, publicKey);

  // Derive message-specific keys
  const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(
    conversation_key,
    nonce,
  );

  // Verify HMAC
  const calculated_mac = hmacWithAAD(hmac_key, encryptedData, nonce);

  // Use our constant-time comparison function
  const mac_valid = constantTimeEqual(calculated_mac, mac) === 1;

  if (!mac_valid) {
    throw new Error(
      "NIP-44 (v2): Authentication failed. Message may be tampered with or keys are incorrect.",
    );
  }

  // Decrypt with ChaCha20
  const padded = chacha20(chacha_key, chacha_nonce, encryptedData);

  // Remove padding and convert to string
  return unpad(padded);
}

// Placeholder for NIP-44 v1 decryption
// TODO: Implement actual NIP-44 v1 decryption logic
// NIP-44 v1 Decryption: Implementations MUST be able to decrypt this version if they can decrypt v2.
// It is assumed that v1 decryption uses the same underlying crypto as v2, but with version byte 1.
// The primary difference is that the conversation key KDF uses the "nip44-v2" salt,
// as v1 spec for KDF is undefined and NIP-44 mandates v1 decryption.
// NIP-44 (Decryption, point 2) mandates that v1 payloads be decrypted using the same
// algorithms as v2, including the "nip44-v2" KDF salt and 32-byte nonce/MAC.
// This function adheres to that by utilizing decryptV2.
function decryptV1(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  mac: Uint8Array,
  privateKey: string,
  publicKey: string,
): string {
  // For now, V1 uses V2 logic as a placeholder.
  // This needs to be replaced with actual V1 specification if different.
  // The NIP-44 spec says "Implementations MUST be able to decrypt versions 0 and 1"
  // but doesn't detail if their algorithms differ from v2 beyond version byte.
  // Assuming key derivation ("nip44-v2" salt in getSharedSecret) and crypto primitives are the same unless specified.
  // console.warn("NIP-44: decryptV1 is using V2 logic as a placeholder. Verify V1 specification.");
  // NIP-44 specifies using v2 algorithms for v1 decryption.
  try {
    return decryptV2(encryptedData, nonce, mac, privateKey, publicKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes("NIP-44 (v2)")) {
      throw new Error(error.message.replace("NIP-44 (v2)", "NIP-44 (v1)"));
    }
    throw error;
  }
}

// Placeholder for NIP-44 v0 decryption
// TODO: Implement actual NIP-44 v0 decryption logic
// NIP-44 v0 Decryption: Implementations MUST be able to decrypt this version if they can decrypt v2.
// It is assumed that v0 decryption uses the same underlying crypto as v2, but with version byte 0.
// The primary difference is that the conversation key KDF uses the "nip44-v2" salt,
// as v0 spec for KDF is undefined and NIP-44 mandates v0 decryption.
// NIP-44 (Decryption, point 2) mandates that v0 payloads be decrypted using the same
// algorithms as v2, including the "nip44-v2" KDF salt and 32-byte nonce/MAC.
// This function adheres to that by utilizing decryptV2.
function decryptV0(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  mac: Uint8Array,
  privateKey: string,
  publicKey: string,
): string {
  // For now, V0 uses V2 logic as a placeholder.
  // This needs to be replaced with actual V0 specification.
  // There's no official NIP for v0, it was an early experimental version.
  // console.warn("NIP-44: decryptV0 is using V2 logic as a placeholder. Verify V0 specification if possible.");
  // NIP-44 specifies using v2 algorithms for v0 decryption.
  try {
    return decryptV2(encryptedData, nonce, mac, privateKey, publicKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes("NIP-44 (v2)")) {
      throw new Error(error.message.replace("NIP-44 (v2)", "NIP-44 (v0)"));
    }
    throw error;
  }
}

/**
 * Decrypt a message using NIP-44 (ChaCha20 + HMAC-SHA256)
 *
 * @param ciphertext - The encrypted message (base64)
 * @param privateKey - Recipient's private key (hex)
 * @param publicKey - Sender's public key (hex)
 * @returns The decrypted message
 */
export function decrypt(
  ciphertext: string,
  privateKey: string,
  publicKey: string,
): string {
  // Validate keys
  if (!isValidPublicKeyPoint(publicKey)) {
    throw new Error(
      "NIP-44: Invalid public key format. Expected 64-character hex string.",
    );
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new Error("NIP-44: Invalid private key format or value.");
  }

  try {
    // Decode and extract the payload components
    const {
      version,
      nonce,
      ciphertext: encryptedData,
      mac,
    } = decodePayload(ciphertext);

    // Call the appropriate version-specific decrypt function
    if (version === 0) {
      return decryptV0(encryptedData, nonce, mac, privateKey, publicKey);
    } else if (version === 1) {
      return decryptV1(encryptedData, nonce, mac, privateKey, publicKey);
    } else if (version === 2) {
      return decryptV2(encryptedData, nonce, mac, privateKey, publicKey);
    } else {
      // This case should ideally be caught by decodePayload's version check
      throw new Error(`NIP-44: Unexpected version ${version} after decoding.`);
    }
  } catch (error) {
    // Enhance error messages for better debugging
    if (error instanceof Error) {
      if (error.message.startsWith("NIP-44:")) {
        // If it's already a NIP-44 error, rethrow it
        throw error;
      }
      throw new Error(`NIP-44: Failed to decrypt message: ${error.message}`);
    }
    throw new Error("NIP-44: Failed to decrypt message");
  }
}


