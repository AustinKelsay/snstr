/**
 * Utility functions for NIP-57 (Lightning Zaps)
 */

import { LnurlPayResponse } from './index';
import { bech32 } from '@scure/base';
import { decode } from 'light-bolt11-decoder';

/**
 * Converts a Lightning Address (user@domain.com) to a well-known LNURL endpoint URL
 * @param lightningAddress Lightning Address in format user@domain.com
 * @returns URL string or null if invalid address format
 */
export function getLightningAddressUrl(lightningAddress: string): string | null {
  try {
    // Check format
    if (!lightningAddress || !lightningAddress.includes('@')) {
      return null;
    }
    
    // Split into username and domain
    const [username, domain] = lightningAddress.split('@');
    
    // Validate parts
    if (!username || !domain) {
      return null;
    }
    
    // Build the LNURL endpoint
    return `https://${domain}/.well-known/lnurlp/${username}`;
  } catch (error) {
    console.error('Error converting Lightning Address:', error);
    return null;
  }
}

/**
 * Fetches and validates LNURL pay metadata from a URL
 * @param lnurlOrUrl LNURL (bech32-encoded) or direct URL
 * @returns LNURL pay response if valid and supports Nostr, null otherwise
 */
export async function fetchLnurlPayMetadata(lnurlOrUrl: string): Promise<LnurlPayResponse | null> {
  try {
    // Convert LNURL to URL if needed
    let url = lnurlOrUrl;
    
    // Handle Lightning Address (user@domain.com)
    if (lnurlOrUrl.includes('@')) {
      url = getLightningAddressUrl(lnurlOrUrl) || lnurlOrUrl;
    }
    // Handle LNURL (bech32-encoded)
    else if (lnurlOrUrl.toLowerCase().startsWith('lnurl')) {
      url = decodeLnurl(lnurlOrUrl) || lnurlOrUrl;
    }
    
    if (!url) {
      return null;
    }
    
    // Fetch the LNURL metadata
    const response = await fetch(url);
    const data = await response.json();
    
    // Basic validation
    if (!data || 
        typeof data !== 'object' ||
        !data.callback ||
        !data.maxSendable ||
        !data.minSendable ||
        !data.metadata ||
        data.tag !== 'payRequest') {
      return null;
    }
    
    // Return the response
    return {
      callback: data.callback,
      maxSendable: data.maxSendable,
      minSendable: data.minSendable,
      metadata: data.metadata,
      commentAllowed: data.commentAllowed,
      tag: data.tag,
      allowsNostr: data.allowsNostr,
      nostrPubkey: data.nostrPubkey
    };
  } catch (error) {
    console.error('Error fetching LNURL metadata:', error);
    return null;
  }
}

/**
 * Checks if an LNURL pay endpoint supports Nostr zaps
 * @param metadata LNURL pay metadata response
 * @returns Whether the endpoint supports zaps
 */
export function supportsNostrZaps(metadata: LnurlPayResponse): boolean {
  return !!(metadata.allowsNostr && metadata.nostrPubkey);
}

/**
 * Decodes an LNURL bech32 string to a URL
 * @param lnurl LNURL string (bech32-encoded)
 * @returns Decoded URL or null if invalid
 */
export function decodeLnurl(lnurl: string): string | null {
  try {
    if (!lnurl.toLowerCase().startsWith('lnurl')) {
      return null;
    }
    
    // Use the bech32 library to decode
    // The bech32 library expects the input in specific format (string with '1' separator)
    // Since LNURL is a bech32 string that starts with 'lnurl', we need to ensure it's valid
    const decoded = bech32.decode(lnurl as `lnurl1${string}`, 1023);
    const words = decoded.words;
    const bytes = bech32.fromWords(words);
    
    // Convert bytes to URL string
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (error) {
    console.error('Error decoding LNURL:', error);
    return null;
  }
}

/**
 * Parses a bolt11 invoice and extracts relevant data
 * @param bolt11 The bolt11 invoice string
 * @returns Object with parsed data or null if parsing failed
 */
export function parseBolt11Invoice(bolt11: string): { 
  paymentHash?: string; 
  descriptionHash?: string; 
  amount?: string; 
  timestamp?: number;
  description?: string;
} | null {
  try {
    // Use any to bypass type issues
    const decoded = decode(bolt11) as any;
    
    // Extract fields from the decoded invoice
    const result: {
      paymentHash?: string;
      descriptionHash?: string;
      amount?: string;
      timestamp?: number;
      description?: string;
    } = {};
    
    // Find timestamp
    const timestampSection = decoded.sections.find((s: any) => s.name === 'timestamp');
    if (timestampSection) {
      result.timestamp = timestampSection.value;
    }
    
    // Find amount
    const amountSection = decoded.sections.find((s: any) => s.name === 'amount');
    if (amountSection && amountSection.value) {
      result.amount = amountSection.value.toString();
    }
    
    // Find payment hash
    const paymentHashSection = decoded.sections.find((s: any) => s.name === 'payment_hash');
    if (paymentHashSection && paymentHashSection.value) {
      result.paymentHash = paymentHashSection.value;
    }
    
    // Find description
    const descriptionSection = decoded.sections.find((s: any) => s.name === 'description');
    if (descriptionSection && descriptionSection.value) {
      result.description = descriptionSection.value;
    }
    
    // Find description hash (tag 'h')
    const descriptionHashSection = decoded.sections.find(
      (s: any) => s.name === 'description_hash' || s.name === 'purpose_commit_hash'
    );
    if (descriptionHashSection && descriptionHashSection.value) {
      result.descriptionHash = descriptionHashSection.value;
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing bolt11 invoice:', error);
    return null;
  }
}

/**
 * Builds a LNURL callback URL with a zap request
 * @param callbackUrl Base LNURL callback URL
 * @param zapRequestEvent JSON string of the zap request event
 * @param amount Amount in millisats
 * @returns Full callback URL
 */
export function buildZapCallbackUrl(
  callbackUrl: string,
  zapRequestEvent: string, 
  amount: number
): string {
  // Create URL object to handle query parameters properly
  const url = new URL(callbackUrl);
  
  // Add amount and nostr parameters
  url.searchParams.append('amount', amount.toString());
  url.searchParams.append('nostr', encodeURIComponent(zapRequestEvent));
  
  return url.toString();
}

/**
 * Extract metadata from LNURL JSON metadata string
 * @param metadataString JSON metadata string from LNURL response
 * @returns Object with extracted metadata or null if invalid
 */
export function extractLnurlMetadata(metadataString: string): Record<string, string> | null {
  try {
    const metadata = JSON.parse(metadataString);
    
    if (!Array.isArray(metadata)) {
      return null;
    }
    
    const result: Record<string, string> = {};
    
    for (const item of metadata) {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string') {
        result[item[0]] = item[1].toString();
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing LNURL metadata:', error);
    return null;
  }
}

export default {
  fetchLnurlPayMetadata,
  supportsNostrZaps,
  decodeLnurl,
  buildZapCallbackUrl,
  extractLnurlMetadata,
  parseBolt11Invoice,
  getLightningAddressUrl
}; 