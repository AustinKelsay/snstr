/**
 * NIP-19 Security Utilities
 * 
 * This module provides security enhancements for NIP-19 decoded entities
 * to prevent attacks like XSS through invalid relay URLs.
 */

import type { ProfileData, EventData, AddressData } from './index';

/**
 * Validates if a relay URL is safe to use
 * - Must start with wss:// or ws:// 
 * - Must be a valid URL
 * - No credentials (username/password) in URL
 */
export function isValidRelayUrl(url: string): boolean {
  try {
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      return false;
    }
    
    const parsedUrl = new URL(url);
    
    // Check for credentials in the URL (username or password)
    if (parsedUrl.username || parsedUrl.password) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Filter invalid relay URLs from a decoded profile
 * Use this after decoding with decodeProfile() for enhanced security
 */
export function filterProfile(profile: ProfileData): ProfileData {
  if (!profile.relays || profile.relays.length === 0) {
    return profile;
  }
  
  return {
    ...profile,
    relays: profile.relays.filter(isValidRelayUrl)
  };
}

/**
 * Filter invalid relay URLs from a decoded event
 * Use this after decoding with decodeEvent() for enhanced security
 */
export function filterEvent(event: EventData): EventData {
  if (!event.relays || event.relays.length === 0) {
    return event;
  }
  
  return {
    ...event,
    relays: event.relays.filter(isValidRelayUrl)
  };
}

/**
 * Filter invalid relay URLs from a decoded address
 * Use this after decoding with decodeAddress() for enhanced security
 */
export function filterAddress(address: AddressData): AddressData {
  if (!address.relays || address.relays.length === 0) {
    return address;
  }
  
  return {
    ...address,
    relays: address.relays.filter(isValidRelayUrl)
  };
}

/**
 * Safely decode any NIP-19 entity that contains relay URLs
 * Returns the filtered result with only valid relay URLs
 * 
 * @param entity The decoded entity (from decodeProfile, decodeEvent, decodeAddress)
 * @returns A filtered entity with only valid relay URLs
 */
export function filterEntity<T extends ProfileData | EventData | AddressData>(entity: T): T {
  if ('pubkey' in entity && 'relays' in entity) {
    return filterProfile(entity as ProfileData) as T;
  } else if ('id' in entity && 'relays' in entity) {
    return filterEvent(entity as EventData) as T;
  } else if ('identifier' in entity && 'kind' in entity && 'relays' in entity) {
    return filterAddress(entity as AddressData) as T;
  }
  
  // If we can't determine the type, return as is
  return entity;
} 