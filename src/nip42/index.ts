import { createSignedEvent, validateEvent } from "../nip01/event";
import { EventTemplate, NIP20Prefix, NostrEvent } from "../types/nostr";
import { getPublicKey } from "../utils/crypto";
import { normalizeRelayUrl } from "../utils/relayUrl";

export const AUTH_EVENT_KIND = 22242;

export interface NIP42ValidationOptions {
  challenge?: string;
  relayUrl?: string;
  maxTimestampDrift?: number;
  validateSignatures?: boolean;
}

function getTagValue(tags: string[][], tagName: string): string | undefined {
  return tags.find((tag) => tag[0] === tagName)?.[1];
}

export function createAuthEventTemplate(
  challenge: string,
  relayUrl: string,
  created_at?: number,
): EventTemplate {
  if (!challenge || typeof challenge !== "string") {
    throw new Error("Challenge must be a non-empty string");
  }

  const normalizedRelay = normalizeRelayUrl(relayUrl);

  return {
    kind: AUTH_EVENT_KIND,
    content: "",
    tags: [
      ["relay", normalizedRelay],
      ["challenge", challenge],
    ],
    ...(created_at !== undefined ? { created_at } : {}),
  };
}

export async function createSignedAuthEvent(
  challenge: string,
  relayUrl: string,
  privateKey: string,
  created_at?: number,
): Promise<NostrEvent> {
  const template = createAuthEventTemplate(challenge, relayUrl, created_at);
  return createSignedEvent(
    {
      pubkey: getPublicKey(privateKey),
      kind: template.kind,
      tags: template.tags ?? [],
      content: template.content,
      created_at:
        template.created_at ?? Math.floor(Date.now() / 1000),
    },
    privateKey,
  );
}

export function isAuthEvent(event: NostrEvent): boolean {
  if (event.kind !== AUTH_EVENT_KIND || event.content !== "") {
    return false;
  }

  return Boolean(
    getTagValue(event.tags, "relay") && getTagValue(event.tags, "challenge"),
  );
}

export async function validateAuthEvent(
  event: NostrEvent,
  options: NIP42ValidationOptions = {},
): Promise<boolean> {
  if (!isAuthEvent(event)) {
    throw new Error("Invalid NIP-42 auth event structure");
  }

  await validateEvent(event, {
    maxTimestampDrift: options.maxTimestampDrift ?? 600,
    validateSignatures: options.validateSignatures ?? true,
  });

  const relayTag = getTagValue(event.tags, "relay");
  const challengeTag = getTagValue(event.tags, "challenge");

  if (!relayTag || !challengeTag) {
    throw new Error("Auth event must include relay and challenge tags");
  }

  if (options.relayUrl) {
    const normalizedExpectedRelay = normalizeRelayUrl(options.relayUrl);
    const normalizedRelayTag = normalizeRelayUrl(relayTag);
    if (normalizedRelayTag !== normalizedExpectedRelay) {
      throw new Error("Auth event relay tag does not match expected relay");
    }
  }

  if (
    options.challenge !== undefined &&
    challengeTag !== options.challenge
  ) {
    throw new Error("Auth event challenge tag does not match expected challenge");
  }

  return true;
}

export function parseAuthRequiredReason(reason: string): string | undefined {
  if (!reason.startsWith(NIP20Prefix.AuthRequired)) {
    return undefined;
  }

  return reason.slice(NIP20Prefix.AuthRequired.length).trim();
}
