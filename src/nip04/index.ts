import { schnorr } from "@noble/curves/secp256k1";
import { secp256k1 } from "@noble/curves/secp256k1";
import { randomBytes } from "@noble/hashes/utils";

/**
 * Generate a shared secret for NIP-04 encryption
 *
 * "In Nostr, only the X coordinate of the shared point is used as the secret and it is NOT hashed"
 * This is an important detail from the NIP-04 spec.
 */
export function getSharedSecret(
  privateKey: string,
  publicKey: string,
): Uint8Array {
  // IMPORTANT: Convert public key to a full form that secp256k1 expects
  // The public key provided by Nostr is just the x-coordinate (32 bytes hex)
  // For secp256k1.getSharedSecret we need a compressed public key format (33 bytes)
  // which starts with "02" prefix, indicating a point on the curve with even y-coordinate
  const compressedPubkey = "02" + publicKey;

  // Get the shared point
  const sharedPoint = secp256k1.getSharedSecret(privateKey, compressedPubkey);

  // According to NIP-04 spec: "only the X coordinate of the shared point is used as the secret and it is NOT hashed"
  // The first byte of the sharedPoint is a format prefix, so we skip it and take only the X coordinate (32 bytes)
  return sharedPoint.subarray(1, 33);
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
  message: string,
  privateKey: string,
  publicKey: string,
): string {
  try {
    // Node.js crypto is required for AES-CBC encryption
    const crypto = require("crypto");

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
  encryptedMessage: string,
  privateKey: string,
  publicKey: string,
): string {
  try {
    // Node.js crypto is required for AES-CBC decryption
    const crypto = require("crypto");

    // Parse the NIP-04 format: "<encrypted_text>?iv=<initialization_vector>"
    const parts = encryptedMessage.split("?iv=");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted message format");
    }

    const encryptedText = parts[0];
    const ivBase64 = parts[1];

    // Decode the base64 IV
    const iv = Buffer.from(ivBase64, "base64");

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
    console.error("Failed to decrypt message:", error);
    throw new Error("Failed to decrypt message");
  }
}
