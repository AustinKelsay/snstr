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
export async function verifyNIP05(
  identifier: string,
  pubkey: string,
): Promise<boolean> {
  try {
    const [name, domain] = identifier.split("@");

    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return false;
    }

    const response = await lookupNIP05(identifier);
    if (!response) return false;

    // Check if the name exists in the response and corresponds to our pubkey
    return response.names[name.toLowerCase()] === pubkey;
  } catch (error) {
    return false;
  }
}

/**
 * Lookup NIP-05 identifier and get the associated pubkey and relays
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to NIP05Response or null if lookup fails
 */
export async function lookupNIP05(
  identifier: string,
): Promise<NIP05Response | null> {
  try {
    const [name, domain] = identifier.split("@");

    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return null;
    }

    // Construct the URL for the NIP-05 JSON file
    const url = `https://${domain}/.well-known/nostr.json?name=${name.toLowerCase()}`;

    // Set up fetch options with headers
    const fetchOptions: RequestInit = {
      method: "GET",
      headers: { Accept: "application/json" },
    };

    // Add TLS certificate validation
    // Note: In browsers, TLS validation is handled automatically
    // In Node.js environments, this would need to be handled with an https agent
    // but we'll use the default fetch behavior which should validate certificates

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Check if the response contains the required names field
    if (!data || !data.names) {
      return null;
    }

    return data as NIP05Response;
  } catch (error) {
    return null;
  }
}

/**
 * Get the public key for a given NIP-05 identifier
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @returns Promise that resolves to pubkey in hex format or null if lookup fails
 */
export async function getNIP05PubKey(
  identifier: string,
): Promise<string | null> {
  try {
    const [name, domain] = identifier.split("@");

    // If the identifier isn't properly formatted
    if (!name || !domain) {
      return null;
    }

    const response = await lookupNIP05(identifier);
    if (!response) return null;

    // Check if the name exists in the response
    return response.names[name.toLowerCase()] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get the relays for a given NIP-05 identifier and pubkey
 *
 * @param identifier - NIP-05 identifier in the format username@domain.com
 * @param pubkey - The Nostr public key in hex format
 * @returns Promise that resolves to array of relay URLs or null if lookup fails
 */
export async function getNIP05Relays(
  identifier: string,
  pubkey: string,
): Promise<string[] | null> {
  try {
    const response = await lookupNIP05(identifier);
    if (!response || !response.relays || !response.relays[pubkey]) return null;

    return response.relays[pubkey];
  } catch (error) {
    return null;
  }
}
