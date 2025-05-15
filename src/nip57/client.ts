/**
 * NIP-57 Zap Client implementation
 * Provides high-level functionality for working with zaps in Nostr
 *
 * The NostrZapClient provides a comprehensive interface for:
 * - Sending zaps to users and events
 * - Fetching and validating zap receipts
 * - Calculating zap statistics
 * - Working with zap splits
 */

import { NostrEvent, Filter } from "../types/nostr";
import { Nostr } from "../nip01/nostr";
import { createSignedEvent } from "../nip01/event";
import {
  createZapRequest,
  validateZapReceipt,
  ZapRequestOptions,
  ZapValidationResult,
  parseZapSplit,
  calculateZapSplitAmounts,
} from "./index";
import {
  fetchLnurlPayMetadata,
  supportsNostrZaps,
  buildZapCallbackUrl,
} from "./utils";

/**
 * Options for the ZapClient
 */
export interface ZapClientOptions {
  /** The Nostr client instance to use for relay communication */
  nostrClient: Nostr;

  /** Default relay URLs to use when not specified explicitly */
  defaultRelays?: string[];
}

/**
 * Success action to be performed after payment
 */
export interface LnurlSuccessAction {
  /** Type of success action */
  tag: string;
  /** Action message */
  message?: string;
  /** URL to visit after payment */
  url?: string;
  /** Description of the action */
  description?: string;
  /** CDATA for the action */
  cdata?: string;
}

/**
 * Result of generating a zap invoice
 */
export interface ZapInvoiceResult {
  /** The bolt11 invoice string */
  invoice: string;

  /** The zap request event that was used to generate the invoice */
  zapRequest: NostrEvent;

  /** The optional payment hash of the invoice */
  paymentHash?: string;

  /** Optional success action to be performed after payment */
  successAction?: LnurlSuccessAction;

  /** Error message if invoice generation failed */
  error?: string;
}

/**
 * Filter options for fetching zaps
 */
export interface ZapFilterOptions {
  /** Maximum number of zaps to fetch */
  limit?: number;

  /** Fetch zaps created after this timestamp */
  since?: number;

  /** Fetch zaps created before this timestamp */
  until?: number;

  /** Filter zaps by these author pubkeys */
  authors?: string[];

  /** Filter zaps for these event IDs */
  events?: string[];
}

/**
 * Statistics about zaps for a user or event
 */
export interface ZapStats {
  /** Total amount received in millisats */
  total: number;

  /** Number of zaps received */
  count: number;

  /** Largest single zap amount in millisats */
  largest?: number;

  /** Smallest single zap amount in millisats */
  smallest?: number;

  /** Average zap amount in millisats */
  average?: number;

  /** First zap timestamp */
  firstAt?: number;

  /** Latest zap timestamp */
  latestAt?: number;
}

/**
 * Client for working with Lightning Zaps (NIP-57)
 *
 * This client provides high-level methods for sending zaps,
 * fetching zap receipts, and calculating zap statistics.
 */
export class NostrZapClient {
  private client: Nostr;
  private defaultRelays: string[];

  /**
   * Create a new zap client
   * @param options Options for configuring the client
   */
  constructor(options: {
    /** The Nostr client instance to use */
    client: Nostr;

    /** Default relay URLs to use when not specified explicitly */
    defaultRelays?: string[];
  }) {
    this.client = options.client;
    this.defaultRelays = options.defaultRelays || [];
  }

  /**
   * Check if a user can receive zaps
   *
   * This method checks if a user's LNURL endpoint supports NIP-57 Nostr zaps.
   *
   * @param pubkey The user's public key
   * @param lnurl Optional LNURL from profile (if known)
   * @returns Whether the user can receive zaps
   */
  async canReceiveZaps(pubkey: string, lnurl?: string): Promise<boolean> {
    const zapClient = new ZapClient({
      nostrClient: this.client,
      defaultRelays: this.defaultRelays,
    });
    return zapClient.canReceiveZaps(pubkey, lnurl);
  }

  /**
   * Send a zap to a user or event
   *
   * This method:
   * 1. Creates a zap request
   * 2. Sends it to the recipient's LNURL server
   * 3. Returns the invoice for payment
   *
   * Note: After getting the invoice, you need to pay it with a Lightning wallet.
   * The LNURL server will create and publish a zap receipt after payment.
   *
   * @param options Zap options including recipient, amount, and comment
   * @param privateKey Private key for signing the request
   * @returns Object with success status and invoice or error
   */
  async sendZap(
    options: {
      /** Public key of the recipient */
      recipientPubkey: string;

      /** LNURL of the recipient */
      lnurl: string;

      /** Amount in millisats to send */
      amount: number;

      /** Optional comment to include with the zap */
      comment?: string;

      /** Event ID to zap (if zapping a specific event) */
      eventId?: string;

      /** A-tag coordinates (for parameterized replaceable events) */
      aTag?: string;

      /** Override default relays for zap receipt publishing */
      relays?: string[];

      /** Whether to send as an anonymous zap */
      anonymousZap?: boolean;
    },
    privateKey: string,
  ): Promise<{
    success: boolean;
    invoice?: string;
    error?: string;
  }> {
    const zapClient = new ZapClient({
      nostrClient: this.client,
      defaultRelays: this.defaultRelays,
    });

    // Get the invoice
    const result = await zapClient.getZapInvoice(options, privateKey);

    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      invoice: result.invoice,
    };

    // Note: In a real implementation, you would now:
    // 1. Use a Lightning wallet to pay the invoice
    // 2. Return the payment success/failure
  }

  /**
   * Fetch zaps received by a user
   *
   * @param pubkey User's public key
   * @param options Filter options
   * @returns Array of zap receipt events
   */
  async fetchUserReceivedZaps(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    const filter: Filter = {
      kinds: [9735],
      "#p": [pubkey],
      limit: options.limit || 20,
    };

    if (options.since) {
      filter.since = options.since;
    }

    if (options.until) {
      filter.until = options.until;
    }

    if (options.authors && options.authors.length > 0) {
      filter.authors = options.authors;
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
        },
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
   *
   * @param pubkey User's public key
   * @param options Filter options
   * @returns Array of zap receipt events
   */
  async fetchUserSentZaps(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    // We need to find zap receipts where the zap request was from this pubkey
    // This is more complex and less reliable since we need to parse each description

    // First get all zap receipts within our criteria
    const allZapReceipts = await this.fetchZapReceipts(options);

    // Then filter to only those sent by this user
    return allZapReceipts.filter((zapReceipt) => {
      try {
        // Find description tag
        const descriptionTag = zapReceipt.tags.find(
          (tag) => tag[0] === "description",
        );
        if (!descriptionTag || !descriptionTag[1]) return false;

        // Parse zap request
        const zapRequest = JSON.parse(descriptionTag[1]);

        // Check if the sender is the specified pubkey
        return zapRequest.pubkey === pubkey;
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Fetch zaps for a specific event
   *
   * @param eventId The event ID to get zaps for
   * @param options Filter options
   * @returns Array of zap receipt events
   */
  async fetchEventZaps(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    const filter: Filter = {
      kinds: [9735],
      "#e": [eventId],
      limit: options.limit || 20,
    };

    if (options.since) {
      filter.since = options.since;
    }

    if (options.until) {
      filter.until = options.until;
    }

    if (options.authors && options.authors.length > 0) {
      filter.authors = options.authors;
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
        },
      )[0]; // Get the first subscription ID from the array

      // Set a timeout in case EOSE never comes
      setTimeout(() => {
        this.client.unsubscribe([subId]);
        resolve(events);
      }, 10000);
    });
  }

  /**
   * Fetch all zap receipts matching the filter criteria
   *
   * @param options Filter options
   * @returns Array of zap receipt events
   */
  async fetchZapReceipts(
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    const filter: Filter = {
      kinds: [9735],
      limit: options.limit || 20,
    };

    if (options.since) {
      filter.since = options.since;
    }

    if (options.until) {
      filter.until = options.until;
    }

    if (options.authors && options.authors.length > 0) {
      filter.authors = options.authors;
    }

    if (options.events && options.events.length > 0) {
      filter["#e"] = options.events;
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
        },
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
   *
   * This validates that:
   * 1. The receipt is properly formatted
   * 2. The signature is valid
   * 3. The description hash in the bolt11 invoice matches the zap request
   * 4. The amount matches between invoice and zap request
   *
   * @param zapReceipt The zap receipt event to validate
   * @param lnurlPubkey Public key of the LNURL server (if known)
   * @returns Validation result with details
   */
  validateZapReceipt(
    zapReceipt: NostrEvent,
    lnurlPubkey?: string,
  ): ZapValidationResult {
    return validateZapReceipt(zapReceipt, lnurlPubkey || zapReceipt.pubkey);
  }

  /**
   * Calculate total zaps received by a user
   *
   * @param pubkey User's public key
   * @param options Filter options
   * @returns Zap statistics
   */
  async getTotalZapsReceived(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    const zaps = await this.fetchUserReceivedZaps(pubkey, options);

    if (zaps.length === 0) {
      return { total: 0, count: 0 };
    }

    // Initialize stats
    const stats: ZapStats = {
      total: 0,
      count: 0,
      largest: 0,
      smallest: Number.MAX_SAFE_INTEGER,
      average: 0,
      firstAt: Number.MAX_SAFE_INTEGER,
      latestAt: 0,
    };

    // Process each zap
    for (const zap of zaps) {
      const validation = this.validateZapReceipt(zap);

      if (validation.valid && validation.amount) {
        stats.total += validation.amount;
        stats.count++;

        // Update largest/smallest
        if (validation.amount > (stats.largest || 0)) {
          stats.largest = validation.amount;
        }

        if (validation.amount < (stats.smallest || Number.MAX_SAFE_INTEGER)) {
          stats.smallest = validation.amount;
        }

        // Update timestamps
        if (zap.created_at < stats.firstAt!) {
          stats.firstAt = zap.created_at;
        }

        if (zap.created_at > stats.latestAt!) {
          stats.latestAt = zap.created_at;
        }
      }
    }

    // Calculate average
    if (stats.count > 0) {
      stats.average = Math.floor(stats.total / stats.count);
    }

    // Reset smallest if no valid zaps were found
    if (stats.smallest === Number.MAX_SAFE_INTEGER) {
      stats.smallest = undefined;
    }

    // Reset timestamps if no valid zaps were found
    if (stats.firstAt === Number.MAX_SAFE_INTEGER) {
      stats.firstAt = undefined;
    }

    return stats;
  }

  /**
   * Calculate total zaps for a specific event
   *
   * @param eventId Event ID to calculate zaps for
   * @param options Filter options
   * @returns Zap statistics
   */
  async getTotalZapsForEvent(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    const zaps = await this.fetchEventZaps(eventId, options);

    if (zaps.length === 0) {
      return { total: 0, count: 0 };
    }

    // Initialize stats
    const stats: ZapStats = {
      total: 0,
      count: 0,
      largest: 0,
      smallest: Number.MAX_SAFE_INTEGER,
      average: 0,
      firstAt: Number.MAX_SAFE_INTEGER,
      latestAt: 0,
    };

    // Process each zap
    for (const zap of zaps) {
      const validation = this.validateZapReceipt(zap);

      if (validation.valid && validation.amount) {
        stats.total += validation.amount;
        stats.count++;

        // Update largest/smallest
        if (validation.amount > (stats.largest || 0)) {
          stats.largest = validation.amount;
        }

        if (validation.amount < (stats.smallest || Number.MAX_SAFE_INTEGER)) {
          stats.smallest = validation.amount;
        }

        // Update timestamps
        if (zap.created_at < stats.firstAt!) {
          stats.firstAt = zap.created_at;
        }

        if (zap.created_at > stats.latestAt!) {
          stats.latestAt = zap.created_at;
        }
      }
    }

    // Calculate average
    if (stats.count > 0) {
      stats.average = Math.floor(stats.total / stats.count);
    }

    // Reset smallest if no valid zaps were found
    if (stats.smallest === Number.MAX_SAFE_INTEGER) {
      stats.smallest = undefined;
    }

    // Reset timestamps if no valid zaps were found
    if (stats.firstAt === Number.MAX_SAFE_INTEGER) {
      stats.firstAt = undefined;
    }

    return stats;
  }

  /**
   * Parse zap split information from an event
   *
   * @param event The event to parse zap split information from
   * @returns Array of zap split recipients with weights
   */
  parseZapSplit(event: NostrEvent) {
    return parseZapSplit(event);
  }

  /**
   * Calculate zap split amounts
   *
   * @param totalAmount Total amount to split in millisats
   * @param splitInfo Array of zap split recipients with weights
   * @returns Array of recipients with calculated amounts
   */
  calculateZapSplitAmounts(
    totalAmount: number,
    splitInfo: ReturnType<typeof parseZapSplit>,
  ) {
    return calculateZapSplitAmounts(totalAmount, splitInfo);
  }
}

/**
 * Client for working with NIP-57 Zaps
 */
export class ZapClient {
  private nostrClient: Nostr;
  private defaultRelays: string[];
  private lnurlCache: Map<
    string,
    { pubkey: string; lnurl: string; supportsZaps: boolean }
  > = new Map();

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
  async canReceiveZaps(
    pubkey: string,
    lnurlFromProfile?: string,
  ): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.lnurlCache.get(pubkey);
      if (cached) {
        return cached.supportsZaps;
      }

      // Use provided LNURL or fetch from profile
      const lnurl = lnurlFromProfile;
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
      console.error("Error checking zap support:", error);
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
      amount: number; // millisats
      comment?: string;
      eventId?: string;
      aTag?: string;
      relays?: string[];
      anonymousZap?: boolean;
    },
    privateKey: string,
  ): Promise<ZapInvoiceResult> {
    try {
      const senderPubkey = this.nostrClient.getPublicKey();
      if (!senderPubkey && !options.anonymousZap) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "No public key available and not anonymous zap",
        };
      }

      // Fetch LNURL metadata
      const metadata = await fetchLnurlPayMetadata(options.lnurl);
      if (!metadata) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "Invalid LNURL or failed to fetch metadata",
        };
      }

      // Check if LNURL supports zaps
      if (!supportsNostrZaps(metadata)) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "LNURL does not support Nostr zaps",
        };
      }

      // Check amount limits
      if (
        options.amount < metadata.minSendable ||
        options.amount > metadata.maxSendable
      ) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: `Amount out of range (${metadata.minSendable}-${metadata.maxSendable} millisats)`,
        };
      }

      // Create zap request
      const zapRequestOptions: ZapRequestOptions = {
        recipientPubkey: options.recipientPubkey,
        amount: options.amount,
        relays: options.relays || this.defaultRelays,
        content: options.comment || "",
        lnurl: options.lnurl,
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
        options.anonymousZap
          ? "00000000000000000000000000000000000000000000000000000000000000"
          : senderPubkey || "",
      );

      const signedZapRequest = await createSignedEvent(
        {
          ...requestTemplate,
          pubkey: options.anonymousZap
            ? "00000000000000000000000000000000000000000000000000000000000000"
            : senderPubkey || "",
          created_at: Math.floor(Date.now() / 1000),
        },
        privateKey,
      );

      // Build callback URL with the zap request
      const callbackUrl = buildZapCallbackUrl(
        metadata.callback,
        JSON.stringify(signedZapRequest),
        options.amount,
      );

      // Fetch invoice from LNURL
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json() as LnurlInvoiceResponse;

      if (invoiceData.status === "ERROR") {
        return {
          invoice: "",
          zapRequest: signedZapRequest,
          error: invoiceData.reason || "LNURL error",
        };
      }

      return {
        invoice: invoiceData.pr,
        zapRequest: signedZapRequest,
        paymentHash: invoiceData.payment_hash,
        successAction: invoiceData.successAction,
      };
    } catch (error) {
      console.error("Error getting zap invoice:", error);
      return {
        invoice: "",
        zapRequest: {} as NostrEvent,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Validate a zap receipt
   * @param zapReceipt Zap receipt event
   * @param lnurlPubkey LNURL server pubkey
   * @returns Validation result
   */
  validateZapReceipt(
    zapReceipt: NostrEvent,
    lnurlPubkey: string,
  ): ZapValidationResult {
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

// Define a type for LNURL invoice responses
/**
 * LNURL invoice response
 */
export interface LnurlInvoiceResponse {
  pr: string;
  payment_hash?: string;
  successAction?: LnurlSuccessAction;
  status?: string;
  reason?: string;
}

export default ZapClient;
