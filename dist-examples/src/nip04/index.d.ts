/**
 * Generate a shared secret for NIP-04 encryption
 *
 * "In Nostr, only the X coordinate of the shared point is used as the secret and it is NOT hashed"
 * This is an important detail from the NIP-04 spec.
 */
export declare function getSharedSecret(privateKey: string, publicKey: string): Uint8Array;
/**
 * Encrypt a message for NIP-04 direct messages
 *
 * Implementation follows the NIP-04 specification:
 * - Creates a shared secret using ECDH
 * - Uses AES-256-CBC for encryption
 * - Returns ciphertext with IV in the format: <encrypted_text>?iv=<initialization_vector>
 *
 * WARNING: NIP-04 encryption has known security issues. For better security, use NIP-44.
 */
export declare function encrypt(message: string, privateKey: string, publicKey: string): string;
/**
 * Decrypt a message for NIP-04 direct messages
 *
 * Implementation follows the NIP-04 specification:
 * - Parses the encrypted message in the format: <encrypted_text>?iv=<initialization_vector>
 * - Creates a shared secret using ECDH
 * - Uses AES-256-CBC for decryption
 *
 * WARNING: NIP-04 encryption has known security issues. For better security, use NIP-44.
 */
export declare function decrypt(encryptedMessage: string, privateKey: string, publicKey: string): string;
