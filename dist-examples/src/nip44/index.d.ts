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
export declare function getSharedSecret(privateKey: string, publicKey: string): Uint8Array;
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
export declare function getMessageKeys(conversation_key: Uint8Array, nonce: Uint8Array): {
    chacha_key: Uint8Array;
    chacha_nonce: Uint8Array;
    hmac_key: Uint8Array;
};
/**
 * Generate a random nonce for NIP-44 encryption
 * According to NIP-44 v2 spec, this is a random 32-byte value
 */
export declare function generateNonce(): Uint8Array;
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
export declare function hmacWithAAD(key: Uint8Array, message: Uint8Array, aad: Uint8Array): Uint8Array;
/**
 * Encrypt a message using NIP-44 v2 (ChaCha20 + HMAC-SHA256)
 *
 * @param plaintext - The message to encrypt
 * @param privateKey - Sender's private key (hex)
 * @param publicKey - Recipient's public key (hex)
 * @param nonce - Optional 32-byte nonce, will be randomly generated if not provided
 * @returns The encrypted message in the format specified by NIP-44 (base64)
 */
export declare function encrypt(plaintext: string, privateKey: string, publicKey: string, nonce?: Uint8Array): string;
/**
 * Parse NIP-44 v2 payload into its components
 */
export declare function decodePayload(payload: string): {
    version: number;
    nonce: Uint8Array;
    ciphertext: Uint8Array;
    mac: Uint8Array;
};
/**
 * Decrypt a message using NIP-44 v2 (ChaCha20 + HMAC-SHA256)
 *
 * @param ciphertext - The encrypted message (base64)
 * @param privateKey - Recipient's private key (hex)
 * @param publicKey - Sender's public key (hex)
 * @returns The decrypted message
 */
export declare function decrypt(ciphertext: string, privateKey: string, publicKey: string): string;
