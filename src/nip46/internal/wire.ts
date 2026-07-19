import { createSignedEvent } from "../../nip01/event";
import { decrypt as decryptNIP44, encrypt as encryptNIP44 } from "../../nip44";
import { NostrEvent } from "../../types/nostr";
import { getUnixTime } from "../../utils/time";
import { NIP46KeyPair, NIP46Request, NIP46Response } from "../types";
import {
  MAX_CONTENT_SIZE,
  MAX_ID_LENGTH,
  MAX_PARAMS_COUNT,
  validatePubkey,
} from "../utils/validator";

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
    const payload = this.decryptPayload(event, recipientPrivateKey);
    if (!this.isRequest(payload)) throw new Error("Invalid NIP-46 request");
    return payload;
  }

  static decryptResponse(
    event: NostrEvent,
    recipientPrivateKey: string,
  ): NIP46Response {
    const payload = this.decryptPayload(event, recipientPrivateKey);
    if (!this.isResponse(payload)) throw new Error("Invalid NIP-46 response");
    return payload;
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

  private static decryptPayload(
    event: NostrEvent,
    recipientPrivateKey: string,
  ): unknown {
    const decrypted = this.decryptContent(
      event.content,
      recipientPrivateKey,
      event.pubkey,
    );
    return JSON.parse(decrypted) as unknown;
  }

  private static isRequest(payload: unknown): payload is NIP46Request {
    if (!this.isRecord(payload)) return false;
    if (!this.isId(payload.id)) return false;
    if (
      typeof payload.method !== "string" ||
      payload.method.length === 0 ||
      payload.method.length > 64
    ) {
      return false;
    }
    if (
      !Array.isArray(payload.params) ||
      payload.params.length > MAX_PARAMS_COUNT ||
      !payload.params.every((param) => typeof param === "string")
    ) {
      return false;
    }
    const pubkey = payload.pubkey;
    return (
      pubkey === undefined ||
      (typeof pubkey === "string" && validatePubkey(pubkey))
    );
  }

  private static isResponse(payload: unknown): payload is NIP46Response {
    if (!this.isRecord(payload) || !this.isId(payload.id)) return false;
    const fields = [payload.result, payload.error, payload.auth_url];
    if (!fields.some((field) => field !== undefined)) return false;
    return fields.every(
      (field) =>
        field === undefined ||
        (typeof field === "string" && field.length <= MAX_CONTENT_SIZE),
    );
  }

  private static isId(value: unknown): value is string {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_ID_LENGTH
    );
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
