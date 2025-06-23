/**
 * Centralized Security Validation Utilities
 * 
 * This module provides comprehensive security validation for the SNSTR library,
 * addressing the critical vulnerabilities identified in the security audit.
 */

import { NostrEvent, Filter } from '../types/nostr';

// Security Constants
export const SECURITY_LIMITS = {
  // Content size limits (prevent DoS via large payloads)
  MAX_CONTENT_SIZE: 100000, // 100KB
  MAX_TAG_SIZE: 1000,
  MAX_TAG_COUNT: 100,
  MAX_TAG_ELEMENT_SIZE: 512,
  
  // Filter limits (prevent DoS via complex filters)
  MAX_FILTER_COUNT: 20,
  MAX_FILTER_IDS: 1000,
  MAX_FILTER_AUTHORS: 1000,
  MAX_FILTER_KINDS: 100,
  MAX_FILTER_TAG_VALUES: 1000,
  MAX_SEARCH_LENGTH: 500,
  
  // Array access safety
  MAX_ARRAY_SIZE: 10000,
  MAX_OBJECT_DEPTH: 10,
  
  // String limits
  MAX_STRING_LENGTH: 100000,
  MAX_URL_LENGTH: 2048,
  MAX_PUBKEY_LENGTH: 64,
  MAX_SIGNATURE_LENGTH: 128,
  MAX_ID_LENGTH: 64,
  
  // Numeric limits
  MIN_KIND: 0,
  MAX_KIND: 65535,
  MIN_CREATED_AT: 946684800, // Jan 1, 2000
  MAX_CREATED_AT: 4102444800, // Jan 1, 2100
  MIN_LIMIT: 0,
  MAX_LIMIT: 5000,
  MIN_SINCE: 946684800,
  MAX_UNTIL: 4102444800,
  
  // Memory limits for relay buffers (prevent memory exhaustion)
  MAX_RELAY_EVENT_BUFFERS: 1000, // Maximum number of event buffers per relay
  MAX_EVENTS_PER_BUFFER: 100, // Maximum events per buffer
  MAX_REPLACEABLE_EVENT_PUBKEYS: 10000, // Maximum pubkeys to track replaceable events
  MAX_REPLACEABLE_EVENTS_PER_PUBKEY: 50, // Maximum replaceable events per pubkey
  MAX_ADDRESSABLE_EVENTS: 50000, // Maximum addressable events to store
} as const;

// Security error types
export class SecurityValidationError extends Error {
  constructor(message: string, public code: string, public field?: string) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

// Secure random number generation
export function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomInt(0, 0x100000000) / 0x100000000;
  } else {
    throw new SecurityValidationError(
      'No secure random source available',
      'NO_SECURE_RANDOM'
    );
  }
}

// Secure random bytes generation
export function secureRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(length);
  } else {
    throw new SecurityValidationError(
      'No secure random source available',
      'NO_SECURE_RANDOM'
    );
  }
}

// Secure random string generation (for IDs, nonces, etc.)
export function secureRandomHex(length: number): string {
  const bytes = secureRandomBytes(Math.ceil(length / 2));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

// Input sanitization
export function sanitizeString(input: unknown, maxLength: number = SECURITY_LIMITS.MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') {
    throw new SecurityValidationError(
      'Input must be a string',
      'INVALID_TYPE',
      'string'
    );
  }
  
  if (input.length > maxLength) {
    throw new SecurityValidationError(
      `String exceeds maximum length of ${maxLength}`,
      'STRING_TOO_LONG',
      'length'
    );
  }
  
  return input;
}

// Bounds checking for array access
export function validateArrayAccess<T>(array: T[], index: number, context: string = 'array'): T {
  if (!Array.isArray(array)) {
    throw new SecurityValidationError(
      `${context} must be an array`,
      'NOT_ARRAY',
      context
    );
  }
  
  if (array.length > SECURITY_LIMITS.MAX_ARRAY_SIZE) {
    throw new SecurityValidationError(
      `${context} exceeds maximum size of ${SECURITY_LIMITS.MAX_ARRAY_SIZE}`,
      'ARRAY_TOO_LARGE',
      context
    );
  }
  
  if (index < 0 || index >= array.length) {
    throw new SecurityValidationError(
      `Array index ${index} out of bounds for ${context} with length ${array.length}`,
      'INDEX_OUT_OF_BOUNDS',
      context
    );
  }
  
  return array[index];
}

// Safe array access with bounds checking
export function safeArrayAccess<T>(array: T[], index: number, defaultValue?: T): T | undefined {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index];
}

// Numeric validation
export function validateNumber(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new SecurityValidationError(
      `${field} must be a valid finite number`,
      'INVALID_NUMBER',
      field
    );
  }
  
  if (value < min || value > max) {
    throw new SecurityValidationError(
      `${field} must be between ${min} and ${max}`,
      'NUMBER_OUT_OF_RANGE',
      field
    );
  }
  
  return value;
}

// Event content validation
export function validateEventContent(content: unknown): string {
  const contentStr = sanitizeString(content, SECURITY_LIMITS.MAX_CONTENT_SIZE);
  
  // Additional content validation could go here
  // e.g., checking for suspicious patterns, encoding issues, etc.
  
  return contentStr;
}

// Tag validation
export function validateTags(tags: unknown): string[][] {
  if (!Array.isArray(tags)) {
    throw new SecurityValidationError(
      'Tags must be an array',
      'INVALID_TAGS_TYPE',
      'tags'
    );
  }
  
  if (tags.length > SECURITY_LIMITS.MAX_TAG_COUNT) {
    throw new SecurityValidationError(
      `Too many tags: ${tags.length} (max ${SECURITY_LIMITS.MAX_TAG_COUNT})`,
      'TOO_MANY_TAGS',
      'tags'
    );
  }
  
  return tags.map((tag, tagIndex) => {
    if (!Array.isArray(tag)) {
      throw new SecurityValidationError(
        `Tag at index ${tagIndex} must be an array`,
        'INVALID_TAG_TYPE',
        `tags[${tagIndex}]`
      );
    }
    
    if (tag.length > SECURITY_LIMITS.MAX_TAG_SIZE) {
      throw new SecurityValidationError(
        `Tag at index ${tagIndex} has too many elements: ${tag.length} (max ${SECURITY_LIMITS.MAX_TAG_SIZE})`,
        'TAG_TOO_LARGE',
        `tags[${tagIndex}]`
      );
    }
    
    return tag.map((element, _elementIndex) => {
      const elementStr = sanitizeString(element, SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE);
      return elementStr;
    });
  });
}

// Filter validation
export function validateFilter(filter: unknown): Filter {
  if (!filter || typeof filter !== 'object') {
    throw new SecurityValidationError(
      'Filter must be an object',
      'INVALID_FILTER_TYPE',
      'filter'
    );
  }
  
  const f = filter as Record<string, unknown>;
  const validatedFilter: Partial<Filter> = {};
  
  // Validate ids
  if (f.ids !== undefined) {
    if (!Array.isArray(f.ids)) {
      throw new SecurityValidationError(
        'Filter ids must be an array',
        'INVALID_FILTER_IDS_TYPE',
        'filter.ids'
      );
    }
    
    if (f.ids.length > SECURITY_LIMITS.MAX_FILTER_IDS) {
      throw new SecurityValidationError(
        `Too many filter ids: ${f.ids.length} (max ${SECURITY_LIMITS.MAX_FILTER_IDS})`,
        'TOO_MANY_FILTER_IDS',
        'filter.ids'
      );
    }
    
    validatedFilter.ids = f.ids.map((id, index) => {
      const idStr = sanitizeString(id, SECURITY_LIMITS.MAX_ID_LENGTH);
      if (!/^[0-9a-f]+$/i.test(idStr)) {
        throw new SecurityValidationError(
          `Invalid ID format at index ${index}: ${idStr}`,
          'INVALID_ID_FORMAT',
          `filter.ids[${index}]`
        );
      }
      return idStr;
    });
  }
  
  // Validate authors
  if (f.authors !== undefined) {
    if (!Array.isArray(f.authors)) {
      throw new SecurityValidationError(
        'Filter authors must be an array',
        'INVALID_FILTER_AUTHORS_TYPE',
        'filter.authors'
      );
    }
    
    if (f.authors.length > SECURITY_LIMITS.MAX_FILTER_AUTHORS) {
      throw new SecurityValidationError(
        `Too many filter authors: ${f.authors.length} (max ${SECURITY_LIMITS.MAX_FILTER_AUTHORS})`,
        'TOO_MANY_FILTER_AUTHORS',
        'filter.authors'
      );
    }
    
    validatedFilter.authors = f.authors.map((author, index) => {
      const authorStr = sanitizeString(author, SECURITY_LIMITS.MAX_PUBKEY_LENGTH);
      if (!/^[0-9a-f]+$/i.test(authorStr)) {
        throw new SecurityValidationError(
          `Invalid author format at index ${index}: ${authorStr}`,
          'INVALID_AUTHOR_FORMAT',
          `filter.authors[${index}]`
        );
      }
      return authorStr;
    });
  }
  
  // Validate kinds
  if (f.kinds !== undefined) {
    if (!Array.isArray(f.kinds)) {
      throw new SecurityValidationError(
        'Filter kinds must be an array',
        'INVALID_FILTER_KINDS_TYPE',
        'filter.kinds'
      );
    }
    
    if (f.kinds.length > SECURITY_LIMITS.MAX_FILTER_KINDS) {
      throw new SecurityValidationError(
        `Too many filter kinds: ${f.kinds.length} (max ${SECURITY_LIMITS.MAX_FILTER_KINDS})`,
        'TOO_MANY_FILTER_KINDS',
        'filter.kinds'
      );
    }
    
    validatedFilter.kinds = f.kinds.map((kind, index) => {
      return validateNumber(kind, SECURITY_LIMITS.MIN_KIND, SECURITY_LIMITS.MAX_KIND, `filter.kinds[${index}]`);
    });
  }
  
  // Validate limit
  if (f.limit !== undefined) {
    validatedFilter.limit = validateNumber(f.limit, SECURITY_LIMITS.MIN_LIMIT, SECURITY_LIMITS.MAX_LIMIT, 'filter.limit');
  }
  
  // Validate since
  if (f.since !== undefined) {
    validatedFilter.since = validateNumber(f.since, SECURITY_LIMITS.MIN_SINCE, SECURITY_LIMITS.MAX_UNTIL, 'filter.since');
  }
  
  // Validate until
  if (f.until !== undefined) {
    validatedFilter.until = validateNumber(f.until, SECURITY_LIMITS.MIN_SINCE, SECURITY_LIMITS.MAX_UNTIL, 'filter.until');
  }
  
  // Validate search
  if (f.search !== undefined) {
    validatedFilter.search = sanitizeString(f.search, SECURITY_LIMITS.MAX_SEARCH_LENGTH);
  }
  
  // Validate tag filters (#e, #p, etc.)
  for (const [key, value] of Object.entries(f)) {
    if (key.startsWith('#') && key.length === 2) {
      if (!Array.isArray(value)) {
        throw new SecurityValidationError(
          `Filter tag ${key} must be an array`,
          'INVALID_FILTER_TAG_TYPE',
          `filter.${key}`
        );
      }
      
      if (value.length > SECURITY_LIMITS.MAX_FILTER_TAG_VALUES) {
        throw new SecurityValidationError(
          `Too many filter tag values for ${key}: ${value.length} (max ${SECURITY_LIMITS.MAX_FILTER_TAG_VALUES})`,
          'TOO_MANY_FILTER_TAG_VALUES',
          `filter.${key}`
        );
      }
      
      (validatedFilter as Record<string, unknown>)[key] = value.map((tagValue, _index) => {
        return sanitizeString(tagValue, SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE);
      });
    }
  }
  
  return validatedFilter as Filter;
}

// Validate array of filters
export function validateFilters(filters: unknown): Filter[] {
  if (!Array.isArray(filters)) {
    throw new SecurityValidationError(
      'Filters must be an array',
      'INVALID_FILTERS_TYPE',
      'filters'
    );
  }
  
  if (filters.length > SECURITY_LIMITS.MAX_FILTER_COUNT) {
    throw new SecurityValidationError(
      `Too many filters: ${filters.length} (max ${SECURITY_LIMITS.MAX_FILTER_COUNT})`,
      'TOO_MANY_FILTERS',
      'filters'
    );
  }
  
  return filters.map((filter, index) => {
    try {
      return validateFilter(filter);
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        throw new SecurityValidationError(
          `Filter at index ${index}: ${error.message}`,
          error.code,
          `filters[${index}].${error.field || 'unknown'}`
        );
      }
      throw error;
    }
  });
}

// Event validation
export function validateEvent(event: unknown): NostrEvent {
  if (!event || typeof event !== 'object') {
    throw new SecurityValidationError(
      'Event must be an object',
      'INVALID_EVENT_TYPE',
      'event'
    );
  }
  
  const e = event as Record<string, unknown>;
  
  // Validate required fields
  const id = sanitizeString(e.id, SECURITY_LIMITS.MAX_ID_LENGTH);
  const pubkey = sanitizeString(e.pubkey, SECURITY_LIMITS.MAX_PUBKEY_LENGTH);
  const sig = sanitizeString(e.sig, SECURITY_LIMITS.MAX_SIGNATURE_LENGTH);
  const content = validateEventContent(e.content);
  const tags = validateTags(e.tags);
  const kind = validateNumber(e.kind, SECURITY_LIMITS.MIN_KIND, SECURITY_LIMITS.MAX_KIND, 'event.kind');
  const created_at = validateNumber(e.created_at, SECURITY_LIMITS.MIN_CREATED_AT, SECURITY_LIMITS.MAX_CREATED_AT, 'event.created_at');
  
  // Validate formats
  if (!/^[0-9a-f]{64}$/i.test(id)) {
    throw new SecurityValidationError(
      'Event ID must be 64-character hex',
      'INVALID_EVENT_ID_FORMAT',
      'event.id'
    );
  }
  
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    throw new SecurityValidationError(
      'Event pubkey must be 64-character hex',
      'INVALID_EVENT_PUBKEY_FORMAT',
      'event.pubkey'
    );
  }
  
  if (!/^[0-9a-f]{128}$/i.test(sig)) {
    throw new SecurityValidationError(
      'Event signature must be 128-character hex',
      'INVALID_EVENT_SIGNATURE_FORMAT',
      'event.sig'
    );
  }
  
  return {
    id,
    pubkey,
    sig,
    content,
    tags,
    kind,
    created_at
  };
}

// Rate limiting helper
export interface RateLimitState {
  count: number;
  windowStart: number;
  blocked: boolean;
}

export function checkRateLimit(
  state: RateLimitState,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { allowed: boolean; retryAfter?: number } {
  // Reset window if expired
  if (now - state.windowStart >= windowMs) {
    state.count = 0;
    state.windowStart = now;
    state.blocked = false;
  }
  
  // Check if blocked
  if (state.blocked) {
    const retryAfter = Math.ceil((windowMs - (now - state.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Check limit
  if (state.count >= limit) {
    state.blocked = true;
    const retryAfter = Math.ceil((windowMs - (now - state.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Allow and increment
  state.count++;
  return { allowed: true };
}

// Memory-safe string operations
export function secureStringZero(_str: string): void {
  // Note: JavaScript strings are immutable, so we can't actually zero them
  // This is a placeholder for documentation and potential future implementation
  // with secure string libraries
} 