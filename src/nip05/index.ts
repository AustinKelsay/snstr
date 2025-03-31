/**
 * NIP-05: Mapping Nostr keys to DNS-based internet identifiers
 * Implementation based on https://github.com/nostr-protocol/nips/blob/master/05.md
 */

interface NIP05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

/**
 * Verify if a NIP-05 identifier matches a given public key
 * 
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @param pubkey - The Nostr public key in hex format
 * @returns Promise that resolves to boolean indicating if verification was successful
 */
export async function verifyNIP05(identifier: string, pubkey: string): Promise<boolean> {
  try {
    const [name, domain] = identifier.split('@');
    
    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return false;
    }
    
    const response = await lookupNIP05(identifier);
    
    // Check if the name exists in the response and the pubkey matches
    return response?.names[name] === pubkey;
  } catch (error) {
    return false;
  }
}

/**
 * Lookup a NIP-05 identifier to get the associated public key and relays
 * 
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to NIP05Response or null if not found/invalid
 */
export async function lookupNIP05(identifier: string): Promise<NIP05Response | null> {
  try {
    const [name, domain] = identifier.split('@');
    
    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return null;
    }
    
    // Handle the special case for root identifiers
    const localPart = name === '_' ? '' : `?name=${encodeURIComponent(name)}`;
    
    // Make request to the well-known URL
    const url = `https://${domain}/.well-known/nostr.json${localPart}`;
    const response = await fetch(url);
    
    // If response is not OK, return null
    if (!response.ok) {
      return null;
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    // Verify it has the required structure
    if (!data.names || typeof data.names !== 'object') {
      return null;
    }
    
    return data as NIP05Response;
  } catch (error) {
    return null;
  }
}

/**
 * Get the public key associated with a NIP-05 identifier
 * 
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to the public key or null if not found/invalid
 */
export async function getPublicKeyFromNIP05(identifier: string): Promise<string | null> {
  try {
    const [name, domain] = identifier.split('@');
    
    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return null;
    }
    
    const response = await lookupNIP05(identifier);
    
    // If response is null or doesn't contain the name
    if (!response || !response.names[name]) {
      return null;
    }
    
    return response.names[name];
  } catch (error) {
    return null;
  }
}

/**
 * Get the recommended relays for a Nostr public key from a NIP-05 identifier
 * 
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @param pubkey - Optional public key to verify against
 * @returns Promise that resolves to an array of relay URLs or null
 */
export async function getRelaysFromNIP05(
  identifier: string, 
  pubkey?: string
): Promise<string[] | null> {
  try {
    const response = await lookupNIP05(identifier);
    
    // If response is null or doesn't contain relays
    if (!response || !response.relays) {
      return null;
    }
    
    // If pubkey is provided, check relays for that specific key
    if (pubkey && response.relays[pubkey]) {
      return response.relays[pubkey];
    }
    
    // Otherwise, try to get the public key from the identifier
    const [name] = identifier.split('@');
    const key = response.names[name];
    
    // If the key exists and has relays
    if (key && response.relays[key]) {
      return response.relays[key];
    }
    
    return null;
  } catch (error) {
    return null;
  }
} 