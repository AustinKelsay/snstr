import { randomBytes, utf8ToBytes, hexToBytes, concatBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { extract as hkdf_extract, expand as hkdf_expand } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { secp256k1 } from '@noble/curves/secp256k1';
import { chacha20 } from '@noble/ciphers/chacha';

// NIP-44 constants as specified in https://github.com/nostr-protocol/nips/blob/master/44.md
const VERSION = 2;
const NONCE_SIZE = 32; // NIP-44 v2 uses 32-byte nonce
const KEY_SIZE = 32; // 32-byte key for ChaCha20
const MAC_SIZE = 32; // HMAC-SHA256 produces 32-byte tags
const MIN_PLAINTEXT_SIZE = 1;
const MAX_PLAINTEXT_SIZE = 65535; // 64KB - 1

// Payload format constants
const VERSION_BYTE_SIZE = 1;
const MIN_CIPHERTEXT_SIZE = VERSION_BYTE_SIZE + NONCE_SIZE + 1; // Version + nonce + at least 1 byte
const MIN_PAYLOAD_SIZE = MIN_CIPHERTEXT_SIZE + MAC_SIZE;
const MIN_BASE64_LENGTH = Math.ceil(MIN_PAYLOAD_SIZE * 4 / 3); // Minimum valid base64 length

// Conversion utilities
function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64Decode(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
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
  
  const nextPower = 1 << Math.floor(Math.log2(unpadded_len - 1) + 1);
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
    throw new Error(`NIP-44: Invalid plaintext length: ${unpadded_len}. Must be between ${MIN_PLAINTEXT_SIZE} and ${MAX_PLAINTEXT_SIZE}.`);
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
    throw new Error('NIP-44: Padded data too short to contain length prefix');
  }
  
  // Get length from first two bytes (big-endian uint16)
  const unpadded_len = (padded[0] << 8) | padded[1];
  
  // Validate the claimed unpadded length
  if (unpadded_len < MIN_PLAINTEXT_SIZE || unpadded_len > MAX_PLAINTEXT_SIZE) {
    throw new Error(`NIP-44: Invalid unpadded length in padded data: ${unpadded_len}`);
  }
  
  // Check if padded data is long enough to contain the claimed unpadded data
  if (padded.length < 2 + unpadded_len) {
    throw new Error(`NIP-44: Padded data too short (${padded.length}) to contain claimed unpadded length (${unpadded_len})`);
  }
  
  // Calculate expected padded length based on the claimed unpadded length
  const expected_padded_len = 2 + calcPaddedLen(unpadded_len);
  
  // Verify the total padded length matches what we expect from the padding scheme
  if (padded.length !== expected_padded_len) {
    throw new Error(`NIP-44: Padded length mismatch: ${padded.length} vs expected ${expected_padded_len}`);
  }
  
  // Extract the actual data (skipping the 2-byte length prefix)
  const unpadded = padded.slice(2, 2 + unpadded_len);
  
  // Verify the unpadded slice length matches the claimed length
  if (unpadded.length !== unpadded_len) {
    throw new Error(`NIP-44: Extracted data length (${unpadded.length}) doesn't match claimed length (${unpadded_len})`);
  }
  
  try {
    return new TextDecoder().decode(unpadded);
  } catch (error) {
    throw new Error(`NIP-44: Failed to decode unpadded data: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Validate if a string is a valid hex format public key
 * As per NIP-44 spec, pubkey must be a valid non-zero secp256k1 curve point
 */
function isValidPublicKey(publicKey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(publicKey);
}

/**
 * Validate if a string is a valid hex format private key
 * A valid private key must be a 32-byte hex string with a value less than the curve order
 */
function isValidPrivateKey(privateKey: string): boolean {
  // Check format: must be 64 hex characters
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
export function getSharedSecret(privateKey: string, publicKey: string): Uint8Array {
  // Validate private key - must be a valid scalar (less than curve order)
  if (!isValidPrivateKey(privateKey)) {
    throw new Error('NIP-44: Invalid private key format or value.');
  }
  
  // Validate public key - must be a valid x-coordinate on the curve
  if (!isValidPublicKey(publicKey)) {
    throw new Error('NIP-44: Invalid public key format. Expected 64-character hex string.');
  }
  
  try {
    // For Nostr, we have x-only public keys, so we need to try both possible y-coordinates
    // First, add '02' prefix (even y-coordinate) and try
    let sharedPoint: Uint8Array;
    try {
      sharedPoint = secp256k1.getSharedSecret(privateKey, '02' + publicKey);
    } catch {
      // If that fails, try with '03' prefix (odd y-coordinate)
      try {
        sharedPoint = secp256k1.getSharedSecret(privateKey, '03' + publicKey);
      } catch {
        throw new Error('NIP-44: Invalid public key: not a point on the secp256k1 curve');
      }
    }
    
    // Extract the x-coordinate (first byte is format, next 32 bytes are x-coordinate)
    const shared_x = sharedPoint.subarray(1, 33);
    
    // Use HKDF-extract with SHA-256, with the x-coordinate as IKM and "nip44-v2" as salt
    const salt = utf8ToBytes('nip44-v2');
    
    // Return the 32-byte conversation key
    return hkdf_extract(sha256, shared_x, salt);
  } catch (error) {
    if (error instanceof Error) {
      // If it's already a NIP-44 error, rethrow it
      if (error.message.startsWith('NIP-44:')) {
        throw error;
      }
      throw new Error(`NIP-44: Failed to derive shared secret: ${error.message}`);
    }
    throw new Error('NIP-44: Failed to derive shared secret');
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
export function getMessageKeys(conversation_key: Uint8Array, nonce: Uint8Array): {
  chacha_key: Uint8Array;
  chacha_nonce: Uint8Array;
  hmac_key: Uint8Array;
} {
  if (conversation_key.length !== KEY_SIZE) {
    throw new Error(`NIP-44: Invalid conversation key length: ${conversation_key.length}`);
  }
  
  if (nonce.length !== NONCE_SIZE) {
    throw new Error(`NIP-44: Invalid nonce length: ${nonce.length}`);
  }
  
  // Use HKDF-expand to derive 76 bytes of key material from the conversation key and nonce
  const keys = hkdf_expand(sha256, conversation_key, nonce, 76);
  
  // Split the derived key material into three parts for specific purposes
  return {
    chacha_key: keys.subarray(0, 32),    // 32 bytes for ChaCha20 encryption key
    chacha_nonce: keys.subarray(32, 44), // 12 bytes for ChaCha20 nonce
    hmac_key: keys.subarray(44, 76)      // 32 bytes for HMAC-SHA256 key
  };
}

/**
 * Generate a random nonce for NIP-44 encryption
 * According to NIP-44 v2 spec, this is a random 32-byte value
 */
export function generateNonce(): Uint8Array {
  return randomBytes(NONCE_SIZE);
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
export function hmacWithAAD(key: Uint8Array, message: Uint8Array, aad: Uint8Array): Uint8Array {
  if (aad.length !== NONCE_SIZE) {
    throw new Error(`NIP-44: AAD must be ${NONCE_SIZE} bytes`);
  }
  
  // Concatenate the nonce (AAD) with the ciphertext, then calculate HMAC-SHA256
  return hmac(sha256, key, concatBytes(aad, message));
}

/**
 * Encrypt a message using NIP-44 v2 (ChaCha20 + HMAC-SHA256)
 * 
 * @param plaintext - The message to encrypt
 * @param privateKey - Sender's private key (hex)
 * @param publicKey - Recipient's public key (hex)
 * @param nonce - Optional 32-byte nonce, will be randomly generated if not provided
 * @returns The encrypted message in the format specified by NIP-44 (base64)
 */
export function encrypt(
  plaintext: string,
  privateKey: string,
  publicKey: string,
  nonce?: Uint8Array
): string {
  // Validate keys
  if (!isValidPublicKey(publicKey)) {
    throw new Error('NIP-44: Invalid public key format. Expected 64-character hex string.');
  }
  
  if (!isValidPrivateKey(privateKey)) {
    throw new Error('NIP-44: Invalid private key format or value.');
  }
  
  try {
    // Generate random nonce if not provided
    const nonceBytes = nonce || generateNonce();
    if (nonceBytes.length !== NONCE_SIZE) {
      throw new Error(`NIP-44: Nonce must be ${NONCE_SIZE} bytes`);
    }
    
    // Get the conversation key (shared secret)
    const conversation_key = getSharedSecret(privateKey, publicKey);
    
    // Derive message-specific keys
    const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(conversation_key, nonceBytes);
    
    // Apply padding to plaintext
    const padded = pad(plaintext);
    
    // Encrypt with ChaCha20
    const ciphertext = chacha20(chacha_key, chacha_nonce, padded);
    
    // Calculate HMAC with nonce as AAD
    const mac = hmacWithAAD(hmac_key, ciphertext, nonceBytes);
    
    // Combine the version, nonce, ciphertext, and MAC
    const payload = concatBytes(
      new Uint8Array([VERSION]), // Version byte
      nonceBytes,               // 32-byte nonce
      ciphertext,               // Encrypted padded data
      mac                       // 32-byte HMAC
    );
    
    // Base64 encode the final payload
    return base64Encode(payload);
  } catch (error) {
    if (error instanceof Error) {
      // If it's already a NIP-44 error, rethrow it
      if (error.message.startsWith('NIP-44:')) {
        throw error;
      }
      throw new Error(`NIP-44: Encryption failed: ${error.message}`);
    }
    throw new Error('NIP-44: Encryption failed');
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
  // Basic validation before decoding
  if (payload.length < MIN_BASE64_LENGTH) {
    throw new Error('NIP-44: Invalid ciphertext length');
  }
  
  // Decode the base64 payload
  let data: Uint8Array;
  try {
    data = base64Decode(payload);
  } catch (error) {
    throw new Error('NIP-44: Invalid base64 encoding in ciphertext');
  }
  
  // Basic validation after decoding
  if (data.length < MIN_PAYLOAD_SIZE) {
    throw new Error('NIP-44: Invalid payload size after base64 decoding');
  }
  
  // Extract components
  const version = data[0];
  if (version !== VERSION) {
    throw new Error(`NIP-44: Unsupported version: ${version}. This implementation only supports NIP-44 v2.`);
  }
  
  const nonce = data.slice(1, 1 + NONCE_SIZE);
  const mac = data.slice(data.length - MAC_SIZE);
  const ciphertext = data.slice(1 + NONCE_SIZE, data.length - MAC_SIZE);
  
  return { version, nonce, ciphertext, mac };
}

/**
 * Decrypt a message using NIP-44 v2 (ChaCha20 + HMAC-SHA256)
 * 
 * @param ciphertext - The encrypted message (base64)
 * @param privateKey - Recipient's private key (hex)
 * @param publicKey - Sender's public key (hex)
 * @returns The decrypted message
 */
export function decrypt(
  ciphertext: string,
  privateKey: string,
  publicKey: string
): string {
  // Validate keys
  if (!isValidPublicKey(publicKey)) {
    throw new Error('NIP-44: Invalid public key format. Expected 64-character hex string.');
  }
  
  if (!isValidPrivateKey(privateKey)) {
    throw new Error('NIP-44: Invalid private key format or value.');
  }
  
  try {
    // Decode and extract the payload components
    const { nonce, ciphertext: encryptedData, mac } = decodePayload(ciphertext);
    
    // Get the conversation key (shared secret)
    const conversation_key = getSharedSecret(privateKey, publicKey);
    
    // Derive message-specific keys
    const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(conversation_key, nonce);
    
    // Verify HMAC
    const calculated_mac = hmacWithAAD(hmac_key, encryptedData, nonce);
    
    // Check if MACs match using constant-time comparison to prevent timing attacks
    let mac_valid = true;
    if (calculated_mac.length !== mac.length) {
      mac_valid = false;
    } else {
      // Constant-time comparison - always check all bytes regardless of mismatches
      let result = 0;
      for (let i = 0; i < mac.length; i++) {
        result |= calculated_mac[i] ^ mac[i]; // XOR will be 0 only if bytes are identical
      }
      mac_valid = result === 0;
    }
    
    if (!mac_valid) {
      throw new Error('NIP-44: Authentication failed. Message may be tampered with or keys are incorrect.');
    }
    
    // Decrypt with ChaCha20
    const padded = chacha20(chacha_key, chacha_nonce, encryptedData);
    
    // Remove padding and convert to string
    return unpad(padded);
  } catch (error) {
    // Enhance error messages for better debugging
    if (error instanceof Error) {
      if (error.message.startsWith('NIP-44:')) {
        // If it's already a NIP-44 error, rethrow it
        throw error;
      }
      throw new Error(`NIP-44: Failed to decrypt message: ${error.message}`);
    }
    throw new Error('NIP-44: Failed to decrypt message');
  }
} 