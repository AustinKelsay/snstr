import { createSignedEvent } from "../../nip01/event";
import { decrypt as decryptNIP44, encrypt as encryptNIP44 } from "../../nip44";
import { NostrEvent } from "../../types/nostr";
import { getUnixTime } from "../../utils/time";
import { NIP46KeyPair, NIP46Request, NIP46Response } from "../types";

export const NIP46_EVENT_KIND = 24133;

/** Canonical NIP-44 event codec shared by every NIP-46 facade. */
export class NIP46Wire {
  static async createRequestEvent(
    request: NIP46Request,
    sender: NIP46KeyPair,
    recipientPubkey: string,
  ): Promise<NostrEvent> {
    return this.createEvent(request, sender, recipientPubkey);
  }

  static async createResponseEvent(
    response: NIP46Response,
    sender: NIP46KeyPair,
    recipientPubkey: string,
  ): Promise<NostrEvent> {
    return this.createEvent(response, sender, recipientPubkey);
  }

  static decryptRequest(
    event: NostrEvent,
    recipientPrivateKey: string,
  ): NIP46Request {
    return this.decryptPayload<NIP46Request>(event, recipientPrivateKey);
  }

  static decryptResponse(
    event: NostrEvent,
    recipientPrivateKey: string,
  ): NIP46Response {
    return this.decryptPayload<NIP46Response>(event, recipientPrivateKey);
  }

  static decryptContent(
    content: string,
    recipientPrivateKey: string,
    authorPubkey: string,
  ): string {
    return decryptNIP44(content, recipientPrivateKey, authorPubkey);
  }

  private static async createEvent(
    payload: NIP46Request | NIP46Response,
    sender: NIP46KeyPair,
    recipientPubkey: string,
  ): Promise<NostrEvent> {
    const content = await encryptNIP44(
      JSON.stringify(payload),
      sender.privateKey,
      recipientPubkey,
    );

    return createSignedEvent(
      {
        kind: NIP46_EVENT_KIND,
        content,
        created_at: getUnixTime(),
        tags: [["p", recipientPubkey]],
        pubkey: sender.publicKey,
      },
      sender.privateKey,
    );
  }

  private static decryptPayload<T>(
    event: NostrEvent,
    recipientPrivateKey: string,
  ): T {
    const decrypted = this.decryptContent(
      event.content,
      recipientPrivateKey,
      event.pubkey,
    );
    return JSON.parse(decrypted) as T;
  }
}
