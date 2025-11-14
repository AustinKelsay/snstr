/**
 * Optional ambient typing for window.nostr (NIP-07) used by browser examples and consumers
 * who want typed access. Import this module once for its side-effect to augment the global Window.
 *
 * Example:
 *   import 'snstr/nip07-ambient'; // or '../../src/nip07/ambient' when working in this repo
 */

export {};

declare global {
  interface Window {
    /**
     * NIP-07 browser extension API. This is a structural type to avoid hard ties
     * to library-internal types and reduce cross-package augmentation conflicts.
     */
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: {
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
        pubkey?: string;
        id?: string;
        sig?: string;
        [k: string]: unknown;
      }): Promise<{
        id: string;
        pubkey: string;
        sig: string;
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
      }>;
      getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
      nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

