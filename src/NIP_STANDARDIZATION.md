# NIP Implementation Standardization Guide

This document outlines the recommended folder structure and file organization for NIP implementations in the SNSTR library. Following these guidelines will ensure consistency across all NIPs and make the codebase more maintainable.

## Standard Folder Structure

Each NIP implementation should follow this structure:

```
src/nipXX/
├── index.ts       # Main implementation, re-exports
├── types.ts       # Type definitions (if substantial)
├── client.ts      # Client implementation (if applicable)
├── utils.ts       # Helper functions (if applicable)
└── README.md      # Documentation
```

### Special Structure for NIP-01

NIP-01 (core protocol) has a specialized structure due to its foundational nature:

```
src/nip01/
├── event.ts           # Event creation, validation, and utility functions
├── nostr.ts           # Main Nostr client implementation 
├── relay.ts           # Relay connection and subscription management
├── relayPool.ts       # Multi-relay pool management
└── README.md          # Documentation
```

### When to Split Files

- **NIP-01**: Uses its own structure as the foundation of the protocol
- **Small NIPs**: For simple NIPs (like NIP-04, NIP-05, NIP-09, NIP-10, NIP-17, NIP-21), having just `index.ts` and `README.md` is sufficient
- **Medium NIPs**: For NIPs with more functionality (like NIP-02, NIP-11, NIP-19, NIP-44), split into `index.ts`, `types.ts`, and `README.md`
- **Complex NIPs**: For complex NIPs (like NIP-46, NIP-47, NIP-57, NIP-65, NIP-66), use the full structure with additional files as needed

## File Contents Guidelines

### index.ts

- Start with a JSDoc comment describing the NIP
- Export types, constants, and functions
- For complex NIPs, re-export from other files

Example:
```typescript
/**
 * NIP-XX: Brief Description
 * 
 * Implementation of the NIP-XX specification which...
 * 
 * @see https://github.com/nostr-protocol/nips/blob/master/XX.md
 */

// Import from other files (for complex NIPs)
import { ... } from './types';
import { ... } from './utils';

// Export constants
export const SOME_CONSTANT = 'value';

// Export types
export interface SomeInterface { ... }

// Export functions
export function someFunction() { ... }

// Re-export from other files
export * from './types';
export { ClientClass } from './client';
```

### types.ts

- Define interfaces, types, and enums
- Group related types together
- Add JSDoc comments for each type

Example:
```typescript
/**
 * Types for NIP-XX implementation
 */

/**
 * Description of what this interface represents
 */
export interface SomeInterface {
  property: string;
  optional?: boolean;
}

/**
 * Enum for different types of...
 */
export enum SomeEnum {
  FirstOption = 'first',
  SecondOption = 'second'
}
```

### client.ts

- Implement client classes for interacting with the NIP
- Keep implementation details in this file
- Export a clean interface

Example:
```typescript
import { ... } from '../types/nostr';
import { ... } from './types';

/**
 * Client implementation for NIP-XX
 */
export class NipXXClient {
  constructor(options: ClientOptions) { ... }
  
  async doSomething(): Promise<Result> { ... }
}

export interface ClientOptions { ... }
```

### utils.ts

- Implement helper functions
- Keep implementation details separate from the main API
- Export utility functions that may be used by other parts of the codebase

## README.md Structure

Every NIP should have a README.md file with the following sections:

1. **Title and NIP Reference**: `# NIP-XX: Title` with link to the NIP
2. **Overview**: Brief description of what the NIP does
3. **Key Features**: Bullet points highlighting main features
4. **Basic Usage**: Code examples showing how to use the implementation
5. **Implementation Details**: Technical details about the implementation
6. **Security Considerations** (if applicable): Security notes
7. **Additional Sections** (if needed): Protocol flow, advanced usage, etc.

## Export Pattern in Main index.ts

The main `src/index.ts` file should have consistent export grouping:

```typescript
// Export client classes
export { Nostr } from "./nip01/nostr";
export { Relay } from "./nip01/relay";
export { useWebSocketImplementation, resetWebSocketImplementation } from "./utils/websocket";
export { RelayPool } from "./nip01/relayPool";

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

// Export NIP-07 adapter
export { Nip07Nostr } from "./nip07/adapter";

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

// Export NIP-21 utilities
export { encodeNostrURI, decodeNostrURI, NOSTR_URI_PREFIX } from "./nip21";

// Export NIP-44 utilities
export {
  encrypt as encryptNIP44,
  decrypt as decryptNIP44,
  generateNonce as generateNIP44Nonce,
  getSharedSecret as getNIP44SharedSecret,
  constantTimeEqual as constantTimeEqual,
} from "./nip44";

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

// Export NIP-47 utilities
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

// Export NIP-50 utilities
export { createSearchFilter } from "./nip50";

// Export NIP-57 utilities
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

// Export NIP-65 utilities
export {
  createRelayListEvent,
  parseRelayList,
  getReadRelays,
  getWriteRelays,
  RELAY_LIST_KIND,
  RelayListEntry,
  RelayListEvent,
} from "./nip65";

// Export NIP-66 utilities
export {
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
} from "./nip66";
```

## Implementation Checklist

When implementing a NIP, ensure:

- [ ] README.md is complete with all required sections
- [ ] Appropriate file structure based on complexity
- [ ] Consistent export patterns
- [ ] JSDoc comments for all exported items
- [ ] Proper error handling
- [ ] Clear type definitions
- [ ] Examples demonstrating usage
- [ ] Comprehensive test coverage
- [ ] Update main src/index.ts exports
- [ ] Add example scripts to package.json
- [ ] Add test scripts to package.json

## Current Implementation Status

### Completed NIPs
- ✅ **NIP-01**: Core protocol (specialized structure)
- ✅ **NIP-02**: Contact Lists
- ✅ **NIP-04**: Encrypted Direct Messages
- ✅ **NIP-05**: DNS Identifiers
- ✅ **NIP-07**: Browser Extension Provider
- ✅ **NIP-09**: Event Deletion Requests
- ✅ **NIP-10**: Text Notes and Threads
- ✅ **NIP-11**: Relay Information Document
- ✅ **NIP-17**: Gift Wrapped Direct Messages
- ✅ **NIP-19**: Bech32-encoded Entities
- ✅ **NIP-21**: URI Scheme
- ✅ **NIP-44**: Versioned Encryption
- ✅ **NIP-46**: Remote Signing
- ✅ **NIP-47**: Nostr Wallet Connect
- ✅ **NIP-50**: Search Capability
- ✅ **NIP-57**: Lightning Zaps
- ✅ **NIP-65**: Relay List Metadata
- ✅ **NIP-66**: Relay Discovery

## Migration Plan

For existing NIPs:

1. ✅ Add missing README.md files
2. ✅ Split complex NIPs into multiple files if needed
3. ✅ Standardize export patterns
4. ✅ Add JSDoc comments where missing
5. ✅ Run tests to ensure functionality is maintained
6. ✅ Update main index.ts with consistent exports
7. ✅ Ensure all NIPs have proper documentation

This standardization will make the codebase more maintainable, easier to navigate, and more accessible to new contributors. 
