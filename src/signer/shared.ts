import type { EventTemplate, NostrEvent } from "../types/nostr";
import { getUnixTime } from "../utils/time";
import * as nip07 from "../nip07";
import type {
  RemoteSigner,
  Signer,
  SignerCapabilities,
  SignerEncryption,
} from "./types";

function normalizeEventTemplate(event: EventTemplate): {
  kind: number;
  content: string;
  created_at: number;
  tags: string[][];
} {
  return {
    kind: event.kind,
    content: event.content,
    created_at: event.created_at ?? getUnixTime(),
    tags: event.tags ?? [],
  };
}

export function getSignerCapabilities(signer: Signer): SignerCapabilities {
  return {
    supportsNip04: !!signer.nip04,
    supportsNip44: !!signer.nip44,
  };
}

export class Nip07Signer implements Signer {
  private publicKey?: string;

  constructor() {
    if (!nip07.hasNip07Support()) {
      throw new Error("NIP-07 extension not available");
    }
  }

  get nip04(): SignerEncryption | undefined {
    if (!nip07.hasNip04Support()) {
      return undefined;
    }

    return {
      encrypt: (pubkey, plaintext) => nip07.encryptNip04(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => nip07.decryptNip04(pubkey, ciphertext),
    };
  }

  get nip44(): SignerEncryption | undefined {
    if (!nip07.hasNip44Support()) {
      return undefined;
    }

    return {
      encrypt: (pubkey, plaintext) => nip07.encryptNip44(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => nip07.decryptNip44(pubkey, ciphertext),
    };
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      this.publicKey = await nip07.getPublicKey();
    }

    return this.publicKey;
  }

  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    return nip07.signEvent(normalizeEventTemplate(event));
  }
}

export class Nip46Signer implements Signer {
  constructor(private readonly remoteSigner: RemoteSigner) {}

  get nip04(): SignerEncryption | undefined {
    if (
      !this.remoteSigner.nip04Encrypt ||
      !this.remoteSigner.nip04Decrypt
    ) {
      return undefined;
    }

    return {
      encrypt: (pubkey, plaintext) =>
        this.remoteSigner.nip04Encrypt!(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) =>
        this.remoteSigner.nip04Decrypt!(pubkey, ciphertext),
    };
  }

  get nip44(): SignerEncryption | undefined {
    if (
      !this.remoteSigner.nip44Encrypt ||
      !this.remoteSigner.nip44Decrypt
    ) {
      return undefined;
    }

    return {
      encrypt: (pubkey, plaintext) =>
        this.remoteSigner.nip44Encrypt!(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) =>
        this.remoteSigner.nip44Decrypt!(pubkey, ciphertext),
    };
  }

  async getPublicKey(): Promise<string> {
    return this.remoteSigner.getPublicKey();
  }

  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    return this.remoteSigner.signEvent(normalizeEventTemplate(event));
  }
}
