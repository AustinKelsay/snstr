/**
 * NIP-47: Nostr Wallet Connect
 * 
 * This module implements the Nostr Wallet Connect protocol which allows Nostr
 * clients to access a remote lightning wallet through a standardized protocol.
 */

// Export types
export * from './types';

// Export client implementation
export { 
  NostrWalletConnectClient, 
  parseNWCURL, 
  generateNWCURL,
  NIP47ClientError,
  RetryOptions
} from './client';

// Export service implementation
export { 
  NostrWalletService,
  NostrWalletServiceOptions
} from './service'; 