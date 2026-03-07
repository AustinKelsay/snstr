import type { EventTemplate, NostrEvent } from "../types/nostr";

export interface SignerEncryption {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
  nip04?: SignerEncryption;
  nip44?: SignerEncryption;
}

export interface SignerCapabilities {
  supportsNip04: boolean;
  supportsNip44: boolean;
}

export interface RemoteSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: {
    kind: number;
    content: string;
    created_at: number;
    tags?: string[][];
    pubkey?: string;
  }): Promise<NostrEvent>;
  nip04Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip04Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  nip44Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
}
