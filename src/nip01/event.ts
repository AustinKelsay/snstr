import {
  EventTemplate,
  NostrEvent,
  ProfileMetadata,
  NostrKind,
  ValidationOptions,
  TaggedEvent,
  TagValues,
  EventTags,
} from "../types/nostr";
import { getPublicKey, signEvent as signEventCrypto } from "../utils/crypto";
import { getUnixTime } from "../utils/time";
import { isValidRelayUrl } from "../nip19";
import { isValidPrivateKey, isValidPublicKeyPoint } from "../nip44";
import { getRegisteredNIP04 } from "../nip04/registry";
import { calculateEventHash } from "./serialization";
import {
  isValidLowercasePublicKeyFormat,
  NostrValidationError,
  sanitizeUnsignedNostrEvent,
  type UnsignedNostrEvent,
  validateSignedNostrEvent,
} from "./validation";
import {
  validateEventContent,
  validateTags,
  SECURITY_LIMITS,
  SecurityValidationError,
  validateArrayAccess,
  safeArrayAccess,
} from "../utils/security-validator";

export { NostrValidationError } from "./validation";

export type UnsignedEvent = UnsignedNostrEvent;

/**
 * Calculate the event hash following NIP-01 specification exactly
 * for deterministic serialization across different implementations
 * @throws {NostrValidationError} If the event is missing required fields or has invalid data
 */
export async function getEventHash(
  event: UnsignedEvent | NostrEvent,
): Promise<string> {
  const sanitized = sanitizeUnsignedNostrEvent(event);
  return calculateEventHash(sanitized);
}

/**
 * Create an unsigned event from a template
 */
export function createEvent(
  template: EventTemplate,
  pubkey: string,
): UnsignedEvent {
  // First validate the format (64-character lowercase hex)
  if (!isValidLowercasePublicKeyFormat(pubkey)) {
    throw new NostrValidationError(
      "Invalid pubkey format: must be a 64-character lowercase hex string",
      "pubkey",
    );
  }

  // Then validate that it represents a valid point on the secp256k1 curve
  if (!isValidPublicKeyPoint(pubkey)) {
    throw new NostrValidationError(
      "Invalid pubkey: not a valid point on the secp256k1 curve",
      "pubkey",
    );
  }

  if (template.kind === undefined) {
    throw new NostrValidationError(
      "Event template must include a kind",
      "kind",
      template,
    );
  }

  return {
    pubkey,
    created_at: template.created_at || getUnixTime(),
    kind: template.kind,
    tags: template.tags || [],
    content: template.content,
  };
}

/**
 * Create and sign an event
 * @throws {NostrValidationError} If the event validation fails
 */
export async function createSignedEvent(
  event: UnsignedEvent,
  privateKey: string,
): Promise<NostrEvent> {
  if (!isValidPrivateKey(privateKey)) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  try {
    const id = await getEventHash(event);
    const sig = await signEventCrypto(id, privateKey);

    return {
      ...event,
      id,
      sig,
    };
  } catch (error) {
    if (error instanceof NostrValidationError) {
      throw error;
    }
    throw new NostrValidationError(
      `Failed to create signed event: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      event,
    );
  }
}

/**
 * Create a text note event (kind 1)
 *
 * @param content The content of the text note
 * @param privateKey The private key to derive the pubkey from
 * @param tags Optional tags for the event
 * @returns An unsigned event with pubkey automatically set
 * @throws {NostrValidationError} If validation fails
 */
export function createTextNote(
  content: string,
  privateKey: string,
  tags: string[][] = [],
): UnsignedEvent {
  if (!content || typeof content !== "string") {
    throw new NostrValidationError(
      "Content must be a non-empty string",
      "content",
    );
  }

  // Apply security validation
  try {
    const validatedContent = validateEventContent(content);
    const validatedTags = validateTags(tags);

    // Calculate actual UTF-8 byte length for proper size validation
    const contentByteLength = new TextEncoder().encode(validatedContent).length;
    if (contentByteLength > SECURITY_LIMITS.MAX_CONTENT_SIZE) {
      throw new SecurityValidationError(
        `Content too large: ${contentByteLength} bytes (max ${SECURITY_LIMITS.MAX_CONTENT_SIZE})`,
        "CONTENT_TOO_LARGE",
        "content",
      );
    }

    if (!isValidPrivateKey(privateKey)) {
      throw new NostrValidationError("Invalid private key", "privateKey");
    }

    const pubkey = getPublicKey(privateKey);

    return {
      pubkey,
      created_at: getUnixTime(),
      kind: NostrKind.ShortNote,
      tags: validatedTags,
      content: validatedContent,
    };
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw new NostrValidationError(error.message, error.field);
    }
    throw error;
  }
}

/**
 * Create a direct message event (kind 4)
 * Encrypts the content using NIP-04 specification
 *
 * @param content The plaintext content to encrypt
 * @param recipientPubkey The public key of the recipient
 * @param privateKey The private key of the sender
 * @param tags Optional additional tags
 * @returns An unsigned event with pubkey automatically set and content encrypted
 * @throws {NostrValidationError} If validation fails
 */
export async function createDirectMessage(
  content: string,
  recipientPubkey: string,
  privateKey: string,
  tags: string[][] = [],
): Promise<UnsignedEvent> {
  if (!content || typeof content !== "string") {
    throw new NostrValidationError(
      "Content must be a non-empty string",
      "content",
    );
  }

  // Validate recipient public key first (outside try-catch to preserve error field)
  if (!isValidPublicKeyPoint(recipientPubkey)) {
    throw new NostrValidationError(
      "Invalid recipient public key: must be a valid secp256k1 curve point",
      "recipientPubkey",
    );
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  // Apply security validation
  try {
    const validatedContent = validateEventContent(content);
    const validatedTags = validateTags(tags);

    // Calculate actual UTF-8 byte length for proper size validation
    const contentByteLength = new TextEncoder().encode(validatedContent).length;
    if (contentByteLength > SECURITY_LIMITS.MAX_CONTENT_SIZE) {
      throw new SecurityValidationError(
        `Content too large: ${contentByteLength} bytes (max ${SECURITY_LIMITS.MAX_CONTENT_SIZE})`,
        "CONTENT_TOO_LARGE",
        "content",
      );
    }

    const pubkey = getPublicKey(privateKey);

    // Encrypt the content using NIP-04
    // Registry pattern: implementation registered at import time by snstr or snstr/nip04
    const { encrypt } = getRegisteredNIP04();
    const encryptedContent = encrypt(
      privateKey,
      recipientPubkey,
      validatedContent,
    );

    return {
      pubkey,
      created_at: getUnixTime(),
      kind: NostrKind.DirectMessage,
      tags: [["p", recipientPubkey], ...validatedTags],
      content: encryptedContent,
    };
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw new NostrValidationError(error.message, error.field);
    }
    if (error instanceof NostrValidationError) {
      throw error;
    }
    throw new NostrValidationError(
      `Failed to encrypt message: ${error instanceof Error ? error.message : String(error)}`,
      "encryption",
    );
  }
}

/**
 * Create a metadata event (kind 0)
 * @param metadata Object containing user profile metadata
 * @param privateKey The private key to derive the pubkey from
 * @returns An unsigned event with pubkey automatically set
 * @throws {NostrValidationError} If validation fails
 */
export function createMetadataEvent(
  metadata: ProfileMetadata,
  privateKey: string,
): UnsignedEvent {
  if (!metadata || typeof metadata !== "object") {
    throw new NostrValidationError(
      "Metadata must be a valid object",
      "metadata",
    );
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  // Get the public key from the private key to ensure the pubkey is non-empty
  const pubkey = getPublicKey(privateKey);

  return {
    pubkey,
    created_at: getUnixTime(),
    kind: NostrKind.Metadata,
    tags: [],
    content: JSON.stringify(metadata),
  };
}

/**
 * Create an addressable event (kinds 30000-39999)
 * These are events that can be replaced based on kind, pubkey, and d-tag value
 *
 * @param kind The kind of the event (must be between 30000-39999)
 * @param dTagValue The value for the d tag that identifies this addressable event
 * @param content The content of the event
 * @param privateKey The private key to derive the pubkey from
 * @param additionalTags Optional additional tags for the event
 * @returns An unsigned event with pubkey automatically set
 * @throws {NostrValidationError} If the kind is not in the addressable range or other validation fails
 */
export function createAddressableEvent(
  kind: number,
  dTagValue: string,
  content: string,
  privateKey: string,
  additionalTags: string[][] = [],
): UnsignedEvent {
  // Apply security validation with numeric bounds checking
  if (kind < 30000 || kind >= 40000 || !Number.isInteger(kind)) {
    throw new NostrValidationError(
      "Addressable events must have kind between 30000-39999",
      "kind",
      { kind },
    );
  }

  if (typeof dTagValue !== "string") {
    throw new NostrValidationError("D-tag value must be a string", "dTagValue");
  }

  // Validate d-tag length for security
  if (dTagValue.length > SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE) {
    throw new NostrValidationError(
      `D-tag value too long: ${dTagValue.length} chars (max ${SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE})`,
      "dTagValue",
    );
  }

  // Allow empty content for NIP-51 list events which store data in tags
  if (typeof content !== "string") {
    throw new NostrValidationError("Content must be a string", "content");
  }

  try {
    const validatedContent = validateEventContent(content);
    const validatedTags = validateTags(additionalTags);

    // Calculate actual UTF-8 byte length for proper size validation
    const contentByteLength = new TextEncoder().encode(validatedContent).length;
    if (contentByteLength > SECURITY_LIMITS.MAX_CONTENT_SIZE) {
      throw new SecurityValidationError(
        `Content too large: ${contentByteLength} bytes (max ${SECURITY_LIMITS.MAX_CONTENT_SIZE})`,
        "CONTENT_TOO_LARGE",
        "content",
      );
    }

    if (!isValidPrivateKey(privateKey)) {
      throw new NostrValidationError("Invalid private key", "privateKey");
    }

    const pubkey = getPublicKey(privateKey);

    // Ensure the d tag is included and is the first tag
    const dTag = ["d", dTagValue];
    const tags = [dTag, ...validatedTags];

    return {
      pubkey,
      created_at: getUnixTime(),
      kind,
      tags,
      content: validatedContent,
    };
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw new NostrValidationError(error.message, error.field);
    }
    throw error;
  }
}

/**
 * Validate a Nostr event according to NIP-01 and optional custom rules
 *
 * @param event The event to validate
 * @param options Validation options
 * @returns True if the event is valid
 * @throws {NostrValidationError} If validation fails
 */
export async function validateEvent(
  event: NostrEvent,
  options: ValidationOptions = {},
): Promise<boolean> {
  const { validateContent = true, customValidator } = options;

  await validateSignedNostrEvent(event, options);

  // Validate content format based on kind
  if (validateContent) {
    switch (event.kind) {
      case NostrKind.Metadata:
        try {
          const metadata = JSON.parse(event.content);
          if (typeof metadata !== "object" || metadata === null) {
            throw new NostrValidationError(
              "Metadata event content must be a valid JSON object",
              "content",
              event,
            );
          }
        } catch (error) {
          throw new NostrValidationError(
            "Metadata event has invalid JSON content",
            "content",
            event,
          );
        }
        break;

      case NostrKind.Contacts: {
        // NIP-02: Validate 'p' tags for Kind 3 (Contacts) events.
        // Tags should conform to: ["p", <pubkey_hex>, <recommended_relay_url_or_empty_string>, <petname_or_empty_string>]
        // General tag validation (if enabled) ensures all tag items are strings.

        for (const tag of event.tags) {
          if (tag[0] === "p") {
            // 1. Validate pubkey (tag[1])
            if (
              tag.length < 2 ||
              typeof tag[1] !== "string" ||
              !isValidPublicKeyPoint(tag[1])
            ) {
              throw new NostrValidationError(
                `Invalid NIP-02 'p' tag: Pubkey at tag[1] is missing, not a string, or not a valid secp256k1 curve point. Received: '${tag[1]}'.`,
                "tags",
                event,
              );
            }

            // 2. Validate relay URL (tag[2])
            if (tag.length > 2) {
              const relayUrl = tag[2];
              // General tag validation should ensure tag[2] is a string if validateTags=true.
              // This check provides robustness.
              if (typeof relayUrl !== "string") {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Relay URL at tag[2] must be a string if present.",
                  "tags",
                  event,
                );
              }
              // If relayUrl is not an empty string, it must be a valid ws/wss URL.
              if (relayUrl.length > 0 && !isValidRelayUrl(relayUrl)) {
                throw new NostrValidationError(
                  `Invalid NIP-02 'p' tag: Relay URL "${relayUrl}" at tag[2] is not a valid ws:// or wss:// URL, or an empty string.`,
                  "tags",
                  event,
                );
              }
            }

            // 3. Validate structure if petname (tag[3]) is present
            if (tag.length > 3) {
              const petname = tag[3];
              // General tag validation should ensure tag[3] is a string if validateTags=true.
              if (typeof petname !== "string") {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Petname at tag[3] must be a string if present.",
                  "tags",
                  event,
                );
              }
              // According to NIP-02: "If relay URL is not present but petname is, the relay URL MUST be an empty string."
              // This means tag[2] must exist if tag[3] exists.
              if (typeof tag[2] !== "string") {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Relay URL at tag[2] must be present (and a string, can be empty) if petname at tag[3] is specified.",
                  "tags",
                  event,
                );
              }
            }

            // 4. Validate maximum length of a 'p' tag
            if (tag.length > 4) {
              throw new NostrValidationError(
                "Invalid NIP-02 'p' tag: Exceeds maximum of 4 elements (p, pubkey, relay, petname).",
                "tags",
                event,
              );
            }
          }
        }
        break;
      }

      case NostrKind.DirectMessage: {
        // Direct messages must have exactly one p tag
        const pTags = event.tags.filter((tag) => {
          try {
            return (
              validateArrayAccess(tag, 0) && safeArrayAccess(tag, 0) === "p"
            );
          } catch {
            return false;
          }
        });

        if (pTags.length !== 1) {
          throw new NostrValidationError(
            "Direct message event must have exactly one p tag",
            "tags",
            event,
          );
        }

        // Validate the pubkey in the 'p' tag with safe access
        try {
          if (!validateArrayAccess(pTags, 0)) {
            throw new NostrValidationError(
              "Direct message p-tag validation error: No valid p tags found",
              "tags",
              event,
            );
          }

          const pTag = safeArrayAccess(pTags, 0);
          if (!Array.isArray(pTag) || !validateArrayAccess(pTag, 1)) {
            throw new NostrValidationError(
              "Direct message p-tag validation error: Invalid p tag structure",
              "tags",
              event,
            );
          }

          const pubkeyValue = safeArrayAccess(pTag, 1);
          if (
            typeof pubkeyValue !== "string" ||
            !isValidPublicKeyPoint(pubkeyValue)
          ) {
            throw new NostrValidationError(
              `Invalid 'p' tag in Direct Message: Pubkey at tag[1] (pTag[1]) must be a valid secp256k1 curve point. Received: '${pubkeyValue}'.`,
              "tags",
              event,
            );
          }
        } catch (error) {
          if (error instanceof SecurityValidationError) {
            throw new NostrValidationError(
              `Direct message validation bounds checking error: ${error.message}`,
              "tags",
              event,
            );
          }
          throw error; // Re-throw NostrValidationError
        }
        break;
      }

      // Add validation for other kinds as needed
    }
  }

  // 7. Run custom validator if provided
  if (customValidator) {
    const customValid = await Promise.resolve(customValidator(event));
    if (!customValid) {
      throw new NostrValidationError(
        "Event failed custom validation",
        undefined,
        event,
      );
    }
  }

  return true;
}

/**
 * Extract all tags of a specific type from an event
 *
 * @param event The Nostr event to extract tags from
 * @param tagName The tag name to extract (e.g., 'e', 'p', etc.)
 * @returns Array of tag values (without the tag name)
 */
export function getTagValues<T extends keyof TagValues>(
  event: NostrEvent,
  tagName: T,
): string[] {
  return event.tags
    .filter((tag) => tag[0] === tagName)
    .flatMap((tag) => tag.slice(1));
}

/**
 * Get a specific tag value from an event (first occurrence)
 *
 * @param event The Nostr event to extract tag from
 * @param tagName The tag name to extract (e.g., 'e', 'p', etc.)
 * @param index The index of the tag value (default: 0, which is the first element after the tag name)
 * @returns The tag value or undefined if not found
 */
export function getTagValue<T extends keyof TagValues>(
  event: NostrEvent,
  tagName: T,
  index: number = 0,
): string | undefined {
  // Validate index is not negative
  if (index < 0) {
    throw new SecurityValidationError(
      `Tag index must be non-negative: ${index}`,
      "INVALID_TAG_INDEX",
      "index",
    );
  }

  const tag = event.tags.find((tag) => tag[0] === tagName);
  if (!tag || !Array.isArray(tag)) {
    return undefined;
  }

  // Safe bounds checking against actual tag length
  const targetIndex = index + 1; // +1 because tag[0] is the tag name
  if (targetIndex >= tag.length) {
    return undefined;
  }

  return tag[targetIndex];
}

/**
 * Extract all tags from an event, organized by tag name
 *
 * @param event The Nostr event to extract tags from
 * @returns Object with tag names as keys and arrays of values as values
 */
export function extractTags(event: NostrEvent): EventTags {
  const result: Partial<EventTags> = {};

  for (const tag of event.tags) {
    if (tag.length < 1) continue;

    const tagName = tag[0];
    const tagValues = tag.slice(1);

    if (!result[tagName]) {
      result[tagName] = [];
    }

    result[tagName]!.push(...tagValues);
  }

  return result as EventTags;
}

/**
 * Create a tagged event with helper methods for tag extraction
 *
 * @param event The Nostr event to wrap
 * @returns Enhanced event with tag extraction methods
 */
export function createTaggedEvent<T extends string>(
  event: NostrEvent,
): TaggedEvent<T> {
  return {
    ...event,
    tagValues: (name: T) =>
      event.tags
        .filter((tag) => tag[0] === name)
        .flatMap((tag) => tag.slice(1)),
    getTag: (name: T, index = 0) => {
      const tag = event.tags.find((tag) => tag[0] === name);
      return tag && tag.length > index + 1 ? tag[index + 1] : undefined;
    },
  };
}
