import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
import { EventTemplate, NostrEvent } from "../types/nostr";
import { hmac } from "@noble/hashes/hmac";
import { concatBytes, utf8ToBytes } from "@noble/hashes/utils";
import { createHash } from "crypto";

async function sha256Hash(data: string): Promise<string> {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compute the event ID from the event data
 */
export async function getEventHash(
  event: Omit<NostrEvent, "id" | "sig">,
): Promise<string> {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  return await sha256Hash(serialized);
}

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
export async function verifySignature(
  eventId: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const eventIdBytes = hexToBytes(eventId);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);
    return await schnorr.verify(signatureBytes, eventIdBytes, publicKeyBytes);
  } catch (error) {
    console.error("Failed to verify signature:", error);
    return false;
  }
}

/**
 * Generate a keypair for Nostr
 */
export async function generateKeypair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKeyBytes = randomBytes(32);
  const privateKey = bytesToHex(privateKeyBytes);
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

export function sha256(data: string | Uint8Array): Uint8Array {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  }
  return nobleSha256(data);
}

export function sha256Hex(data: string | Uint8Array): string {
  return bytesToHex(sha256(data));
}
