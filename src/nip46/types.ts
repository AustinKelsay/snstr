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
