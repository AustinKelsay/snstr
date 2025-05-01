/**
 * NIP-11: Relay Information Document
 * 
 * Implementation of the NIP-11 specification which describes 
 * how relays provide information about their capabilities, 
 * limitations, and contact details.
 * 
 * @see https://github.com/nostr-protocol/nips/blob/master/11.md
 */

import { RelayInfo } from './types';
export * from './types';

// Cache for relay information to avoid repeated requests
const relayInfoCache: Record<string, { info: RelayInfo | null; timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

// Default fetch implementation
let fetchImplementation = globalThis.fetch;

/**
 * Configure the fetch implementation to use
 * This is useful for environments without native fetch support
 * 
 * @param fetchImpl - The fetch implementation to use
 */
export function useFetchImplementation(fetchImpl: typeof fetch) {
  fetchImplementation = fetchImpl;
}

/**
 * Validates if the input is a proper WebSocket URL
 * 
 * @param url - URL to validate
 * @returns Boolean indicating if the URL is a valid WebSocket URL
 */
function isValidWebSocketURL(url: string): boolean {
  return /^wss?:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
}

/**
 * Fetch relay information document as defined in NIP-11
 * 
 * Makes an HTTP request to a relay URL with the appropriate Accept header
 * to get the relay metadata document. Note that this uses HTTP(S), not WebSocket.
 * 
 * @param url - WebSocket URL of the relay (ws:// or wss://)
 * @param options - Optional configuration
 * @returns Promise resolving to RelayInfo object, or null if not available
 */
export async function fetchRelayInformation(
  url: string,
  options: { useCache?: boolean; timeoutMs?: number } = {}
): Promise<RelayInfo | null> {
  // Default options
  const { useCache = true, timeoutMs = 5000 } = options;
  
  // Validate the URL
  if (!isValidWebSocketURL(url)) {
    console.error(`Invalid WebSocket URL: ${url}`);
    return null;
  }
  
  // Check cache first if enabled
  const now = Date.now();
  if (useCache && relayInfoCache[url] && (now - relayInfoCache[url].timestamp) < CACHE_TTL) {
    return relayInfoCache[url].info;
  }
  
  try {
    // Convert WebSocket URL to HTTP(S) URL
    const httpUrl = url.replace(/^ws(s)?:\/\//, 'http$1://');
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Fetch the relay information document using the proper Accept header
    const response = await fetchImplementation(httpUrl, {
      headers: {
        'Accept': 'application/nostr+json'
      },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // If the response is successful, parse as JSON
    if (response.ok) {
      const relayInfo = await response.json();
      
      // Update cache
      if (useCache) {
        relayInfoCache[url] = { info: relayInfo, timestamp: now };
      }
      
      return relayInfo as RelayInfo;
    }
    
    // Cache negative result too
    if (useCache) {
      relayInfoCache[url] = { info: null, timestamp: now };
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to fetch relay information from ${url}:`, error);
    
    // Cache negative result
    if (useCache) {
      relayInfoCache[url] = { info: null, timestamp: now };
    }
    
    return null;
  }
}

/**
 * Clear the relay information cache
 * Useful for testing or when you need fresh data
 */
export function clearRelayInfoCache() {
  Object.keys(relayInfoCache).forEach(key => {
    delete relayInfoCache[key];
  });
}

/**
 * Check if a relay URL supports NIP-11
 * 
 * @param url - WebSocket URL of the relay (ws:// or wss://) 
 * @returns Promise resolving to boolean indicating if NIP-11 is supported
 */
export async function supportsNIP11(url: string): Promise<boolean> {
  const info = await fetchRelayInformation(url);
  return info !== null;
}

/**
 * Check if a relay supports specific NIPs
 * 
 * @param url - WebSocket URL of the relay (ws:// or wss://)
 * @param nipNumbers - Array of NIP numbers to check for support
 * @returns Promise resolving to boolean indicating if all specified NIPs are supported
 */
export async function relaySupportsNIPs(url: string, nipNumbers: number[]): Promise<boolean> {
  const info = await fetchRelayInformation(url);
  
  if (!info || !info.supported_nips) {
    return false;
  }
  
  // Check if all requested NIPs are supported
  return nipNumbers.every(nip => info.supported_nips!.includes(nip));
}

/**
 * Get payment information for a relay
 * 
 * @param url - WebSocket URL of the relay (ws:// or wss://)
 * @returns Promise resolving to payment URL if available, null otherwise
 */
export async function getRelayPaymentInfo(url: string): Promise<string | null> {
  const info = await fetchRelayInformation(url);
  return info?.payments_url || null;
}

/**
 * Check if a relay requires payment
 * 
 * @param url - WebSocket URL of the relay (ws:// or wss://)
 * @returns Promise resolving to boolean indicating if payments are required
 */
export async function relayRequiresPayment(url: string): Promise<boolean> {
  const info = await fetchRelayInformation(url);
  return !!info?.limitation?.payments_required;
} 