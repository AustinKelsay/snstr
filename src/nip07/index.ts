import { NostrEvent } from '../types/nostr';

/**
 * Interface for the window.nostr extension API as defined in NIP-07
 */
export interface NostrWindow {
  getPublicKey(): Promise<string>;
  signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent>;
  
  // Optional encryption methods
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  
  // Optional NIP-44 encryption methods
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

/**
 * Safe access to the browser's nostr object
 */
function getNostr(): NostrWindow | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as any).nostr as NostrWindow | undefined;
}

/**
 * Checks if the browser has the NIP-07 extension available
 */
export const hasNip07Support = (): boolean => {
  return typeof window !== 'undefined' && !!getNostr();
};

/**
 * Gets the public key from the NIP-07 extension
 * @returns The public key in hex format
 * @throws Error if NIP-07 is not supported or fails
 */
export const getPublicKey = async (): Promise<string> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr) {
    throw new Error('NIP-07 extension not available');
  }
  
  try {
    return await nostr.getPublicKey();
  } catch (error) {
    throw new Error(`Failed to get public key from NIP-07 extension: ${error}`);
  }
};

/**
 * Signs an event using the NIP-07 extension
 * @param event Event to sign (without id, pubkey, sig)
 * @returns Signed event with id, pubkey, and sig fields added
 * @throws Error if NIP-07 is not supported or fails
 */
export const signEvent = async (
  event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>
): Promise<NostrEvent> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr) {
    throw new Error('NIP-07 extension not available');
  }
  
  try {
    return await nostr.signEvent(event);
  } catch (error) {
    throw new Error(`Failed to sign event with NIP-07 extension: ${error}`);
  }
};

/**
 * Encrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
export const encryptNip04 = async (
  pubkey: string,
  plaintext: string
): Promise<string> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr?.nip04?.encrypt) {
    throw new Error('NIP-04 encryption not supported by the extension');
  }
  
  try {
    return await nostr.nip04.encrypt(pubkey, plaintext);
  } catch (error) {
    throw new Error(`Failed to encrypt message with NIP-04: ${error}`);
  }
};

/**
 * Decrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
export const decryptNip04 = async (
  pubkey: string,
  ciphertext: string
): Promise<string> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr?.nip04?.decrypt) {
    throw new Error('NIP-04 decryption not supported by the extension');
  }
  
  try {
    return await nostr.nip04.decrypt(pubkey, ciphertext);
  } catch (error) {
    throw new Error(`Failed to decrypt message with NIP-04: ${error}`);
  }
};

/**
 * Encrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
export const encryptNip44 = async (
  pubkey: string,
  plaintext: string
): Promise<string> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr?.nip44?.encrypt) {
    throw new Error('NIP-44 encryption not supported by the extension');
  }
  
  try {
    return await nostr.nip44.encrypt(pubkey, plaintext);
  } catch (error) {
    throw new Error(`Failed to encrypt message with NIP-44: ${error}`);
  }
};

/**
 * Decrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
export const decryptNip44 = async (
  pubkey: string,
  ciphertext: string
): Promise<string> => {
  if (!hasNip07Support()) {
    throw new Error('NIP-07 extension not available');
  }
  
  const nostr = getNostr();
  if (!nostr?.nip44?.decrypt) {
    throw new Error('NIP-44 decryption not supported by the extension');
  }
  
  try {
    return await nostr.nip44.decrypt(pubkey, ciphertext);
  } catch (error) {
    throw new Error(`Failed to decrypt message with NIP-44: ${error}`);
  }
}; 