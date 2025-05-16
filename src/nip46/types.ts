/**
 * NIP-46 request message format
 */
export interface NIP46Request {
  id: string;
  method: NIP46Method;
  params: string[];
  pubkey?: string;
}

/**
 * NIP-46 response message format
 */
export interface NIP46Response {
  id: string;
  result?: string;
  error?: string;
  auth_url?: string; // For auth challenges
}

/**
 * Supported NIP-46 methods
 */
export enum NIP46Method {
  CONNECT = "connect",
  GET_PUBLIC_KEY = "get_public_key",
  SIGN_EVENT = "sign_event",
  PING = "ping",
  NIP04_ENCRYPT = "nip04_encrypt",
  NIP04_DECRYPT = "nip04_decrypt",
  NIP44_ENCRYPT = "nip44_encrypt",
  NIP44_DECRYPT = "nip44_decrypt",
}

/**
 * Base connection options
 */
export interface NIP46ConnectionOptions {
  relays?: string[];
  secret?: string;
  permissions?: string[];
}

/**
 * Client-specific options extending base connection options
 */
export interface NIP46ClientOptions extends NIP46ConnectionOptions {
  name?: string;
  url?: string;
  image?: string;
  timeout?: number; // Request timeout in milliseconds
  preferredEncryption?: "nip04" | "nip44";
  debug?: boolean;
}

/**
 * Bunker-specific options
 */
export interface NIP46BunkerOptions {
  userPubkey: string;
  signerPubkey?: string;
  relays?: string[];
  secret?: string;
  defaultPermissions?: string[];
  requireAuthChallenge?: boolean;
  authUrl?: string;
  authTimeout?: number;
  metadata?: NIP46Metadata;
  preferredEncryption?: "nip04" | "nip44";
  debug?: boolean;
}

/**
 * Metadata for NIP-46 bunker/client identification
 */
export interface NIP46Metadata {
  name?: string;
  url?: string;
  image?: string;
  relays?: string[];
  nostrconnect_url?: string; // Changed to match NIP-46 spec
}

/**
 * Authentication challenge data
 */
export interface NIP46AuthChallenge {
  id: string;
  clientPubkey: string;
  timestamp: number;
  permissions?: string[];
}

/**
 * Connection information for bunker or nostrconnect
 */
export interface NIP46ConnectionInfo {
  type: "bunker" | "nostrconnect";
  pubkey: string;
  relays: string[];
  secret?: string;
  permissions?: string[];
  metadata?: NIP46Metadata;
}

/**
 * Encryption operation result
 */
export type NIP46EncryptionResult = {
  success: boolean;
  method: "nip04" | "nip44";
} & (
  | {
      success: true;
      data: string;
      error?: never;
    }
  | {
      success: false;
      data?: never;
      error: string;
    }
);

/**
 * Client session data
 */
export interface NIP46ClientSession {
  permissions: Set<string>;
  lastSeen: number;
  preferredEncryption?: "nip04" | "nip44";
}

/**
 * Data for an unsigned event to be signed
 */
export interface NIP46UnsignedEventData {
  kind: number;
  content: string;
  created_at: number;
  tags?: string[][];
  pubkey?: string;
}

/**
 * Error types for NIP-46 operations
 */
export class NIP46Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46Error";
  }
}

export class NIP46ConnectionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46ConnectionError";
  }
}

export class NIP46TimeoutError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46TimeoutError";
  }
}

export class NIP46AuthorizationError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46AuthorizationError";
  }
}

export class NIP46EncryptionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46EncryptionError";
  }
}

export class NIP46DecryptionError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46DecryptionError";
  }
}

export class NIP46SigningError extends NIP46Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP46SigningError";
  }
}

/**
 * Key pair for client or bunker
 */
export interface NIP46KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Simplified bunker options
 */
export interface SimpleNIP46BunkerOptions {
  timeout?: number;
  logLevel?: number; // Using LogLevel enum
  defaultPermissions?: string[];
  secret?: string;
  debug?: boolean;
}

/**
 * Simplified client options
 */
export interface SimpleNIP46ClientOptions {
  timeout?: number;
  logLevel?: number; // Using LogLevel enum
  debug?: boolean;
}
