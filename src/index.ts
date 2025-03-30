// Export client classes
export { Nostr } from './client/nostr';
export { Relay } from './client/relay';

// Export types
export * from './types/nostr';

// Export utilities
export { 
  generateKeypair, 
  getPublicKey, 
  signEvent, 
  verifySignature, 
  encryptMessage, 
  decryptMessage 
} from './utils/crypto';

export { createEvent } from './utils/event';

// Export NIP-44 utilities
export { 
  encrypt as encryptNIP44, 
  decrypt as decryptNIP44, 
  generateNonce as generateNIP44Nonce,
  getSharedSecret as getNIP44SharedSecret
} from './nip44'; 