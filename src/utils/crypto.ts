import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2";

/**
 * Sign an event with the given private key
 */
export async function signEvent(
  eventId: string,
  privateKey: string,
): Promise<string> {
  const privateKeyBytes = hexToBytes(privateKey);
  const eventIdBytes = hexToBytes(eventId);
  const signatureBytes = await schnorr.sign(eventIdBytes, privateKeyBytes);
  return bytesToHex(signatureBytes);
}

/**
 * Verify the signature of an event
 */
export function verifySignatureSync(
  eventId: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const eventIdBytes = hexToBytes(eventId);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);
    return schnorr.verify(signatureBytes, eventIdBytes, publicKeyBytes);
  } catch (error) {
    console.error("Failed to verify signature:", error);
    return false;
  }
}

export async function verifySignature(
  eventId: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  return verifySignatureSync(eventId, signature, publicKey);
}

/**
 * Generate a keypair for Nostr
 */
export async function generateKeypair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  // Use the library's built-in private key generation
  // This ensures the private key is in the valid range (1 <= privateKey < curve order)
  const privateKey = bytesToHex(schnorr.utils.randomPrivateKey());
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Get the public key from a private key
 */
export function getPublicKey(privateKey: string): string {
  const privateKeyBytes = hexToBytes(privateKey);
  const publicKeyBytes = schnorr.getPublicKey(privateKeyBytes);
  return bytesToHex(publicKeyBytes);
}

// NIP-04 functions have been moved to the dedicated module at src/nip04/index.ts
// For NIP-04 encryption/decryption, please import from '../nip04' instead

/**
 * Compute SHA-256 hash of data
 * @param data The data to hash (string or Uint8Array)
 * @returns The hash as a Uint8Array
 */
export function sha256Hex(data: string | Uint8Array): string {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  }
  return bytesToHex(nobleSha256(data));
}
