// Export client classes
export { Nostr } from "./nip01/nostr";
export { Relay } from "./nip01/relay";
export {
  useWebSocketImplementation,
  resetWebSocketImplementation,
} from "./utils/websocket";
export { RelayPool } from "./nip01/relayPool";

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
} from "./nip01/nostr";

// Export types
export * from "./types/nostr";

// Export utilities
export {
  generateKeypair,
  getPublicKey,
  signEvent,
  verifySignature,
} from "./utils/crypto";

export { getUnixTime } from "./utils/time";

export {
  createEvent,
  createAddressableEvent,
  getEventHash,
} from "./nip01/event";

// Export NIP-02 utilities
export {
  createContactListEvent,
  parseContactsFromEvent,
  parseContactsFromEventWithWarnings,
  Contact,
  ContactListEvent,
  ParseContactsResult,
  ParseWarning,
  Logger,
} from "./nip02";

// Export NIP-04 utilities
export {
  encrypt as encryptNIP04,
  decrypt as decryptNIP04,
  getSharedSecret as getNIP04SharedSecret,
} from "./nip04";

// Export NIP-11 utilities
export {
  fetchRelayInformation,
  supportsNIP11,
  relaySupportsNIPs,
  getRelayPaymentInfo,
  relayRequiresPayment,
  useFetchImplementation,
  clearRelayInfoCache,
} from "./nip11";
export { fetchRelayInformation as getRelayInfo } from "./nip11";

// Export NIP-11 types
export type {
  RelayInfo,
  RelayLimitation,
  RelayFees,
  FeeSchedule,
} from "./nip11";

// Export NIP-44 utilities
export {
  encrypt as encryptNIP44,
  decrypt as decryptNIP44,
  generateNonce as generateNIP44Nonce,
  getSharedSecret as getNIP44SharedSecret,
  constantTimeEqual as constantTimeEqual,
  secureWipe as secureWipeNIP44,
} from "./nip44";

// Export NIP-17 utilities
export {
  createDirectMessage,
  decryptDirectMessage,
  DM_KIND,
  FILE_KIND,
  GIFT_WRAP_KIND,
  SEAL_KIND,
  initializeCrypto as initializeNIP17Crypto,
} from "./nip17";

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

  // Enums
  Prefix,
  TLVType,

  // Security helpers
  filterProfile,
  filterEvent,
  filterAddress,
  filterEntity,
  isValidRelayUrl,

  // Supporting types
  HexString,
  Bech32String,
  RelayUrl,
  TLVEntry,
  Bech32Result,
  Bech32BytesResult,
  SimpleBech32Result,
  DecodedEntity,
  Bech32Options,
  SecurityOptions,
} from "./nip19";

// Export NIP-21 utilities
export { encodeNostrURI, decodeNostrURI, NOSTR_URI_PREFIX } from "./nip21";

// Export NIP-05 utilities
export {
  verifyNIP05,
  lookupNIP05,
  getNIP05PubKey,
  getNIP05Relays,
} from "./nip05";

// Export NIP-07 utilities
export {
  hasNip07Support,
  getPublicKey as getNip07PublicKey,
  signEvent as signEventWithNip07,
  encryptNip04 as encryptNip04WithExtension,
  decryptNip04 as decryptNip04WithExtension,
  encryptNip44 as encryptNip44WithExtension,
  decryptNip44 as decryptNip44WithExtension,
} from "./nip07";
export * from "./nip07/ambient";

// Export NIP-09 utilities
export {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from "./nip09";

// Export NIP-10 utilities
export {
  createReplyTags,
  createQuoteTag,
  parseThreadReferences,
  ThreadPointer,
  ThreadReferences,
} from "./nip10";

// Export NIP-07 adapter
export { Nip07Nostr } from "./nip07/adapter";

// Export NIP-46 utilities
export {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerClient,
  NostrRemoteSignerBunker,
  NIP46Method,
  NIP46Request,
  NIP46Response,
  NIP46ClientOptions,
  NIP46BunkerOptions,
  NIP46Metadata,
} from "./nip46/index";
export { isValidAuthUrl } from "./nip46/utils/auth";

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
} from "./nip57";

export {
  NostrZapClient,
  ZapClient,
  ZapClientOptions,
  ZapInvoiceResult,
  ZapFilterOptions,
} from "./nip57/client";

export {
  fetchLnurlPayMetadata,
  supportsNostrZaps,
  decodeLnurl,
  buildZapCallbackUrl,
  extractLnurlMetadata,
  parseBolt11Invoice,
} from "./nip57/utils";

// NIP-47: Nostr Wallet Connect
export {
  // Client implementation
  NostrWalletConnectClient,
  parseNWCURL,
  generateNWCURL,

  // Service implementation
  NostrWalletService,
  NostrWalletServiceOptions,
  WalletImplementation,

  // Types
  NIP47Method,
  NIP47EventKind,
  NIP47Request,
  NIP47Response,
  NIP47Error,
  NIP47ErrorCode,
  NIP47Notification,
  NIP47NotificationType,
  NIP47Transaction,
  NIP47ConnectionOptions,
  TransactionType,
  NIP47EncryptionScheme,
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
} from "./nip47";

// NIP-50 search utilities
export { createSearchFilter } from "./nip50";

// NIP-65: Relay List Metadata
export {
  createRelayListEvent,
  parseRelayList,
  getReadRelays,
  getWriteRelays,
  RELAY_LIST_KIND,
  RelayListEntry,
  RelayListEvent,
} from "./nip65";

// NIP-66: Relay Discovery and Liveness Monitoring
export {
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
} from "./nip66";

// Deprecated alias for backward compatibility
import { initializeCrypto as initializeNIP17CryptoImport } from "./nip17";
/**
 * @deprecated Use initializeNIP17Crypto instead. This alias will be removed in the next major version.
 */
export const initializeCrypto = initializeNIP17CryptoImport;
