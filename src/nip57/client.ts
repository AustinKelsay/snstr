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
import { LnurlSuccessAction, LnurlInvoiceResponse } from "./types";
import { Nostr } from "../nip01/nostr";
import { createSignedEvent } from "../nip01/event";
import { getUnixTime } from "../utils/time";
import { getPublicKey } from "../utils/crypto";
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
import { Logger } from "../utils/logger";
import type { DiagnosticLogger } from "../utils/logger";
import { reportNIP57Diagnostic } from "./diagnostics";

const LNURL_CACHE_CAPACITY = 256;
const LNURL_CALLBACK_TIMEOUT_MS = 10_000;

/**
 * Options for the ZapClient
 */
export interface ZapClientOptions {
  /** The Nostr client instance to use for relay communication */
  nostrClient: Nostr;

  /** Default relay URLs to use when not specified explicitly */
  defaultRelays?: string[];

  /** Receives NIP-57 diagnostics. Quiet by default. */
  logger?: DiagnosticLogger;
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
class ZapClientCore {
  private client: Nostr;
  private defaultRelays: string[];
  private logger: DiagnosticLogger;
  private lnurlCache: Map<
    string,
    { pubkey: string; lnurl: string; supportsZaps: boolean }
  > = new Map();

  /**
   * Create a new zap client
   * @param options Options for configuring the client
   */
  constructor(options: ZapClientOptions) {
    this.client = options.nostrClient;
    this.defaultRelays = options.defaultRelays || [];
    this.logger = options.logger ?? new Logger({ silent: true });
  }

  private rememberLnurlResult(
    pubkey: string,
    lnurl: string,
    supportsZaps: boolean,
  ): void {
    this.lnurlCache.delete(pubkey);
    this.lnurlCache.set(pubkey, { pubkey, lnurl, supportsZaps });

    while (this.lnurlCache.size > LNURL_CACHE_CAPACITY) {
      const oldestPubkey = this.lnurlCache.keys().next().value;
      if (oldestPubkey === undefined) break;
      this.lnurlCache.delete(oldestPubkey);
    }
  }

  /** Collect matching zap receipts until the first EOSE or the legacy timeout. */
  private collectZapReceipts(filter: Filter): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const activeSubscriptionIds = new Set<string>();
      let isSettled = false;
      let subscribeComplete = false;
      let reachedEoseSynchronously = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const releaseSubscriptions = () => {
        const subscriptionIds = Array.from(activeSubscriptionIds);
        activeSubscriptionIds.clear();
        for (const subscriptionId of subscriptionIds) {
          try {
            this.client.unsubscribe([subscriptionId]);
          } catch (error) {
            reportNIP57Diagnostic(
              this.logger,
              "warn",
              "Failed to release NIP-57 Relay subscriptions",
              {
                error,
                subscriptionIds: [subscriptionId],
              },
            );
          }
        }
      };

      const settle = () => {
        if (isSettled) return;
        isSettled = true;

        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        releaseSubscriptions();
        resolve(events);
      };

      const handleEose = () => {
        if (!subscribeComplete) {
          reachedEoseSynchronously = true;
          return;
        }
        settle();
      };

      try {
        const subscriptionIds = this.client.subscribe(
          [filter],
          (event) => {
            if (!isSettled && !reachedEoseSynchronously) events.push(event);
          },
          handleEose,
        );
        if (!Array.isArray(subscriptionIds)) {
          throw new TypeError(
            "NIP-57 Relay subscription did not return subscription IDs",
          );
        }
        let hasMalformedSubscriptionId = false;
        for (const subscriptionId of subscriptionIds) {
          if (typeof subscriptionId === "string") {
            activeSubscriptionIds.add(subscriptionId);
          } else {
            hasMalformedSubscriptionId = true;
          }
        }
        if (hasMalformedSubscriptionId) {
          throw new TypeError(
            "NIP-57 Relay subscription returned a malformed subscription ID",
          );
        }
        subscribeComplete = true;
      } catch (error) {
        isSettled = true;
        releaseSubscriptions();
        reject(error);
        return;
      }

      // A Relay adapter may reach EOSE synchronously before subscribe returns;
      // validate and record every returned ID before honoring that signal.
      if (reachedEoseSynchronously) {
        settle();
        return;
      }

      timeoutId = setTimeout(settle, 10000);
    });
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
    try {
      const cached = this.lnurlCache.get(pubkey);
      if (cached && (!lnurl || cached.lnurl === lnurl)) {
        this.lnurlCache.delete(pubkey);
        this.lnurlCache.set(pubkey, cached);
        return cached.supportsZaps;
      }

      if (!lnurl) {
        return false;
      }

      const metadata = await fetchLnurlPayMetadata(lnurl, this.logger);
      if (!metadata) {
        this.rememberLnurlResult(pubkey, lnurl, false);
        return false;
      }

      const supportsZaps = supportsNostrZaps(metadata);
      this.rememberLnurlResult(pubkey, lnurl, supportsZaps);
      return supportsZaps;
    } catch (error) {
      reportNIP57Diagnostic(
        this.logger,
        "error",
        "Failed to check zap support",
        { error },
      );
      return false;
    }
  }

  async getZapInvoice(
    options: {
      recipientPubkey: string;
      lnurl: string;
      amount: number;
      comment?: string;
      eventId?: string;
      aTag?: string;
      relays?: string[];
      anonymousZap?: boolean;
    },
    privateKey: string,
  ): Promise<ZapInvoiceResult> {
    try {
      const senderPubkey = this.client.getPublicKey();
      if (!senderPubkey && !options.anonymousZap) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "No public key available and not anonymous zap",
        };
      }

      const metadata = await fetchLnurlPayMetadata(options.lnurl, this.logger);
      if (!metadata) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "Invalid LNURL or failed to fetch metadata",
        };
      }

      if (!supportsNostrZaps(metadata)) {
        return {
          invoice: "",
          zapRequest: {} as NostrEvent,
          error: "LNURL does not support Nostr zaps",
        };
      }

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

      const zapRequestOptions: ZapRequestOptions = {
        recipientPubkey: options.recipientPubkey,
        amount: options.amount,
        relays: options.relays || this.defaultRelays,
        content: options.comment || "",
        lnurl: options.lnurl,
      };

      if (options.eventId) {
        zapRequestOptions.eventId = options.eventId;
      }
      if (options.aTag) {
        zapRequestOptions.aTag = options.aTag;
      }
      if (options.anonymousZap && senderPubkey) {
        zapRequestOptions.senderPubkey = senderPubkey;
      }

      const signingPubkey = options.anonymousZap
        ? getPublicKey(privateKey)
        : senderPubkey || "";
      const requestTemplate = createZapRequest(
        zapRequestOptions,
        signingPubkey,
      );

      const signedZapRequest = await createSignedEvent(
        {
          ...requestTemplate,
          tags: requestTemplate.tags || [],
          pubkey: signingPubkey,
          created_at: getUnixTime(),
        },
        privateKey,
      );

      const callbackUrl = buildZapCallbackUrl(
        metadata.callback,
        JSON.stringify(signedZapRequest),
        options.amount,
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        LNURL_CALLBACK_TIMEOUT_MS,
      );
      let invoiceData: LnurlInvoiceResponse;
      try {
        const invoiceResponse = await fetch(callbackUrl, {
          signal: controller.signal,
        });
        invoiceData = (await invoiceResponse.json()) as LnurlInvoiceResponse;
      } catch (error) {
        if (controller.signal.aborted) {
          return {
            invoice: "",
            zapRequest: signedZapRequest,
            error: "LNURL callback timed out",
          };
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }

      if (invoiceData.status === "ERROR") {
        return {
          invoice: "",
          zapRequest: signedZapRequest,
          error: invoiceData.reason || "LNURL error",
        };
      }

      if (
        typeof invoiceData.pr !== "string" ||
        invoiceData.pr.trim().length === 0
      ) {
        return {
          invoice: "",
          zapRequest: signedZapRequest,
          error: "LNURL server returned an invalid invoice response",
        };
      }

      return {
        invoice: invoiceData.pr,
        zapRequest: signedZapRequest,
        paymentHash: invoiceData.payment_hash,
        successAction: invoiceData.successAction,
      };
    } catch (error) {
      reportNIP57Diagnostic(this.logger, "error", "Failed to get zap invoice", {
        error,
      });
      return {
        invoice: "",
        zapRequest: {} as NostrEvent,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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
    // Get the invoice
    const result = await this.getZapInvoice(options, privateKey);

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

  private buildReceiptFilter(
    options: ZapFilterOptions,
    target: { recipientPubkey?: string; eventId?: string } = {},
  ): Filter {
    const filter: Filter = {
      kinds: [9735],
      limit: options.limit ?? 20,
    };

    if (target.recipientPubkey) {
      filter["#p"] = [target.recipientPubkey];
    }
    if (target.eventId) {
      filter["#e"] = [target.eventId];
    } else if (
      !target.recipientPubkey &&
      options.events &&
      options.events.length > 0
    ) {
      filter["#e"] = options.events;
    }
    if (options.since !== undefined) {
      filter.since = options.since;
    }
    if (options.until !== undefined) {
      filter.until = options.until;
    }
    if (options.authors && options.authors.length > 0) {
      filter.authors = options.authors;
    }

    return filter;
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
    return this.collectZapReceipts(
      this.buildReceiptFilter(options, { recipientPubkey: pubkey }),
    );
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
        // Find description tag with streamlined validation
        const descriptionTag = zapReceipt.tags.find(
          (tag) =>
            Array.isArray(tag) && tag.length > 0 && tag[0] === "description",
        );

        if (
          !Array.isArray(descriptionTag) ||
          descriptionTag.length < 2 ||
          typeof descriptionTag[1] !== "string"
        )
          return false;

        // Parse zap request
        const zapRequest = JSON.parse(descriptionTag[1]);

        // Check if the sender is the specified pubkey
        return zapRequest.pubkey === pubkey;
      } catch {
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
    return this.collectZapReceipts(
      this.buildReceiptFilter(options, { eventId }),
    );
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
    return this.collectZapReceipts(this.buildReceiptFilter(options));
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
    return validateZapReceipt(
      zapReceipt,
      lnurlPubkey || zapReceipt.pubkey,
      this.logger,
    );
  }

  private calculateZapStats(zaps: NostrEvent[]): ZapStats {
    if (zaps.length === 0) {
      return { total: 0, count: 0 };
    }

    const stats: ZapStats = {
      total: 0,
      count: 0,
      largest: 0,
      smallest: Number.MAX_SAFE_INTEGER,
      average: 0,
      firstAt: Number.MAX_SAFE_INTEGER,
      latestAt: 0,
    };

    for (const zap of zaps) {
      const validation = this.validateZapReceipt(zap);
      if (!validation.valid || !validation.amount) continue;

      stats.total += validation.amount;
      stats.count++;
      stats.largest = Math.max(stats.largest ?? 0, validation.amount);
      stats.smallest = Math.min(
        stats.smallest ?? Number.MAX_SAFE_INTEGER,
        validation.amount,
      );
      stats.firstAt = Math.min(
        stats.firstAt ?? Number.MAX_SAFE_INTEGER,
        zap.created_at,
      );
      stats.latestAt = Math.max(stats.latestAt ?? 0, zap.created_at);
    }

    if (stats.count === 0) return { total: 0, count: 0 };

    stats.average = Math.floor(stats.total / stats.count);

    return stats;
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
    return this.calculateZapStats(zaps);
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
    return this.calculateZapStats(zaps);
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

/** Comprehensive public NIP-57 facade retained for 0.x compatibility. */
export class NostrZapClient {
  private core: ZapClientCore;

  /** Create a comprehensive NIP-57 client around an existing Nostr client. */
  constructor(options: {
    /** The Nostr client instance to use. */
    client: Nostr;
    /** Default relay URLs to use when not specified explicitly. */
    defaultRelays?: string[];
    /** Receives NIP-57 diagnostics. Quiet by default. */
    logger?: DiagnosticLogger;
  }) {
    this.core = new ZapClientCore({
      nostrClient: options.client,
      defaultRelays: options.defaultRelays,
      logger: options.logger,
    });
  }

  /** Check whether a user LNURL supports Nostr zaps. */
  async canReceiveZaps(pubkey: string, lnurl?: string): Promise<boolean> {
    return this.core.canReceiveZaps(pubkey, lnurl);
  }

  /** Build a zap request and return the invoice needed to send the zap. */
  async sendZap(
    options: {
      recipientPubkey: string;
      lnurl: string;
      amount: number;
      comment?: string;
      eventId?: string;
      aTag?: string;
      relays?: string[];
      anonymousZap?: boolean;
    },
    privateKey: string,
  ): Promise<{ success: boolean; invoice?: string; error?: string }> {
    return this.core.sendZap(options, privateKey);
  }

  /** Fetch zap receipts received by a user. */
  async fetchUserReceivedZaps(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchUserReceivedZaps(pubkey, options);
  }

  /** Fetch zap receipts sent by a user. */
  async fetchUserSentZaps(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchUserSentZaps(pubkey, options);
  }

  /** Fetch zap receipts associated with an event. */
  async fetchEventZaps(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchEventZaps(eventId, options);
  }

  /** Fetch all zap receipts matching the supplied filter options. */
  async fetchZapReceipts(
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchZapReceipts(options);
  }

  /** Validate a zap receipt and extract its amount when valid. */
  validateZapReceipt(
    zapReceipt: NostrEvent,
    lnurlPubkey?: string,
  ): ZapValidationResult {
    return this.core.validateZapReceipt(zapReceipt, lnurlPubkey);
  }

  /** Calculate aggregate zap statistics for a user. */
  async getTotalZapsReceived(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    return this.core.getTotalZapsReceived(pubkey, options);
  }

  /** Calculate aggregate zap statistics for an event. */
  async getTotalZapsForEvent(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    return this.core.getTotalZapsForEvent(eventId, options);
  }

  /** Parse zap split recipients and weights from an event. */
  parseZapSplit(event: NostrEvent) {
    return this.core.parseZapSplit(event);
  }

  /** Calculate recipient amounts for parsed zap split information. */
  calculateZapSplitAmounts(
    totalAmount: number,
    splitInfo: ReturnType<typeof parseZapSplit>,
  ) {
    return this.core.calculateZapSplitAmounts(totalAmount, splitInfo);
  }
}

/**
 * Client for working with NIP-57 Zaps
 */
export class ZapClient {
  private core: ZapClientCore;

  /**
   * Create a new ZapClient
   * @param options Options for the client
   */
  constructor(options: ZapClientOptions) {
    this.core = new ZapClientCore(options);
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
    return this.core.canReceiveZaps(pubkey, lnurlFromProfile);
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
    return this.core.getZapInvoice(options, privateKey);
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
    return this.core.validateZapReceipt(zapReceipt, lnurlPubkey);
  }

  /**
   * Handle zap splits for an event
   * @param event Event with zap split tags
   * @param totalAmount Total amount to split
   * @returns Split information for each recipient
   */
  getZapSplitAmounts(event: NostrEvent, totalAmount: number) {
    const splitInfo = this.core.parseZapSplit(event);
    return this.core.calculateZapSplitAmounts(totalAmount, splitInfo);
  }

  /** Fetch all zap receipts matching the filter criteria. */
  async fetchZapReceipts(
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchZapReceipts(options);
  }

  /** Fetch zap receipts received by a user. */
  async fetchUserReceivedZaps(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchUserReceivedZaps(pubkey, options);
  }

  /** Fetch zap receipts for an event. */
  async fetchEventZaps(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<NostrEvent[]> {
    return this.core.fetchEventZaps(eventId, options);
  }

  /** Calculate zap statistics for a user. */
  async getTotalZapsReceived(
    pubkey: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    return this.core.getTotalZapsReceived(pubkey, options);
  }

  /** Calculate zap statistics for an event. */
  async getTotalZapsForEvent(
    eventId: string,
    options: ZapFilterOptions = {},
  ): Promise<ZapStats> {
    return this.core.getTotalZapsForEvent(eventId, options);
  }
}
