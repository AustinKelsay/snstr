/**
 * NIP-57 Zap Client implementation
 * Provides high-level functionality for working with zaps in Nostr
 */

import { NostrEvent } from '../types/nostr';
import { Nostr } from '../client/nostr';
import { createSignedEvent } from '../utils/event';
import { 
  createZapRequest, 
  validateZapReceipt, 
  ZapRequestOptions, 
  ZapValidationResult,
  parseZapSplit,
  calculateZapSplitAmounts
} from './index';
import { 
  fetchLnurlPayMetadata, 
  supportsNostrZaps, 
  buildZapCallbackUrl,
  extractLnurlMetadata
} from './utils';

/**
 * Options for the ZapClient
 */
export interface ZapClientOptions {
  nostrClient: Nostr;
  defaultRelays?: string[];
}

/**
 * Result of generating a zap invoice
 */
export interface ZapInvoiceResult {
  invoice: string;
  zapRequest: NostrEvent;
  paymentHash?: string;
  successAction?: any;
  error?: string;
}

/**
 * Filter options for fetching zaps
 */
export interface ZapFilterOptions {
  limit?: number;
  since?: number;
  until?: number;
  authors?: string[];
  events?: string[];
}

/**
 * Simple client for working with zaps
 */
export class NostrZapClient {
  private client: Nostr;
  private defaultRelays: string[];
  
  /**
   * Create a new zap client
   * @param options Options for configuring the client
   */
  constructor(options: {
    client: Nostr;
    defaultRelays?: string[];
  }) {
    this.client = options.client;
    this.defaultRelays = options.defaultRelays || [];
  }
  
  /**
   * Check if a user can receive zaps
   * @param pubkey The user's public key
   * @param lnurl Optional LNURL from profile
   * @returns Whether the user can receive zaps
   */
  async canReceiveZaps(pubkey: string, lnurl?: string): Promise<boolean> {
    const zapClient = new ZapClient({ 
      nostrClient: this.client, 
      defaultRelays: this.defaultRelays 
    });
    return zapClient.canReceiveZaps(pubkey, lnurl);
  }
  
  /**
   * Send a zap to a user or event
   * @param options Zap options
   * @param privateKey Private key for signing the request
   */
  async sendZap(options: {
    recipientPubkey: string;
    lnurl: string;
    amount: number;
    comment?: string;
    eventId?: string;
    aTag?: string;
    relays?: string[];
    anonymousZap?: boolean;
  }, privateKey: string): Promise<{
    success: boolean;
    invoice?: string;
    error?: string;
  }> {
    const zapClient = new ZapClient({ 
      nostrClient: this.client, 
      defaultRelays: this.defaultRelays 
    });
    
    // Get the invoice
    const result = await zapClient.getZapInvoice(options, privateKey);
    
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }
    
    return {
      success: true,
      invoice: result.invoice
    };
    
    // Note: In a real implementation, you would now:
    // 1. Use a Lightning wallet to pay the invoice
    // 2. Return the payment success/failure
  }
  
  /**
   * Fetch zaps received by a user
   * @param pubkey User's public key
   * @param options Filter options
   */
  async fetchUserReceivedZaps(
    pubkey: string, 
    options: ZapFilterOptions = {}
  ): Promise<NostrEvent[]> {
    const filter = {
      kinds: [9735],
      '#p': [pubkey],
      limit: options.limit || 20
    };
    
    if (options.since) {
      (filter as any).since = options.since;
    }
    
    if (options.until) {
      (filter as any).until = options.until;
    }
    
    if (options.authors && options.authors.length > 0) {
      (filter as any).authors = options.authors;
    }
    
    // Create a promise to collect events
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      
      // Subscribe to zap receipts
      const subId = this.client.subscribe(
        [filter],
        (event) => {
          events.push(event);
        },
        () => {
          // On EOSE, resolve with collected events
          this.client.unsubscribe([subId]);
          resolve(events);
        }
      )[0]; // Get the first subscription ID from the array
      
      // Set a timeout in case EOSE never comes
      setTimeout(() => {
        this.client.unsubscribe([subId]);
        resolve(events);
      }, 10000);
    });
  }
  
  /**
   * Fetch zaps sent by a user
   * @param pubkey User's public key
   * @param options Filter options
   */
  async fetchUserSentZaps(
    pubkey: string, 
    options: ZapFilterOptions = {}
  ): Promise<NostrEvent[]> {
    // We need to find zap receipts where the zap request was from this pubkey
    // This is more complex and less reliable since we need to parse each description
    
    // First get all zap receipts within our criteria
    const allZapReceipts = await this.fetchZapReceipts(options);
    
    // Then filter to only those sent by this user
    return allZapReceipts.filter(zapReceipt => {
      try {
        // Get the description tag which contains the zap request
        const descriptionTag = zapReceipt.tags.find(tag => tag[0] === 'description');
        if (!descriptionTag) return false;
        
        // Parse the zap request
        const zapRequest = JSON.parse(descriptionTag[1]);
        
        // Check if this zap was sent by our target pubkey
        return zapRequest.pubkey === pubkey || 
               zapRequest.tags.some((tag: string[]) => tag[0] === 'P' && tag[1] === pubkey);
      } catch (e) {
        return false;
      }
    });
  }
  
  /**
   * Fetch zaps for a specific event
   * @param eventId Event ID
   * @param options Filter options
   */
  async fetchEventZaps(
    eventId: string, 
    options: ZapFilterOptions = {}
  ): Promise<NostrEvent[]> {
    const filter = {
      kinds: [9735],
      '#e': [eventId],
      limit: options.limit || 20
    };
    
    if (options.since) {
      (filter as any).since = options.since;
    }
    
    if (options.until) {
      (filter as any).until = options.until;
    }
    
    if (options.authors && options.authors.length > 0) {
      (filter as any).authors = options.authors;
    }
    
    // Create a promise to collect events
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      
      // Subscribe to zap receipts
      const subId = this.client.subscribe(
        [filter],
        (event) => {
          events.push(event);
        },
        () => {
          // On EOSE, resolve with collected events
          this.client.unsubscribe([subId]);
          resolve(events);
        }
      )[0]; // Get the first subscription ID from the array
      
      // Set a timeout in case EOSE never comes
      setTimeout(() => {
        this.client.unsubscribe([subId]);
        resolve(events);
      }, 10000);
    });
  }
  
  /**
   * Fetch all zap receipts matching filter options
   * @param options Filter options
   */
  private async fetchZapReceipts(options: ZapFilterOptions = {}): Promise<NostrEvent[]> {
    const filter = {
      kinds: [9735],
      limit: options.limit || 100
    };
    
    if (options.since) {
      (filter as any).since = options.since;
    }
    
    if (options.until) {
      (filter as any).until = options.until;
    }
    
    if (options.authors && options.authors.length > 0) {
      (filter as any).authors = options.authors;
    }
    
    if (options.events && options.events.length > 0) {
      (filter as any)['#e'] = options.events;
    }
    
    // Create a promise to collect events
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      
      // Subscribe to zap receipts
      const subId = this.client.subscribe(
        [filter],
        (event) => {
          events.push(event);
        },
        () => {
          // On EOSE, resolve with collected events
          this.client.unsubscribe([subId]);
          resolve(events);
        }
      )[0]; // Get the first subscription ID from the array
      
      // Set a timeout in case EOSE never comes
      setTimeout(() => {
        this.client.unsubscribe([subId]);
        resolve(events);
      }, 10000);
    });
  }
  
  /**
   * Validate a zap receipt
   * @param zapReceipt Zap receipt to validate
   * @param lnurlPubkey LNURL server public key
   * @returns Validation result
   */
  validateZapReceipt(
    zapReceipt: NostrEvent, 
    lnurlPubkey: string
  ): ZapValidationResult {
    return validateZapReceipt(zapReceipt, lnurlPubkey);
  }
  
  /**
   * Calculate total zaps received by a user
   * @param pubkey User public key
   * @param options Filter options
   */
  async getTotalZapsReceived(
    pubkey: string,
    options: ZapFilterOptions = {}
  ): Promise<{ total: number, count: number }> {
    const zapReceipts = await this.fetchUserReceivedZaps(pubkey, options);
    
    let total = 0;
    
    for (const receipt of zapReceipts) {
      try {
        // Validate receipt first
        const validation = this.validateZapReceipt(receipt, receipt.pubkey);
        if (!validation.valid || !validation.amount) continue;
        
        total += validation.amount;
      } catch (e) {
        // Skip invalid receipts
        continue;
      }
    }
    
    return {
      total,
      count: zapReceipts.length
    };
  }
}

/**
 * Client for working with NIP-57 Zaps
 */
export class ZapClient {
  private nostrClient: Nostr;
  private defaultRelays: string[];
  private lnurlCache: Map<string, { pubkey: string, lnurl: string, supportsZaps: boolean }> = new Map();

  /**
   * Create a new ZapClient
   * @param options Options for the client
   */
  constructor(options: ZapClientOptions) {
    this.nostrClient = options.nostrClient;
    this.defaultRelays = options.defaultRelays || [];
  }

  /**
   * Check if a user has a valid LNURL that supports zaps
   * @param pubkey User's public key
   * @param lnurlFromProfile LNURL from the user's profile (optional)
   * @returns Whether the user can receive zaps
   */
  async canReceiveZaps(pubkey: string, lnurlFromProfile?: string): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.lnurlCache.get(pubkey);
      if (cached) {
        return cached.supportsZaps;
      }

      // Use provided LNURL or fetch from profile
      let lnurl = lnurlFromProfile;
      if (!lnurl) {
        // In a real implementation, we would fetch the user's profile to get their LNURL
        // For now, return false as we don't have profile fetching implemented
        return false;
      }

      // Fetch and validate LNURL metadata
      const metadata = await fetchLnurlPayMetadata(lnurl);
      if (!metadata) {
        this.lnurlCache.set(pubkey, { pubkey, lnurl, supportsZaps: false });
        return false;
      }

      // Check if it supports zaps
      const supportsZaps = supportsNostrZaps(metadata);
      
      // Cache the result
      this.lnurlCache.set(pubkey, { pubkey, lnurl, supportsZaps });
      
      return supportsZaps;
    } catch (error) {
      console.error('Error checking zap support:', error);
      return false;
    }
  }

  /**
   * Generate a zap invoice for a user or event
   * @param options Options for the zap
   * @param privateKey Private key to sign the zap request
   * @returns Zap invoice result
   */
  async getZapInvoice(
    options: {
      recipientPubkey: string;
      lnurl: string;
      amount: number;  // millisats
      comment?: string;
      eventId?: string;
      aTag?: string;
      relays?: string[];
      anonymousZap?: boolean;
    },
    privateKey: string
  ): Promise<ZapInvoiceResult> {
    try {
      const senderPubkey = this.nostrClient.getPublicKey();
      if (!senderPubkey && !options.anonymousZap) {
        return { 
          invoice: '', 
          zapRequest: null as any, 
          error: 'No public key available and not anonymous zap' 
        };
      }

      // Fetch LNURL metadata
      const metadata = await fetchLnurlPayMetadata(options.lnurl);
      if (!metadata) {
        return { 
          invoice: '', 
          zapRequest: null as any, 
          error: 'Invalid LNURL or failed to fetch metadata' 
        };
      }

      // Check if LNURL supports zaps
      if (!supportsNostrZaps(metadata)) {
        return { 
          invoice: '', 
          zapRequest: null as any, 
          error: 'LNURL does not support Nostr zaps' 
        };
      }

      // Check amount limits
      if (options.amount < metadata.minSendable || options.amount > metadata.maxSendable) {
        return { 
          invoice: '', 
          zapRequest: null as any, 
          error: `Amount out of range (${metadata.minSendable}-${metadata.maxSendable} millisats)` 
        };
      }

      // Create zap request
      const zapRequestOptions: ZapRequestOptions = {
        recipientPubkey: options.recipientPubkey,
        amount: options.amount,
        relays: options.relays || this.defaultRelays,
        content: options.comment || '',
        lnurl: options.lnurl
      };

      // Add optional parameters
      if (options.eventId) {
        zapRequestOptions.eventId = options.eventId;
      }

      if (options.aTag) {
        zapRequestOptions.aTag = options.aTag;
      }

      // For anonymous zaps
      if (options.anonymousZap && senderPubkey) {
        zapRequestOptions.senderPubkey = senderPubkey;
      }

      // Create and sign zap request
      const requestTemplate = createZapRequest(
        zapRequestOptions,
        options.anonymousZap ? '00000000000000000000000000000000000000000000000000000000000000' : senderPubkey || ''
      );
      
      const signedZapRequest = await createSignedEvent({
        ...requestTemplate,
        pubkey: options.anonymousZap ? '00000000000000000000000000000000000000000000000000000000000000' : senderPubkey || '',
        created_at: Math.floor(Date.now() / 1000)
      }, privateKey);

      // Build callback URL with the zap request
      const callbackUrl = buildZapCallbackUrl(
        metadata.callback,
        JSON.stringify(signedZapRequest),
        options.amount
      );

      // Fetch invoice from LNURL
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();

      if (invoiceData.status === 'ERROR') {
        return {
          invoice: '',
          zapRequest: signedZapRequest,
          error: invoiceData.reason || 'LNURL error'
        };
      }

      return {
        invoice: invoiceData.pr,
        zapRequest: signedZapRequest,
        paymentHash: invoiceData.payment_hash,
        successAction: invoiceData.successAction
      };
    } catch (error) {
      console.error('Error getting zap invoice:', error);
      return {
        invoice: '',
        zapRequest: null as any,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate a zap receipt
   * @param zapReceipt Zap receipt event
   * @param lnurlPubkey LNURL server pubkey
   * @returns Validation result
   */
  validateZapReceipt(zapReceipt: NostrEvent, lnurlPubkey: string): ZapValidationResult {
    return validateZapReceipt(zapReceipt, lnurlPubkey);
  }

  /**
   * Handle zap splits for an event
   * @param event Event with zap split tags
   * @param totalAmount Total amount to split
   * @returns Split information for each recipient
   */
  getZapSplitAmounts(event: NostrEvent, totalAmount: number) {
    const splitInfo = parseZapSplit(event);
    return calculateZapSplitAmounts(totalAmount, splitInfo);
  }
}

export default ZapClient; 