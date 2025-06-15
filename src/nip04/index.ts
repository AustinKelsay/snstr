import { hexToBytes, randomBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";
import * as crypto from "crypto";

/**
 * NIP-04: Encrypted Direct Message
 *
 * Implementation of NIP-04 for encrypted direct messaging.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/04.md
 */

/**
 * Error class for NIP-04 decryption failures
 */
export class NIP04DecryptionError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "NIP04DecryptionError";
    this.originalError = originalError;
  }
}

/**
 * Derives a shared secret for NIP-04 encryption/decryption using ECDH
 *
 * @param privateKey - The private key as a hex string
 * @param publicKey - The public key as a hex string (without the 02 prefix)
 * @returns Uint8Array containing the derived shared secret
 */
export function getSharedSecret(
  privateKey: string,
  publicKey: string,
): Uint8Array {
  const privateKeyBytes = hexToBytes(privateKey);
  const publicKeyBytes = hexToBytes("02" + publicKey);

  // Generate ECDH shared point
  const sharedPoint = secp256k1.getSharedSecret(
    privateKeyBytes,
    publicKeyBytes,
  );

  // Extract x-coordinate only (slice off the first byte which is a prefix)
  const sharedX = sharedPoint.slice(1, 33);

  // NIP-04 specifies using the raw 32-byte x-coordinate itself as the key.
  return sharedX;
}

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
export function encrypt(
  privateKey: string,
  publicKey: string,
  message: string,
): string {
  try {
    // Get shared secret (X coordinate of the shared point)
    const sharedX = getSharedSecret(privateKey, publicKey);

    // Generate random 16-byte IV
    const iv = randomBytes(16);

    // Create AES-256-CBC cipher
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(sharedX),
      Buffer.from(iv),
    );

    // Encrypt the message
    let encryptedMessage = cipher.update(message, "utf8", "base64");
    encryptedMessage += cipher.final("base64");

    // Format as specified in NIP-04: "<encrypted_text>?iv=<initialization_vector>"
    const ivBase64 = Buffer.from(iv).toString("base64");

    return `${encryptedMessage}?iv=${ivBase64}`;
  } catch (error) {
    console.error("Failed to encrypt message:", error);
    throw error;
  }
}

/**
 * Check if a string is valid base64
 */
function isValidBase64(str: string): boolean {
  try {
    return Buffer.from(str, "base64").toString("base64") === str;
  } catch {
    return false;
  }
}

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
export function decrypt(
  privateKey: string,
  publicKey: string,
  encryptedMessage: string,
): string {
  try {
    // Validate input is a string
    if (typeof encryptedMessage !== "string") {
      throw new NIP04DecryptionError(
        "Invalid encrypted message: must be a string",
      );
    }

    // Check if the message follows the NIP-04 format with IV
    if (!encryptedMessage.includes("?iv=")) {
      throw new NIP04DecryptionError(
        "Invalid encrypted message format: missing IV separator",
      );
    }

    // Parse the NIP-04 format: "<encrypted_text>?iv=<initialization_vector>"
    const parts = encryptedMessage.split("?iv=");
    if (parts.length !== 2) {
      throw new NIP04DecryptionError(
        "Invalid encrypted message format: multiple IV separators found",
      );
    }

    const [encryptedText, ivBase64] = parts;

    // Validate both parts are non-empty
    if (!encryptedText || !ivBase64) {
      throw new NIP04DecryptionError(
        "Invalid encrypted message format: empty ciphertext or IV",
      );
    }

    // Validate both parts are valid base64
    if (!isValidBase64(encryptedText)) {
      throw new NIP04DecryptionError(
        "Invalid encrypted message: ciphertext is not valid base64",
      );
    }

    if (!isValidBase64(ivBase64)) {
      throw new NIP04DecryptionError(
        "Invalid encrypted message: IV is not valid base64",
      );
    }

    // Decode the base64 IV
    const iv = Buffer.from(ivBase64, "base64");

    // Validate IV length
    if (iv.length !== 16) {
      throw new NIP04DecryptionError(
        `Invalid IV length: expected 16 bytes, got ${iv.length}`,
      );
    }

    // Get shared secret (X coordinate of the shared point)
    const sharedX = getSharedSecret(privateKey, publicKey);

    // Create AES-256-CBC decipher
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(sharedX),
      iv,
    );

    // Decrypt the message
    let decryptedMessage = decipher.update(encryptedText, "base64", "utf8");
    decryptedMessage += decipher.final("utf8");

    return decryptedMessage;
  } catch (error) {
    // If it's already a NIP04DecryptionError, just pass it through
    if (error instanceof NIP04DecryptionError) {
      throw error;
    }

    console.error("Failed to decrypt message:", error);
    throw new NIP04DecryptionError("Failed to decrypt message");
  }
}
