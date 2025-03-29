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

/**
 * Generate a shared secret for NIP-04 encryption
 * 
 * "In Nostr, only the X coordinate of the shared point is used as the secret and it is NOT hashed"
 * This is an important detail from the NIP-04 spec.
 */
export function getSharedSecret(privateKey: string, publicKey: string): Uint8Array {
  // IMPORTANT: Convert public key to a full form that secp256k1 expects
  // The public key provided by Nostr is just the x-coordinate (32 bytes hex)
  // For secp256k1.getSharedSecret we need a compressed public key format (33 bytes)
  // which starts with "02" prefix, indicating a point on the curve with even y-coordinate
  const compressedPubkey = '02' + publicKey;
  
  // Get the shared point
  const sharedPoint = secp256k1.getSharedSecret(privateKey, compressedPubkey);
  
  // According to NIP-04 spec: "only the X coordinate of the shared point is used as the secret and it is NOT hashed"
  // The first byte of the sharedPoint is a format prefix, so we skip it and take only the X coordinate (32 bytes)
  return sharedPoint.subarray(1, 33);
}

/**
 * Encrypt a message for NIP-04 direct messages
 * 
 * Implementation follows the NIP-04 specification
 */
export function encryptMessage(
  message: string,
  privateKey: string,
  publicKey: string
): string {
  try {
    // Node.js crypto is required for AES-CBC encryption
    const crypto = require('crypto');
    
    // Get shared secret (X coordinate of the shared point)
    const sharedX = getSharedSecret(privateKey, publicKey);
    
    // Generate random 16-byte IV
    const iv = randomBytes(16);
    
    // Create AES-256-CBC cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(sharedX), Buffer.from(iv));
    
    // Encrypt the message
    let encryptedMessage = cipher.update(message, 'utf8', 'base64');
    encryptedMessage += cipher.final('base64');
    
    // Format as specified in NIP-04: "<encrypted_text>?iv=<initialization_vector>"
    const ivBase64 = Buffer.from(iv).toString('base64');
    
    return `${encryptedMessage}?iv=${ivBase64}`;
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    throw error;
  }
}

/**
 * Decrypt a message for NIP-04 direct messages
 */
export function decryptMessage(
  encryptedMessage: string,
  privateKey: string,
  publicKey: string
): string {
  try {
    // Node.js crypto is required for AES-CBC decryption
    const crypto = require('crypto');
    
    // Parse the NIP-04 format: "<encrypted_text>?iv=<initialization_vector>"
    const parts = encryptedMessage.split('?iv=');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted message format');
    }
    
    const encryptedText = parts[0];
    const ivBase64 = parts[1];
    
    // Decode the base64 IV
    const iv = Buffer.from(ivBase64, 'base64');
    
    // Get shared secret (X coordinate of the shared point)
    const sharedX = getSharedSecret(privateKey, publicKey);
    
    // Create AES-256-CBC decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(sharedX), iv);
    
    // Decrypt the message
    let decryptedMessage = decipher.update(encryptedText, 'base64', 'utf8');
    decryptedMessage += decipher.final('utf8');
    
    return decryptedMessage;
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw new Error('Failed to decrypt message');
  }
} 