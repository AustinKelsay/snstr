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
  verifySignature
} from './utils/crypto';

export { createEvent } from './utils/event';

// Export NIP-04 utilities
export {
  encrypt as encryptNIP04,
  decrypt as decryptNIP04,
  getSharedSecret as getNIP04SharedSecret
} from './nip04';

// For backward compatibility
import { encrypt, decrypt } from './nip04';
export const encryptMessage = encrypt;
export const decryptMessage = decrypt;

// Export NIP-44 utilities
export { 
  encrypt as encryptNIP44, 
  decrypt as decryptNIP44, 
  generateNonce as generateNIP44Nonce,
  getSharedSecret as getNIP44SharedSecret
} from './nip44'; 

// Export NIP-19 utilities
export {
  // Core encoding/decoding functions
  encodeBech32,
  decodeBech32,
  decode,
  
  // Public key (npub)
  encodePublicKey,
  decodePublicKey,
  
  // Private key (nsec)
  encodePrivateKey,
  decodePrivateKey,
  
  // Note ID (note)
  encodeNoteId,
  decodeNoteId,
  
  // Profile (nprofile)
  encodeProfile,
  decodeProfile,
  ProfileData,
  
  // Event (nevent)
  encodeEvent,
  decodeEvent,
  EventData,
  
  // Address (naddr)
  encodeAddress,
  decodeAddress,
  AddressData,
  
  // Relay (nrelay) - deprecated
  encodeRelay,
  decodeRelay,
  RelayData,
  
  // Enums
  Prefix,
  TLVType
} from './nip19'; 