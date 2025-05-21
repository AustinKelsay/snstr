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
import { getPublicKey, verifySignature } from "../utils/crypto";
import { encrypt as encryptNIP04 } from "../nip04";
import { sha256Hex } from "../utils/crypto";
import { signEvent as signEventCrypto } from "../utils/crypto";
import { isValidRelayUrl } from "../nip19";

export type UnsignedEvent = Omit<NostrEvent, "id" | "sig">;

/**
 * Custom error class for Nostr event validation errors
 */
export class NostrValidationError extends Error {
  /** The field that failed validation */
  readonly field?: string;
  /** The event that failed validation */
  readonly event?: Partial<NostrEvent>;

  constructor(message: string, field?: string, event?: Partial<NostrEvent>) {
    super(message);
    this.name = "NostrValidationError";
    this.field = field;
    this.event = event;
  }
}

/**
 * Calculate the event hash following NIP-01 specification exactly
 * for deterministic serialization across different implementations
 * @throws {NostrValidationError} If the event is missing required fields or has invalid data
 */
export async function getEventHash(
  event: UnsignedEvent | NostrEvent,
): Promise<string> {
  // Validate event structure first - these fields are required by the Nostr protocol
  if (!event.pubkey)
    throw new NostrValidationError(
      "Invalid event: missing pubkey",
      "pubkey",
      event,
    );
  if (event.created_at === undefined || event.created_at === null)
    throw new NostrValidationError(
      "Invalid event: missing created_at",
      "created_at",
      event,
    );
  if (event.kind === undefined)
    throw new NostrValidationError(
      "Invalid event: missing kind",
      "kind",
      event,
    );
  if (!Array.isArray(event.tags))
    throw new NostrValidationError(
      "Invalid event: tags must be an array",
      "tags",
      event,
    );

  // Ensure the tags are valid arrays of strings
  for (const tag of event.tags) {
    if (!Array.isArray(tag))
      throw new NostrValidationError(
        "Invalid event: each tag must be an array",
        "tags",
        event,
      );
    for (const item of tag) {
      if (typeof item !== "string")
        throw new NostrValidationError(
          "Invalid event: tag items must be strings",
          "tags",
          event,
        );
    }
  }

  // Check that content is a string
  if (typeof event.content !== "string")
    throw new NostrValidationError(
      "Invalid event: content must be a string",
      "content",
      event,
    );

  // NIP-01 specifies the serialization format as:
  // [0, pubkey, created_at, kind, tags, content]
  // We need to ensure deterministic serialization

  // Create the array to be serialized
  const eventData = [
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ];

  // Per NIP-01: whitespace, line breaks or other unnecessary formatting
  // should not be included in the output JSON
  // JavaScript's JSON.stringify doesn't add whitespace by default
  // so we don't need to pass additional options

  // Serialize to JSON without pretty formatting
  // JSON.stringify on arrays is deterministic in all JS engines
  // because array order is preserved
  const serialized = JSON.stringify(eventData);

  // Hash the serialized data
  return sha256Hex(serialized);
}

/**
 * Create an unsigned event from a template
 */
export function createEvent(
  template: EventTemplate,
  pubkey: string,
): UnsignedEvent {
  if (!pubkey || typeof pubkey !== "string") {
    throw new NostrValidationError("Invalid pubkey", "pubkey");
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
    created_at: template.created_at || Math.floor(Date.now() / 1000),
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
  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    privateKey.length !== 64 ||
    !/^[0-9a-fA-F]+$/.test(privateKey)
  ) {
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

  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    privateKey.length !== 64 ||
    !/^[0-9a-fA-F]+$/.test(privateKey)
  ) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  const pubkey = getPublicKey(privateKey);

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: NostrKind.ShortNote,
    tags,
    content,
  };
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

  if (!recipientPubkey || typeof recipientPubkey !== "string") {
    throw new NostrValidationError(
      "Invalid recipient public key",
      "recipientPubkey",
    );
  }

  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    privateKey.length !== 64 ||
    !/^[0-9a-fA-F]+$/.test(privateKey)
  ) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  const pubkey = getPublicKey(privateKey);

  try {
    // Encrypt the content using NIP-04
    const encryptedContent = await encryptNIP04(
      content,
      privateKey,
      recipientPubkey,
    );

    return {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: NostrKind.DirectMessage,
      tags: [["p", recipientPubkey], ...tags],
      content: encryptedContent,
    };
  } catch (error) {
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

  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    privateKey.length !== 64 ||
    !/^[0-9a-fA-F]+$/.test(privateKey)
  ) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  // Get the public key from the private key to ensure the pubkey is non-empty
  const pubkey = getPublicKey(privateKey);

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
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
  if (kind < 30000 || kind >= 40000) {
    throw new NostrValidationError(
      "Addressable events must have kind between 30000-39999",
      "kind",
      { kind },
    );
  }

  if (typeof dTagValue !== "string") {
    throw new NostrValidationError("D-tag value must be a string", "dTagValue");
  }

  if (!content || typeof content !== "string") {
    throw new NostrValidationError(
      "Content must be a non-empty string",
      "content",
    );
  }

  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    privateKey.length !== 64 ||
    !/^[0-9a-fA-F]+$/.test(privateKey)
  ) {
    throw new NostrValidationError("Invalid private key", "privateKey");
  }

  const pubkey = getPublicKey(privateKey);

  // Ensure the d tag is included and is the first tag
  const dTag = ["d", dTagValue];
  const tags = [dTag, ...additionalTags];

  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
  };
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
  const {
    validateSignatures = true,
    maxTimestampDrift = 60 * 60, // 1 hour by default
    validateIds = true,
    validateFields = true,
    validateTags = true,
    validateContent = true,
    customValidator,
  } = options;

  // 1. Validate basic required fields
  if (validateFields) {
    // Check ID exists
    if (!event.id || typeof event.id !== "string" || event.id.length !== 64) {
      throw new NostrValidationError(
        "Invalid or missing event ID: must be a 64-character hex string",
        "id",
        event,
      );
    }
    if (event.id !== event.id.toLowerCase()) {
      throw new NostrValidationError(
        "Invalid event ID: must be lowercase hex",
        "id",
        event,
      );
    }

    // Check pubkey exists and is valid hex
    if (
      !event.pubkey ||
      typeof event.pubkey !== "string" ||
      event.pubkey.length !== 64
    ) {
      throw new NostrValidationError(
        "Invalid or missing pubkey: must be a 64-character hex string",
        "pubkey",
        event,
      );
    }
    if (event.pubkey !== event.pubkey.toLowerCase()) {
      throw new NostrValidationError(
        "Invalid pubkey: must be lowercase hex",
        "pubkey",
        event,
      );
    }

    // Check signature exists
    if (
      !event.sig ||
      typeof event.sig !== "string" ||
      event.sig.length !== 128
    ) {
      throw new NostrValidationError(
        "Invalid or missing signature: must be a 128-character hex string",
        "sig",
        event,
      );
    }
    if (event.sig !== event.sig.toLowerCase()) {
      throw new NostrValidationError(
        "Invalid signature: must be lowercase hex",
        "sig",
        event,
      );
    }

    // Check kind is a number
    if (typeof event.kind !== "number") {
      throw new NostrValidationError("Kind must be a number", "kind", event);
    }

    // Check created_at is a valid timestamp
    if (typeof event.created_at !== "number" || event.created_at < 0) {
      throw new NostrValidationError(
        "Invalid created_at timestamp",
        "created_at",
        event,
      );
    }

    // Check content is a string
    if (typeof event.content !== "string") {
      throw new NostrValidationError(
        "Content must be a string",
        "content",
        event,
      );
    }
  }

  // 2. Validate tags format
  if (validateTags) {
    if (!Array.isArray(event.tags)) {
      throw new NostrValidationError("Tags must be an array", "tags", event);
    }

    for (const tag of event.tags) {
      if (!Array.isArray(tag)) {
        throw new NostrValidationError(
          "Each tag must be an array",
          "tags",
          event,
        );
      }

      if (tag.length === 0) {
        throw new NostrValidationError(
          "Tags cannot be empty arrays",
          "tags",
          event,
        );
      }

      for (const item of tag) {
        if (typeof item !== "string") {
          throw new NostrValidationError(
            "Tag items must be strings",
            "tags",
            event,
          );
        }
      }
    }
  }

  // 3. Validate timestamp drift if enabled
  if (maxTimestampDrift > 0) {
    const now = Math.floor(Date.now() / 1000);
    const drift = Math.abs(now - event.created_at);

    if (drift > maxTimestampDrift) {
      throw new NostrValidationError(
        `Event timestamp is too far from current time (drift: ${drift}s, max allowed: ${maxTimestampDrift}s)`,
        "created_at",
        event,
      );
    }
  }

  // 4. Validate event ID matches serialized content
  if (validateIds) {
    const unsignedEvent: UnsignedEvent = {
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
    };

    const calculatedId = await getEventHash(unsignedEvent);

    if (calculatedId !== event.id) {
      throw new NostrValidationError(
        "Event ID does not match content hash",
        "id",
        event,
      );
    }
  }

  // 5. Validate signature
  if (validateSignatures) {
    const isValid = await verifySignature(event.id, event.sig, event.pubkey);

    if (!isValid) {
      throw new NostrValidationError("Invalid signature", "sig", event);
    }
  }

  // 6. Validate content format based on kind
  if (validateContent) {
    const hex64Regex = /^[0-9a-fA-F]{64}$/; // Define reusable regex for 64-char hex strings

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

        // const pubkeyRegexNIP02 = /^[0-9a-fA-F]{64}$/; // This will be replaced by hex64Regex
        // Basic regex for ws:// or wss:// URLs. NIP-02 doesn't specify strict URL validation beyond the scheme.
        // const relayUrlRegexNIP02 = /^(wss?:\/\/).+/i; // Removed local regex

        for (const tag of event.tags) {
          if (tag[0] === "p") {
            // 1. Validate pubkey (tag[1])
            if (tag.length < 2 || typeof tag[1] !== 'string' || !hex64Regex.test(tag[1])) { // Use hex64Regex
              throw new NostrValidationError(
                `Invalid NIP-02 'p' tag: Pubkey at tag[1] is missing, not a string, or not a 64-character hex. Received: '${tag[1]}'.`,
                "tags",
                event
              );
            }

            // 2. Validate relay URL (tag[2])
            if (tag.length > 2) {
              const relayUrl = tag[2];
              // General tag validation should ensure tag[2] is a string if validateTags=true.
              // This check provides robustness.
              if (typeof relayUrl !== 'string') {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Relay URL at tag[2] must be a string if present.",
                  "tags",
                  event
                );
              }
              // If relayUrl is not an empty string, it must be a valid ws/wss URL.
              if (relayUrl.length > 0 && !isValidRelayUrl(relayUrl)) {
                throw new NostrValidationError(
                  `Invalid NIP-02 'p' tag: Relay URL "${relayUrl}" at tag[2] is not a valid ws:// or wss:// URL, or an empty string.`,
                  "tags",
                  event
                );
              }
            }

            // 3. Validate structure if petname (tag[3]) is present
            if (tag.length > 3) {
              const petname = tag[3];
              // General tag validation should ensure tag[3] is a string if validateTags=true.
              if (typeof petname !== 'string') {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Petname at tag[3] must be a string if present.",
                  "tags",
                  event
                );
              }
              // According to NIP-02: "If relay URL is not present but petname is, the relay URL MUST be an empty string."
              // This means tag[2] must exist if tag[3] exists.
              if (typeof tag[2] !== 'string') {
                throw new NostrValidationError(
                  "Invalid NIP-02 'p' tag: Relay URL at tag[2] must be present (and a string, can be empty) if petname at tag[3] is specified.",
                  "tags",
                  event
                );
              }
            }

            // 4. Validate maximum length of a 'p' tag
            if (tag.length > 4) {
              throw new NostrValidationError(
                "Invalid NIP-02 'p' tag: Exceeds maximum of 4 elements (p, pubkey, relay, petname).",
                "tags",
                event
              );
            }
          }
        }
        break;
      }

      case NostrKind.DirectMessage: {
        // Direct messages must have exactly one p tag
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        if (pTags.length !== 1) {
          throw new NostrValidationError(
            "Direct message event must have exactly one p tag",
            "tags",
            event,
          );
        }

        // Validate the pubkey in the 'p' tag
        const pTag = pTags[0];
        if (pTag.length < 2 || typeof pTag[1] !== 'string' || !hex64Regex.test(pTag[1])) {
          throw new NostrValidationError(
            `Invalid 'p' tag in Direct Message: Pubkey at tag[1] (pTag[1]) must be a 64-character hex string. Received: '${pTag[1]}'.`,
            "tags",
            event
          );
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
  const tag = event.tags.find((tag) => tag[0] === tagName);
  return tag && tag.length > index + 1 ? tag[index + 1] : undefined;
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
