import { schnorr } from '@noble/curves/secp256k1';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { EventTemplate, NostrEvent } from '../types/nostr';
import { hmac } from '@noble/hashes/hmac';
import { bytesToHex, hexToBytes, concatBytes, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Compute the event ID from the event data
 */
export function getEventHash(event: Omit<NostrEvent, 'id' | 'sig'>): string {
  const eventData = [
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ];

  const serialized = JSON.stringify(eventData);
  const hashBytes = sha256(new TextEncoder().encode(serialized));
  return Buffer.from(hashBytes).toString('hex');
}

/**
 * Sign an event with the given private key
 */
export async function signEvent(
  event: Omit<NostrEvent, 'sig'>,
  privateKey: string
): Promise<NostrEvent> {
  const eventHash = getEventHash(event);
  const signatureBytes = await schnorr.sign(
    eventHash,
    privateKey
  );
  const signature = Buffer.from(signatureBytes).toString('hex');

  return {
    ...event,
    sig: signature,
  };
}

/**
 * Verify the signature of an event
 */
export async function verifySignature(event: NostrEvent): Promise<boolean> {
  try {
    const eventHash = getEventHash(event);
    return await schnorr.verify(
      event.sig,
      eventHash,
      event.pubkey
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generate a keypair for Nostr
 */
export async function generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const privateKeyBytes = randomBytes(32);
  const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
  const publicKeyBytes = schnorr.getPublicKey(privateKeyHex);
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  return {
    privateKey: privateKeyHex,
    publicKey: publicKeyHex,
  };
}

/**
 * Get the public key from a private key
 */
export function getPublicKey(privateKey: string): string {
  const publicKeyBytes = schnorr.getPublicKey(privateKey);
  return Buffer.from(publicKeyBytes).toString('hex');
}

// NIP-04 functions have been moved to the dedicated module at src/nip04/index.ts
// For NIP-04 encryption/decryption, please import from '../nip04' instead 