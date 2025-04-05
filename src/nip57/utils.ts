/**
 * Utility functions for NIP-57 (Lightning Zaps)
 */

import { LnurlPayResponse } from './index';
import { bech32 } from '@scure/base';

/**
 * Fetches and validates LNURL pay metadata from a URL
 * @param lnurlOrUrl LNURL (bech32-encoded) or direct URL
 * @returns LNURL pay response if valid and supports Nostr, null otherwise
 */
export async function fetchLnurlPayMetadata(lnurlOrUrl: string): Promise<LnurlPayResponse | null> {
  try {
    // Convert LNURL to URL if needed
    const url = lnurlOrUrl.toLowerCase().startsWith('lnurl') 
      ? decodeLnurl(lnurlOrUrl)
      : lnurlOrUrl;
    
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
  extractLnurlMetadata
}; 