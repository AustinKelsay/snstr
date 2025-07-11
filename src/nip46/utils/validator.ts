import { NIP46Request, NIP46Method } from "../types";
import { Logger, LogLevel } from "./logger";

/**
 * Enhanced validation utilities for NIP-46 security
 */

// Maximum sizes to prevent DoS attacks
export const MAX_CONTENT_SIZE = 65536; // 64KB
export const MAX_ID_LENGTH = 64;
export const MAX_PARAMS_COUNT = 10;
export const MAX_PARAM_LENGTH = 32768; // 32KB per param
export const MAX_TAGS_COUNT = 100; // Maximum number of tags per event
export const MAX_TAG_ELEMENT_LENGTH = 2048; // Maximum length per tag element

/**
 * Validate event content size and structure
 */
export function validateEventContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check content size limits
  if (content.length > MAX_CONTENT_SIZE) {
    return false;
  }

  // Validate JSON structure for event data
  try {
    const parsed = JSON.parse(content);
    return validateEventStructure(parsed);
  } catch (error) {
    // Log parsing error for debugging while sanitizing sensitive data
    const errorMessage = error instanceof Error ? error.message : 'Unknown JSON parsing error';
    SecureErrorHandler.logSecurityEvent(
      'JSON parsing failed in validateEventContent',
      { 
        error: SecureErrorHandler.sanitizeError(
          new Error(errorMessage), 
          process.env.NODE_ENV !== 'production'
        ),
        contentLength: content.length,
        contentPreview: sanitizeString(content, 50)
      }
    );
    return false;
  }
}

/**
 * Validate event structure for signing requests
 */
function validateEventStructure(event: unknown): boolean {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const eventObj = event as Record<string, unknown>;

  // Required fields for event signing
  const requiredFields = ['kind', 'content', 'created_at'];
  for (const field of requiredFields) {
    if (!(field in eventObj)) {
      return false;
    }
  }

  // Validate field types
  if (typeof eventObj.kind !== 'number' || 
      typeof eventObj.content !== 'string' ||
      typeof eventObj.created_at !== 'number') {
    return false;
  }

  // Validate kind range (0-65535)
  if (eventObj.kind < 0 || eventObj.kind > 65535) {
    return false;
  }

  // Validate timestamp (reasonable range) - relaxed for offline signing
  const now = Math.floor(Date.now() / 1000);
  const maxSkew = 86400; // 24 hours tolerance for offline signing
  if (Math.abs(now - eventObj.created_at) > maxSkew) {
    return false;
  }

  // Validate tags if present
  if (eventObj.tags && !validateTags(eventObj.tags)) {
    return false;
  }

  return true;
}

/**
 * Validate event tags structure
 */
function validateTags(tags: unknown): boolean {
  if (!Array.isArray(tags)) {
    return false;
  }

  // Limit the number of tags to prevent DoS attacks
  if (tags.length > MAX_TAGS_COUNT) {
    return false;
  }

  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length === 0) {
      return false;
    }

    // All tag elements must be strings
    for (const element of tag) {
      if (typeof element !== 'string') {
        return false;
      }

      // Limit the length of each tag element to prevent DoS attacks
      if (element.length > MAX_TAG_ELEMENT_LENGTH) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate public key format (strict hex validation)
 */
export function validatePubkey(pubkey: string): boolean {
  if (!pubkey || typeof pubkey !== 'string') {
    return false;
  }

  // Must be exactly 64 characters of hex (case-insensitive)
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Validate event ID format
 */
export function validateEventId(eventId: string): boolean {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }

  // Must be exactly 64 characters of hex (case-insensitive)
  return /^[0-9a-f]{64}$/i.test(eventId);
}

/**
 * Validate signature format
 */
export function validateSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  // Must be exactly 128 characters of hex (case-insensitive)
  return /^[0-9a-f]{128}$/i.test(signature);
}

/**
 * Validate private key format (for internal use)
 */
export function validatePrivateKey(privateKey: string): boolean {
  if (!privateKey || typeof privateKey !== 'string') {
    return false;
  }

  // Must be exactly 64 characters of hex (case-insensitive)
  return /^[0-9a-f]{64}$/i.test(privateKey);
}

/**
 * Validate complete NIP-46 request payload
 */
export function validateRequestPayload(request: NIP46Request): boolean {
  if (!request || typeof request !== 'object') {
    return false;
  }

  // Validate required fields
  if (!request.id || !request.method || !Array.isArray(request.params)) {
    return false;
  }

  // Validate ID format and length
  if (typeof request.id !== 'string' || 
      request.id.length === 0 || 
      request.id.length > MAX_ID_LENGTH) {
    return false;
  }

  // Validate method
  if (!isValidMethod(request.method)) {
    return false;
  }

  // Validate params
  if (!validateParams(request.params)) {
    return false;
  }

  // Validate optional pubkey if present
  if (request.pubkey && !validatePubkey(request.pubkey)) {
    return false;
  }

  return true;
}

/**
 * Validate NIP-46 method
 */
export function isValidMethod(method: string): boolean {
  return Object.values(NIP46Method).includes(method as NIP46Method);
}

/**
 * Validate request parameters
 */
export function validateParams(params: string[]): boolean {
  if (!Array.isArray(params)) {
    return false;
  }

  // Check parameter count
  if (params.length > MAX_PARAMS_COUNT) {
    return false;
  }

  // Validate each parameter
  for (const param of params) {
    if (typeof param !== 'string') {
      return false;
    }

    // Check parameter length
    if (param.length > MAX_PARAM_LENGTH) {
      return false;
    }
  }

  return true;
}

/**
 * Validate relay URL format
 */
export function validateRelayUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    
    // Must be WebSocket protocol
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return false;
    }

    // Enforce HTTPS in production (wss://)
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'wss:') {
      return false;
    }

    // Basic hostname validation
    if (!parsed.hostname || parsed.hostname.length < 4) {
      return false;
    }

    return true;
  } catch (error) {
    // Log URL parsing error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown URL parsing error';
    SecureErrorHandler.logSecurityEvent(
      'URL parsing failed in validateRelayUrl',
      { 
        error: SecureErrorHandler.sanitizeError(
          new Error(errorMessage), 
          process.env.NODE_ENV !== 'production'
        ),
        urlLength: url.length,
        urlPreview: sanitizeString(url, 50)
      }
    );
    return false;
  }
}

/**
 * Validate permission string format
 */
export function validatePermission(permission: string): boolean {
  if (!permission || typeof permission !== 'string') {
    return false;
  }

  const validPermissions = [
    'connect',
    'get_public_key',
    'get_relays',
    'sign_event',
    'ping', 
    'disconnect',
    'nip04_encrypt',
    'nip04_decrypt',
    'nip44_encrypt',
    'nip44_decrypt'
  ];

  // Check for basic permissions
  if (validPermissions.includes(permission)) {
    return true;
  }

  // Check for kind-specific permissions (e.g., "sign_event:1")
  const kindMatch = permission.match(/^sign_event:(\d+)$/);
  if (kindMatch) {
    const kind = parseInt(kindMatch[1], 10);
    return kind >= 0 && kind <= 65535;
  }

  return false;
}

/**
 * Validate connection string format
 */
export function validateConnectionString(connectionString: string): boolean {
  if (!connectionString || typeof connectionString !== 'string') {
    return false;
  }

  // Must start with bunker:// or nostrconnect://
  if (!connectionString.startsWith('bunker://') && 
      !connectionString.startsWith('nostrconnect://')) {
    return false;
  }

  try {
    const url = new URL(connectionString);
    
    // Extract and validate pubkey from hostname
    const pubkey = url.hostname;
    if (!validatePubkey(pubkey)) {
      return false;
    }

    // Validate relay URLs if present
    const relays = url.searchParams.getAll('relay');
    for (const relay of relays) {
      if (!validateRelayUrl(relay)) {
        return false;
      }
    }

    // Validate permissions if present
    const perms = url.searchParams.get('perms');
    if (perms) {
      const permissions = perms.split(',');
      for (const perm of permissions) {
        if (!validatePermission(perm.trim())) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    // Log connection string parsing error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown URL parsing error';
    SecureErrorHandler.logSecurityEvent(
      'Connection string parsing failed in validateConnectionString',
      { 
        error: SecureErrorHandler.sanitizeError(
          new Error(errorMessage), 
          process.env.NODE_ENV !== 'production'
        ),
        connectionStringLength: connectionString.length,
        connectionStringPreview: sanitizeString(connectionString, 50)
      }
    );
    return false;
  }
}

/**
 * Validate JSON string and return parsing result
 */
export function validateAndParseJson(jsonString: string): { valid: boolean; data?: unknown; error?: string } {
  if (!jsonString || typeof jsonString !== 'string') {
    return { valid: false, error: 'Invalid JSON string' };
  }

  // Check for reasonable size limits
  if (jsonString.length > MAX_CONTENT_SIZE) {
    return { valid: false, error: 'JSON string too large' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return { valid: true, data: parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    return { valid: false, error: `JSON parsing failed: ${errorMessage}` };
  }
}

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .slice(0, maxLength)
    .replace(/[<>"'&]/g, '') // Remove potentially dangerous characters
    .trim();
}

/**
 * Validate timestamp for replay attack prevention
 */
export function validateTimestamp(timestamp: number, maxAgeSeconds: number = 300): boolean {
  if (typeof timestamp !== 'number' || timestamp <= 0) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  // Reject timestamps too far in the past or future
  return age >= 0 && age <= maxAgeSeconds;
}

/**
 * Secure error handler to prevent information disclosure
 */
export class SecureErrorHandler {
  private static securityLogger: Logger | null = null;
  private static securityLoggingEnabled: boolean = process.env.NODE_ENV !== 'test';

  /**
   * Initialize security logging with a custom logger
   */
  static initializeSecurityLogging(logger?: Logger, enabled: boolean = true): void {
    SecureErrorHandler.securityLogger = logger || new Logger({
      prefix: "SECURITY",
      level: LogLevel.WARN,
      includeTimestamp: true,
      silent: false
    });
    SecureErrorHandler.securityLoggingEnabled = enabled;
  }

  /**
   * Enable or disable security event logging
   */
  static setSecurityLoggingEnabled(enabled: boolean): void {
    SecureErrorHandler.securityLoggingEnabled = enabled;
  }

  /**
   * Check if security logging is enabled
   */
  static isSecurityLoggingEnabled(): boolean {
    return SecureErrorHandler.securityLoggingEnabled;
  }

  /**
   * Sanitize error messages for safe client communication
   */
  static sanitizeError(error: Error, isDebug: boolean = false): string {
    const safeErrors = [
      'Authentication failed',
      'Permission denied', 
      'Invalid request format',
      'Rate limit exceeded',
      'Connection timeout',
      'Invalid method',
      'Invalid parameters',
      'Encryption failed',
      'Decryption failed'
    ];

    // In production, only return safe error messages
    if (!isDebug) {
      const message = error.message.trim();
      const isSafe = safeErrors.includes(message);
      return isSafe ? message : 'Operation failed';
    }

    // Even in debug mode, sanitize sensitive data
    return error.message.replace(/[0-9a-f]{64}/gi, '[KEY_REDACTED]');
  }

  /**
   * Log security events without exposing sensitive data
   */
  static logSecurityEvent(event: string, details: Record<string, unknown>, sensitive: string[] = []): void {
    if (!SecureErrorHandler.securityLoggingEnabled) {
      return;
    }

    const sanitizedDetails = { ...details };
    
    // Remove or mask sensitive fields
    for (const field of sensitive) {
      if (sanitizedDetails[field]) {
        sanitizedDetails[field] = '[REDACTED]';
      }
    }

    // Initialize default logger if none provided
    if (!SecureErrorHandler.securityLogger) {
      SecureErrorHandler.initializeSecurityLogging();
    }

    // Use the configured logger for security events
    SecureErrorHandler.securityLogger!.warn(`${event}`, sanitizedDetails);
  }
}