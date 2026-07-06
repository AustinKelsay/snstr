import {
  EventTemplate,
  Filter,
  NostrEvent,
  ValidationOptions,
} from "../types/nostr";
import { verifySignature } from "../utils/crypto";
import { getUnixTime } from "../utils/time";
import { isValidPublicKeyPoint } from "../nip44";
import { calculateEventHash } from "./serialization";

type ValidationInvalidData =
  | Partial<NostrEvent>
  | Filter
  | Record<string, unknown>
  | EventTemplate;

/**
 * Custom error class for Nostr event validation errors.
 */
export class NostrValidationError extends Error {
  /** The field that failed validation */
  readonly field?: string;
  /** The data that failed validation (can be an event, filter, etc.) */
  readonly invalidData?: ValidationInvalidData;

  constructor(
    message: string,
    field?: string,
    invalidData?: ValidationInvalidData,
  ) {
    super(message);
    this.name = "NostrValidationError";
    this.field = field;
    this.invalidData = invalidData;
  }
}

export interface SignedEventValidationOptions extends ValidationOptions {
  /**
   * Event kinds whose encrypted content should be accepted after shape checks
   * without recomputing id/signature validity at this seam.
   */
  skipIdAndSignatureValidationForKinds?: number[];
  /** Whether kind must be in the NIP-01 0-65535 range. */
  validateKindRange?: boolean;
}

/**
 * Validate if a string is a valid lowercase hex public key format for NIP-01 events.
 */
export function isValidLowercasePublicKeyFormat(publicKey: string): boolean {
  return /^[0-9a-f]{64}$/.test(publicKey);
}

/**
 * Sanitizes unknown input into a Nostr Event shape.
 *
 * This is intentionally synchronous: it validates shape, scalar formats, tag
 * structure, and timestamp shape, but not the event id or signature.
 */
export function sanitizeNostrEvent(
  event: unknown,
  options: SignedEventValidationOptions = {},
): NostrEvent {
  const {
    validateFields = true,
    validateTags = true,
    validateKindRange = false,
  } = options;

  if (!event || typeof event !== "object") {
    throw new NostrValidationError("Invalid event: must be an object", "event");
  }

  const candidate = event as Partial<NostrEvent>;

  if (validateFields) {
    if (
      !candidate.id ||
      typeof candidate.id !== "string" ||
      candidate.id.length !== 64
    ) {
      throw new NostrValidationError(
        "Invalid or missing event ID: must be a 64-character hex string",
        "id",
        candidate,
      );
    }
    if (candidate.id !== candidate.id.toLowerCase()) {
      throw new NostrValidationError(
        "Invalid event ID: must be lowercase hex",
        "id",
        candidate,
      );
    }

    if (!candidate.pubkey || typeof candidate.pubkey !== "string") {
      throw new NostrValidationError(
        "Invalid or missing pubkey: must be a string",
        "pubkey",
        candidate,
      );
    }

    if (!isValidLowercasePublicKeyFormat(candidate.pubkey)) {
      if (/^[0-9A-F]{64}$/.test(candidate.pubkey)) {
        throw new NostrValidationError(
          "Invalid pubkey: must be lowercase hex",
          "pubkey",
          candidate,
        );
      }
      if (candidate.pubkey.length !== 64) {
        throw new NostrValidationError(
          "Invalid pubkey: must be 64 characters long",
          "pubkey",
          candidate,
        );
      }
      throw new NostrValidationError(
        "Invalid pubkey: must be a 64-character lowercase hex string",
        "pubkey",
        candidate,
      );
    }

    if (!isValidPublicKeyPoint(candidate.pubkey)) {
      throw new NostrValidationError(
        "Invalid pubkey: must be a valid secp256k1 curve point",
        "pubkey",
        candidate,
      );
    }

    if (
      !candidate.sig ||
      typeof candidate.sig !== "string" ||
      candidate.sig.length !== 128
    ) {
      throw new NostrValidationError(
        "Invalid or missing signature: must be a 128-character hex string",
        "sig",
        candidate,
      );
    }
    if (candidate.sig !== candidate.sig.toLowerCase()) {
      throw new NostrValidationError(
        "Invalid signature: must be lowercase hex",
        "sig",
        candidate,
      );
    }

    if (typeof candidate.kind !== "number") {
      throw new NostrValidationError(
        "Kind must be a number",
        "kind",
        candidate,
      );
    }

    if (
      validateKindRange &&
      (!Number.isInteger(candidate.kind) ||
        candidate.kind < 0 ||
        candidate.kind > 65535)
    ) {
      throw new NostrValidationError(
        "Kind must be an integer between 0 and 65535",
        "kind",
        candidate,
      );
    }

    if (typeof candidate.created_at !== "number" || candidate.created_at < 0) {
      throw new NostrValidationError(
        "Invalid created_at timestamp",
        "created_at",
        candidate,
      );
    }

    if (typeof candidate.content !== "string") {
      throw new NostrValidationError(
        "Content must be a string",
        "content",
        candidate,
      );
    }
  }

  if (validateTags) {
    if (!Array.isArray(candidate.tags)) {
      throw new NostrValidationError(
        "Tags must be an array",
        "tags",
        candidate,
      );
    }

    for (const tag of candidate.tags) {
      if (!Array.isArray(tag)) {
        throw new NostrValidationError(
          "Each tag must be an array",
          "tags",
          candidate,
        );
      }

      if (tag.length === 0) {
        throw new NostrValidationError(
          "Tags cannot be empty arrays",
          "tags",
          candidate,
        );
      }

      for (const item of tag) {
        if (typeof item !== "string") {
          throw new NostrValidationError(
            "Tag items must be strings",
            "tags",
            candidate,
          );
        }
      }
    }
  }

  return candidate as NostrEvent;
}

/**
 * Validate a signed Nostr Event's shape, timestamp drift, id, and signature.
 */
export async function validateSignedNostrEvent(
  event: unknown,
  options: SignedEventValidationOptions = {},
): Promise<NostrEvent> {
  const {
    validateIds = true,
    validateSignatures = true,
    maxTimestampDrift = 60 * 60,
    skipIdAndSignatureValidationForKinds = [],
  } = options;

  const sanitized = sanitizeNostrEvent(event, options);

  if (maxTimestampDrift > 0) {
    const now = getUnixTime();
    const drift = Math.abs(now - sanitized.created_at);

    if (drift > maxTimestampDrift) {
      throw new NostrValidationError(
        `Event timestamp is too far from current time (drift: ${drift}s, max allowed: ${maxTimestampDrift}s)`,
        "created_at",
        sanitized,
      );
    }
  }

  if (skipIdAndSignatureValidationForKinds.includes(sanitized.kind)) {
    return sanitized;
  }

  if (validateIds) {
    const calculatedId = calculateEventHash(sanitized);

    if (calculatedId !== sanitized.id) {
      throw new NostrValidationError(
        "Event ID does not match content hash",
        "id",
        sanitized,
      );
    }
  }

  if (validateSignatures) {
    const isValid = await verifySignature(
      sanitized.id,
      sanitized.sig,
      sanitized.pubkey,
    );

    if (!isValid) {
      throw new NostrValidationError("Invalid signature", "sig", sanitized);
    }
  }

  return sanitized;
}

/**
 * Boolean convenience wrapper for signed Nostr Event validation.
 */
export async function verifySignedNostrEvent(
  event: unknown,
  options: SignedEventValidationOptions = {},
): Promise<boolean> {
  try {
    await validateSignedNostrEvent(event, options);
    return true;
  } catch {
    return false;
  }
}
