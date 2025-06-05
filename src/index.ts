// Export client classes
export { Nostr } from "./nip01/nostr";
export { Relay } from "./nip01/relay";

// Export types from nip01/nostr.ts (Callback types)
export type {
  NostrConnectCallback,
  NostrErrorCallback,
  NostrNoticeCallback,
  NostrOkCallback,
  NostrClosedCallback,
  NostrAuthCallback,
  NostrEventCallback,
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

export {
  createEvent,
  createAddressableEvent,
  getEventHash,
} from "./nip01/event";

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
} from "./nip44";

// Export NIP-17 utilities
export {
  createDirectMessage,
  decryptDirectMessage,
  DM_KIND,
  FILE_KIND,
  GIFT_WRAP_KIND,
  SEAL_KIND,
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
} from "./nip19";

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

// Export NIP-09 utilities
export {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from "./nip09";

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
} from "./nip47";

// NIP-65: Relay List Metadata
export { createRelayListEvent, parseRelayList, getReadRelays, getWriteRelays, RELAY_LIST_KIND, RelayListEntry, RelayListEvent } from "./nip65";

// NIP-66: Relay Discovery and Liveness Monitoring
export {
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
} from "./nip66";
