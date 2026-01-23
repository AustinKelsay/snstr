// Web / React Native entry: excludes Node-only NIP-04 and re-exports a stub.
// This prevents Metro/Expo from pulling Node's `crypto` module.

// Export client classes
export { Nostr } from "../nip01/nostr";
export { Relay } from "../nip01/relay";
export {
  useWebSocketImplementation,
  resetWebSocketImplementation,
} from "../utils/websocket";
export { RelayPool } from "../nip01/relayPool";

// Export types from nip01/nostr.ts (Callback types and configuration)
export type {
  NostrConnectCallback,
  NostrErrorCallback,
  NostrNoticeCallback,
  NostrOkCallback,
  NostrClosedCallback,
  NostrAuthCallback,
  NostrEventCallback,
  RateLimitConfig,
  NostrRateLimits,
  NostrOptions,
} from "../nip01/nostr";

// Export types
export * from "../types/nostr";

// Export utilities
export {
  generateKeypair,
  getPublicKey,
  signEvent,
  verifySignature,
} from "../utils/crypto";

export { getUnixTime } from "../utils/time";

export {
  createEvent,
  createAddressableEvent,
  getEventHash,
} from "../nip01/event";

// Export NIP-02 utilities
export {
  createContactListEvent,
  parseContactsFromEvent,
  parseContactsFromEventWithWarnings,
} from "../nip02";
export type {
  Contact,
  ContactListEvent,
  ParseContactsResult,
  ParseWarning,
  Logger,
} from "../nip02";

// Export NIP-04 web/RN implementation (crypto-js AES-CBC)
export {
  encrypt as encryptNIP04,
  decrypt as decryptNIP04,
  getSharedSecret as getNIP04SharedSecret,
  initializeCrypto as initializeNIP04Crypto,
} from "../nip04/web";

// Export NIP-11 utilities
export {
  fetchRelayInformation,
  supportsNIP11,
  relaySupportsNIPs,
  getRelayPaymentInfo,
  relayRequiresPayment,
} from "../nip11";

// Export NIP-11 types
export type {
  RelayInfo,
  RelayLimitation,
  RelayFees,
  FeeSchedule,
} from "../nip11";

// Export NIP-44 utilities
export {
  encrypt as encryptNIP44,
  decrypt as decryptNIP44,
  generateNonce as generateNIP44Nonce,
  getSharedSecret as getNIP44SharedSecret,
  constantTimeEqual as constantTimeEqual,
  secureWipe as secureWipeNIP44,
} from "../nip44";

// Export NIP-17 utilities
export {
  createDirectMessage,
  decryptDirectMessage,
  DM_KIND,
  FILE_KIND,
  GIFT_WRAP_KIND,
  SEAL_KIND,
  initializeCrypto as initializeNIP17Crypto,
} from "../nip17";

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
  // types re-exported separately below

  // Event (nevent)
  encodeEvent,
  decodeEvent,
  // types re-exported separately below

  // Address (naddr)
  encodeAddress,
  decodeAddress,
  // types re-exported separately below

  // Other helpers

  // Enums
  Prefix,
  TLVType,
} from "../nip19";
export type { ProfileData, EventData, AddressData } from "../nip19";

// Export NIP-21 utilities
export { encodeNostrURI, decodeNostrURI, NOSTR_URI_PREFIX } from "../nip21";

// Export NIP-05 utilities
export {
  verifyNIP05,
  lookupNIP05,
  getNIP05PubKey,
  getNIP05Relays,
} from "../nip05";

// Export NIP-07 utilities
export {
  hasNip07Support,
  getPublicKey as getNip07PublicKey,
  signEvent as signEventWithNip07,
  encryptNip04 as encryptNip04WithExtension,
  decryptNip04 as decryptNip04WithExtension,
  encryptNip44 as encryptNip44WithExtension,
  decryptNip44 as decryptNip44WithExtension,
} from "../nip07";

// Export NIP-09 utilities
export {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from "../nip09";

// Export NIP-10 utilities
export {
  createReplyTags,
  createQuoteTag,
  parseThreadReferences,
  ThreadPointer,
  ThreadReferences,
} from "../nip10";

// Export NIP-07 adapter
export { Nip07Nostr } from "../nip07/adapter";

// NIP-46 utilities are Node-oriented; omit from RN/web entry to reduce bundle size
// Consumers can import platform-appropriate implementations directly if needed.

// NIP-57: Lightning Zaps
export {
  createZapRequest,
  createZapReceipt,
  validateZapReceipt,
  parseZapSplit,
  calculateZapSplitAmounts,
  ZAP_REQUEST_KIND,
  ZAP_RECEIPT_KIND,
  ZapRequestOptions,
  ZapReceiptOptions,
  ZapValidationResult,
  LnurlPayResponse,
  LnurlSuccessAction,
  LnurlInvoiceResponse,
  ZapStats,
} from "../nip57";

export {
  NostrZapClient,
  ZapClient,
  ZapClientOptions,
  ZapInvoiceResult,
  ZapFilterOptions,
} from "../nip57/client";

export {
  fetchLnurlPayMetadata,
  supportsNostrZaps,
  decodeLnurl,
  buildZapCallbackUrl,
  extractLnurlMetadata,
  parseBolt11Invoice,
} from "../nip57/utils";

// NIP-47 is Node-leaning and may pull NIP-04; omit from RN/web entry.

// NIP-50 search utilities
export { createSearchFilter } from "../nip50";
