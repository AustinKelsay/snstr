/**
 * NIP-57: Lightning Zaps
 *
 * Implementation of the NIP-57 specification for Lightning Zaps.
 * This allows for recording lightning payments between users with two event types:
 * - Kind 9734: Zap Request
 * - Kind 9735: Zap Receipt
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/57.md
 */

import { NostrEvent, EventTemplate } from "../types/nostr";
import { createEvent } from "../nip01/event";
import { sha256Hex, verifySignature } from "../utils/crypto";
import { parseBolt11Invoice } from "./utils";
export type { LnurlSuccessAction, LnurlInvoiceResponse } from "./types";

// Export values and types from client.ts
export { NostrZapClient } from "./client";
export type {
  ZapClientOptions,
  ZapInvoiceResult,
  ZapFilterOptions,
  ZapStats,
} from "./client";

// Constants
export const ZAP_REQUEST_KIND = 9734;
export const ZAP_RECEIPT_KIND = 9735;

// Types

/**
 * LNURL Pay Response structure
 */
export interface LnurlPayResponse {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  commentAllowed?: number;
  tag: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

/**
 * Options for creating a zap request
 */
export interface ZapRequestOptions {
  recipientPubkey: string;
  eventId?: string; // The event ID being zapped (optional)
  amount?: number; // Amount in millisats
  relays: string[]; // Relays to publish the zap receipt to
  content?: string; // Optional zap comment
  lnurl?: string; // Optional LNURL of the recipient
  aTag?: string; // Optional a-tag coordinates (for parameterized replaceable events)
  /**
   * Optional sender pubkey for private/anonymous zaps.
   *
   * For standard (non-anonymous) zaps, leave this undefined and sign
   * with the real sender key as `signerPubkey`.
   *
   * For anonymous zaps, sign with an ephemeral key as `signerPubkey`
   * and set `senderPubkey` to the real sender's pubkey. This will
   * cause a `P` tag to be included in the zap request so that the
   * zap receipt can attribute the payment while keeping the zap
   * request itself unlinkable to the real key.
   */
  senderPubkey?: string;
}

/**
 * Options for creating a zap receipt
 */
export interface ZapReceiptOptions {
  recipientPubkey: string;
  eventId?: string; // The event ID being zapped (if applicable)
  bolt11: string; // The Lightning invoice
  preimage?: string; // Optional payment preimage
  zapRequest: NostrEvent; // The original zap request
  senderPubkey?: string; // Original sender pubkey from zap request
  aTag?: string; // Optional a-tag coordinates from zap request
}

/**
 * Zap validation result
 */
export interface ZapValidationResult {
  valid: boolean;
  message?: string;
  amount?: number; // Amount in millisats if valid
  sender?: string; // Sender pubkey if available
  recipient?: string; // Recipient pubkey
  eventId?: string; // Zapped event ID if available
  content?: string; // Comment if available
}

/**
 * Create a zap request event (kind 9734)
 * @param options ZapRequestOptions
 * @param signerPubkey Public key of the signer
 * @returns Unsigned event template
 */
export function createZapRequest(
  options: ZapRequestOptions,
  signerPubkey: string,
): EventTemplate {
  const tags: string[][] = [["p", options.recipientPubkey]];

  // Add relays
  tags.push(["relays", ...options.relays]);

  // Add optional tags
  if (options.eventId) {
    tags.push(["e", options.eventId]);
  }

  if (options.amount) {
    tags.push(["amount", options.amount.toString()]);
  }

  if (options.lnurl) {
    tags.push(["lnurl", options.lnurl]);
  }

  if (options.aTag) {
    tags.push(["a", options.aTag]);
  }

  if (options.senderPubkey) {
    // Only include a P tag when it differs from the signer pubkey.
    // This avoids creating zap requests where pubkey === P, which
    // some LNURL providers treat as invalid or ambiguous.
    if (options.senderPubkey !== signerPubkey) {
      tags.push(["P", options.senderPubkey]);
    }
  }

  return createEvent(
    {
      kind: ZAP_REQUEST_KIND,
      content: options.content || "",
      tags,
    },
    signerPubkey,
  );
}

/**
 * Create a zap receipt event (kind 9735)
 * @param options ZapReceiptOptions
 * @param signerPubkey Public key of the LNURL server
 * @returns Unsigned event template
 */
export function createZapReceipt(
  options: ZapReceiptOptions,
  signerPubkey: string,
): EventTemplate {
  const tags: string[][] = [["p", options.recipientPubkey]];

  // Include original event ID if present
  if (options.eventId) {
    tags.push(["e", options.eventId]);
  }

  // Include sender pubkey if available
  if (options.senderPubkey) {
    tags.push(["P", options.senderPubkey]);
  }

  // Include a-tag if available
  if (options.aTag) {
    tags.push(["a", options.aTag]);
  }

  // Add bolt11 invoice and description
  tags.push(["bolt11", options.bolt11]);
  tags.push(["description", JSON.stringify(options.zapRequest)]);

  // Add preimage if available
  if (options.preimage) {
    tags.push(["preimage", options.preimage]);
  }

  return createEvent(
    {
      kind: ZAP_RECEIPT_KIND,
      content: "",
      tags,
    },
    signerPubkey,
  );
}

/**
 * Validate a zap receipt event
 * @param zapReceipt The zap receipt event
 * @param lnurlPubkey The pubkey of the LNURL server
 * @returns Validation result
 */
export function validateZapReceipt(
  zapReceipt: NostrEvent,
  lnurlPubkey: string,
): ZapValidationResult {
  // Check basics
  if (!zapReceipt) {
    return { valid: false, message: "Zap receipt is null or undefined" };
  }

  if (zapReceipt.kind !== ZAP_RECEIPT_KIND) {
    return {
      valid: false,
      message: `Not a zap receipt event: kind ${zapReceipt.kind} instead of ${ZAP_RECEIPT_KIND}`,
    };
  }

  if (zapReceipt.pubkey !== lnurlPubkey) {
    return {
      valid: false,
      message: `Zap receipt not from expected LNURL provider: ${zapReceipt.pubkey} vs expected ${lnurlPubkey}`,
    };
  }

  // Extract tags
  const bolt11Tag = zapReceipt.tags.find(
    (tag: string[]) => tag[0] === "bolt11",
  );
  const descriptionTag = zapReceipt.tags.find(
    (tag: string[]) => tag[0] === "description",
  );
  const pTag = zapReceipt.tags.find((tag: string[]) => tag[0] === "p");
  const eTag = zapReceipt.tags.find((tag: string[]) => tag[0] === "e");

  // Check required tags
  if (!bolt11Tag) {
    return { valid: false, message: "Missing bolt11 tag" };
  }

  if (!descriptionTag) {
    return { valid: false, message: "Missing description tag" };
  }

  if (!pTag) {
    return { valid: false, message: "Missing p tag" };
  }

  // Parse zap request from description
  let zapRequest: NostrEvent;
  try {
    zapRequest = JSON.parse(descriptionTag[1]);
  } catch (e) {
    return {
      valid: false,
      message: `Invalid zap request description: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Verify zap request signature
  try {
    const isValid = verifySignature(
      zapRequest.id,
      zapRequest.sig,
      zapRequest.pubkey,
    );
    if (!isValid) {
      return { valid: false, message: "Invalid zap request signature" };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Error verifying signature: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Validate zap request
  if (zapRequest.kind !== ZAP_REQUEST_KIND) {
    return {
      valid: false,
      message: `Not a zap request event: kind ${zapRequest.kind} instead of ${ZAP_REQUEST_KIND}`,
    };
  }

  // Extract amount from zap request
  const amountTag = zapRequest.tags.find(
    (tag: string[]) => tag[0] === "amount",
  );
  const amount = amountTag ? parseInt(amountTag[1], 10) : undefined;

  // Validate recipient
  const zapRequestPTag = zapRequest.tags.find(
    (tag: string[]) => tag[0] === "p",
  );
  if (!zapRequestPTag) {
    return { valid: false, message: "Missing p tag in zap request" };
  }

  if (zapRequestPTag[1] !== pTag[1]) {
    return {
      valid: false,
      message: `Recipient mismatch: ${zapRequestPTag[1]} vs ${pTag[1]}`,
    };
  }

  // Validate event ID if present
  const zapRequestETag = zapRequest.tags.find(
    (tag: string[]) => tag[0] === "e",
  );
  if (eTag && zapRequestETag && eTag[1] !== zapRequestETag[1]) {
    return {
      valid: false,
      message: `Event ID mismatch: ${eTag[1]} vs ${zapRequestETag[1]}`,
    };
  }

  // Validate description hash matches bolt11 invoice
  try {
    // Get bolt11 string from the tag
    const bolt11 = bolt11Tag[1];

    // Parse bolt11 invoice to extract description hash
    const parsedInvoice = parseBolt11Invoice(bolt11);
    if (!parsedInvoice) {
      return { valid: false, message: "Failed to parse bolt11 invoice" };
    }

    // Extract description hash from invoice
    const invoiceDescriptionHash = parsedInvoice.descriptionHash;
    if (!invoiceDescriptionHash) {
      return { valid: false, message: "Invoice is missing description hash" };
    }

    // Calculate SHA-256 hash of the zap request JSON
    const zapRequestJson = descriptionTag[1];
    const calculatedHash = sha256Hex(zapRequestJson);

    // Compare the hashes
    if (calculatedHash !== invoiceDescriptionHash) {
      return {
        valid: false,
        message: `Description hash mismatch: invoice=${invoiceDescriptionHash}, calculated=${calculatedHash}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Error validating description hash: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    valid: true,
    amount,
    sender: zapRequest.pubkey,
    recipient: pTag[1],
    eventId: eTag?.[1],
    content: zapRequest.content,
  };
}

/**
 * Parse zap split information from an event's tags
 * @param event Event to parse zap split from
 * @returns Array of zap split receivers with weights
 */
export function parseZapSplit(
  event: NostrEvent,
): { pubkey: string; relay: string; weight: number }[] {
  const zapTags = event.tags.filter((tag: string[]) => tag[0] === "zap");
  if (zapTags.length === 0) {
    return [];
  }

  // Extract zap split information
  const splitInfo = zapTags.map((tag: string[]) => {
    const [_, pubkey, relay, weightStr] = tag;
    const weight = weightStr ? parseInt(weightStr, 10) : 0;
    return { pubkey, relay, weight };
  });

  // If no weights are provided, split equally
  const hasWeights = splitInfo.some(
    (info: { weight: number }) => info.weight > 0,
  );
  if (!hasWeights) {
    const equalWeight = 1;
    return splitInfo.map((info: { pubkey: string; relay: string }) => ({
      ...info,
      weight: equalWeight,
    }));
  }

  return splitInfo;
}

/**
 * Calculate zap split amounts
 * @param totalAmount Total amount in millisats
 * @param splitInfo Array of zap split receivers with weights
 * @returns Array of receivers with calculated amounts
 */
export function calculateZapSplitAmounts(
  totalAmount: number,
  splitInfo: { pubkey: string; relay: string; weight: number }[],
): { pubkey: string; relay: string; amount: number }[] {
  const totalWeight = splitInfo.reduce((sum, info) => sum + info.weight, 0);

  if (totalWeight === 0) {
    return [];
  }

  return splitInfo.map((info) => {
    const amount = Math.floor((info.weight / totalWeight) * totalAmount);
    return {
      pubkey: info.pubkey,
      relay: info.relay,
      amount,
    };
  });
}

/**
 * Raw LNURL response data before validation
 */
interface LnurlPayResponseRaw {
  callback?: string;
  maxSendable?: number;
  minSendable?: number;
  metadata?: string;
  commentAllowed?: number;
  tag?: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
  [key: string]: unknown;
}

/**
 * Parse LNURL payload response
 * @param data LNURL response data
 * @returns Parsed LNURL pay response or null if invalid
 */
export function parseLnurlPayResponse(
  data: LnurlPayResponseRaw,
): LnurlPayResponse | null {
  if (
    !data ||
    !data.callback ||
    !data.maxSendable ||
    !data.minSendable ||
    !data.metadata ||
    data.tag !== "payRequest"
  ) {
    return null;
  }

  return {
    callback: data.callback,
    maxSendable: data.maxSendable,
    minSendable: data.minSendable,
    metadata: data.metadata,
    commentAllowed: data.commentAllowed,
    tag: data.tag,
    allowsNostr: data.allowsNostr,
    nostrPubkey: data.nostrPubkey,
  };
}
