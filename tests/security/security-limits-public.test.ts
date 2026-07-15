import { Nostr } from "../../src/nip01/nostr";
import {
  createAddressableEvent,
  createSignedEvent,
  createTextNote,
  validateEvent,
} from "../../src/nip01/event";
import { parseThreadReferences } from "../../src/nip10";
import { LocalKeySigner } from "../../src/signer";
import type { Filter, NostrEvent } from "../../src/types/nostr";
import { getPublicKey } from "../../src/utils/crypto";
import { SECURITY_LIMITS } from "../../src/utils/security-validator";

describe("security limits through public behavior", () => {
  const privateKey =
    "1111111111111111111111111111111111111111111111111111111111111111";
  const publicKey = getPublicKey(privateKey);

  describe("public Event creation", () => {
    it("accepts content and tag values exactly at their limits", () => {
      const tags = Array.from(
        { length: SECURITY_LIMITS.MAX_TAG_COUNT },
        (_, index) => [
          "t",
          index === 0
            ? "x".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE)
            : String(index),
        ],
      );

      const event = createTextNote(
        "x".repeat(SECURITY_LIMITS.MAX_CONTENT_SIZE),
        privateKey,
        tags,
      );

      expect(event.content).toHaveLength(SECURITY_LIMITS.MAX_CONTENT_SIZE);
      expect(event.tags).toHaveLength(SECURITY_LIMITS.MAX_TAG_COUNT);
      expect(event.tags[0][1]).toHaveLength(
        SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE,
      );
    });

    it.each([
      {
        name: "oversized content",
        content: "x".repeat(SECURITY_LIMITS.MAX_CONTENT_SIZE + 1),
        tags: [],
        message: "String exceeds maximum length",
      },
      {
        name: "a non-array tag collection",
        content: "content",
        tags: "not-tags",
        message: "Tags must be an array",
      },
      {
        name: "too many tags",
        content: "content",
        tags: Array.from({ length: SECURITY_LIMITS.MAX_TAG_COUNT + 1 }, () => [
          "t",
        ]),
        message: "Too many tags",
      },
      {
        name: "a non-array tag",
        content: "content",
        tags: ["not-a-tag"],
        message: "Tag at index 0 must be an array",
      },
      {
        name: "too many elements in one tag",
        content: "content",
        tags: [
          Array.from({ length: SECURITY_LIMITS.MAX_TAG_SIZE + 1 }, () => "x"),
        ],
        message: "has too many elements",
      },
      {
        name: "an oversized tag element",
        content: "content",
        tags: [["t", "x".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE + 1)]],
        message: "String exceeds maximum length",
      },
      {
        name: "a non-string tag element",
        content: "content",
        tags: [["t", 42]],
        message: "Input must be a string",
      },
    ])("rejects $name", ({ content, tags, message }) => {
      expect(() =>
        createTextNote(content, privateKey, tags as unknown as string[][]),
      ).toThrow(message);
    });

    it("accepts addressable kinds and d-tags at their inclusive boundaries", () => {
      expect(createAddressableEvent(30000, "", "", privateKey).kind).toBe(
        30000,
      );
      const upper = createAddressableEvent(
        39999,
        "d".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE),
        "",
        privateKey,
      );

      expect(upper.kind).toBe(39999);
      expect(upper.tags[0][1]).toHaveLength(
        SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE,
      );
    });

    it.each([29999, 40000, 30000.5])(
      "rejects addressable kind %s outside the integer range",
      (kind) => {
        expect(() =>
          createAddressableEvent(kind, "identifier", "", privateKey),
        ).toThrow("Addressable events must have kind between 30000-39999");
      },
    );

    it("rejects a d-tag that exceeds the public event limit", () => {
      expect(() =>
        createAddressableEvent(
          30000,
          "d".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE + 1),
          "",
          privateKey,
        ),
      ).toThrow("D-tag value too long");
    });
  });

  describe("public key, identifier, and signature validation", () => {
    it("accepts a trimmed, case-insensitive private key through LocalKeySigner", async () => {
      const signer = new LocalKeySigner(`  ${privateKey.toUpperCase()}  `);

      await expect(signer.getPublicKey()).resolves.toMatch(/^[0-9a-f]{64}$/);
    });

    it.each([
      { value: 42, message: "Private key must be a string" },
      { value: "a".repeat(63), message: "exactly 64 characters" },
      { value: "z".repeat(64), message: "must be valid hex" },
    ])("rejects malformed private key $value", ({ value, message }) => {
      expect(() => new LocalKeySigner(value as string)).toThrow(message);
    });

    it("accepts a valid signed event and rejects malformed identifiers and signatures", async () => {
      const signed = await createSignedEvent(
        createTextNote("signed boundary", privateKey),
        privateKey,
      );

      await expect(validateEvent(signed)).resolves.toBe(true);

      const malformedEvents: Array<{
        event: NostrEvent;
        message: string;
      }> = [
        {
          event: { ...signed, id: "a".repeat(63) },
          message: "event ID: must be a 64-character hex string",
        },
        {
          event: { ...signed, id: "g".repeat(64) },
          message: "event ID: must be a 64-character hex string",
        },
        {
          event: { ...signed, sig: "a".repeat(127) },
          message: "signature: must be a 128-character hex string",
        },
        {
          event: { ...signed, sig: "g".repeat(128) },
          message: "signature: must be a 128-character hex string",
        },
      ];

      for (const { event, message } of malformedEvents) {
        await expect(
          validateEvent(event, {
            validateIds: false,
            validateSignatures: false,
          }),
        ).rejects.toThrow(message);
      }
    });

    it("validates direct-message tag bounds through the public Event API", async () => {
      const signed = await createSignedEvent(
        createTextNote("direct-message bounds", privateKey),
        privateKey,
      );
      const validationOptions = {
        validateIds: false,
        validateSignatures: false,
        validateTags: false,
      };

      await expect(
        validateEvent(
          { ...signed, kind: 4, tags: [["p", publicKey]] },
          validationOptions,
        ),
      ).resolves.toBe(true);
      await expect(
        validateEvent({ ...signed, kind: 4, tags: [[]] }, validationOptions),
      ).rejects.toThrow("Direct message event must have exactly one p tag");
      await expect(
        validateEvent({ ...signed, kind: 4, tags: [["p"]] }, validationOptions),
      ).rejects.toThrow("Direct message validation bounds checking error");
    });

    it("handles malformed and short thread tags through the public NIP-10 parser", () => {
      const event = {
        id: "a".repeat(64),
        pubkey: publicKey,
        created_at: 1,
        kind: 1,
        tags: [
          "not-a-tag" as unknown as string[],
          Array.from({ length: SECURITY_LIMITS.MAX_ARRAY_SIZE + 1 }, () => "x"),
          ["e", "parent"],
        ],
        content: "thread bounds",
        sig: "b".repeat(128),
      };

      expect(parseThreadReferences(event)).toEqual({
        root: undefined,
        reply: { id: "parent", relay: undefined, pubkey: undefined },
        mentions: [],
        quotes: [],
      });
    });
  });

  describe("public Nostr subscription filters", () => {
    const subscribe = (filters: unknown): string[] =>
      new Nostr().subscribe(filters as Filter[], () => {});

    it("accepts each filter collection and field at the documented boundary", () => {
      const boundaryFilter = {
        ids: Array.from({ length: SECURITY_LIMITS.MAX_FILTER_IDS }, () => "a"),
        authors: Array.from(
          { length: SECURITY_LIMITS.MAX_FILTER_AUTHORS },
          () => "b",
        ),
        kinds: Array.from(
          { length: SECURITY_LIMITS.MAX_FILTER_KINDS },
          (_, index) =>
            index === SECURITY_LIMITS.MAX_FILTER_KINDS - 1
              ? SECURITY_LIMITS.MAX_KIND
              : SECURITY_LIMITS.MIN_KIND,
        ),
        limit: SECURITY_LIMITS.MAX_LIMIT,
        since: SECURITY_LIMITS.MIN_SINCE,
        until: SECURITY_LIMITS.MAX_UNTIL,
        search: "s".repeat(SECURITY_LIMITS.MAX_SEARCH_LENGTH),
        "#e": Array.from(
          { length: SECURITY_LIMITS.MAX_FILTER_TAG_VALUES },
          () => "t".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE),
        ),
      };
      const filters = Array.from(
        { length: SECURITY_LIMITS.MAX_FILTER_COUNT },
        (_, index) => (index === 0 ? boundaryFilter : {}),
      );

      expect(subscribe(filters)).toEqual([]);
      expect(subscribe([{ limit: SECURITY_LIMITS.MIN_LIMIT }])).toEqual([]);
    });

    it.each([
      {
        name: "a non-array filter collection",
        value: {},
        message: "Filters must be an array",
      },
      {
        name: "too many filters",
        value: Array.from(
          { length: SECURITY_LIMITS.MAX_FILTER_COUNT + 1 },
          () => ({}),
        ),
        message: "Too many filters",
      },
      {
        name: "a non-object filter",
        value: [null],
        message: "Filter at index 0: Filter must be an object",
      },
      {
        name: "non-array ids",
        value: [{ ids: "a" }],
        message: "Filter ids must be an array",
      },
      {
        name: "too many ids",
        value: [
          {
            ids: Array.from(
              { length: SECURITY_LIMITS.MAX_FILTER_IDS + 1 },
              () => "a",
            ),
          },
        ],
        message: "Too many filter ids",
      },
      {
        name: "a non-string id",
        value: [{ ids: [42] }],
        message: "Input must be a string",
      },
      {
        name: "an oversized id",
        value: [{ ids: ["a".repeat(SECURITY_LIMITS.MAX_ID_LENGTH + 1)] }],
        message: "String exceeds maximum length",
      },
      {
        name: "a non-hex id",
        value: [{ ids: ["not-hex"] }],
        message: "Invalid ID format",
      },
      {
        name: "non-array authors",
        value: [{ authors: "a" }],
        message: "Filter authors must be an array",
      },
      {
        name: "too many authors",
        value: [
          {
            authors: Array.from(
              { length: SECURITY_LIMITS.MAX_FILTER_AUTHORS + 1 },
              () => "a",
            ),
          },
        ],
        message: "Too many filter authors",
      },
      {
        name: "a non-string author",
        value: [{ authors: [42] }],
        message: "Input must be a string",
      },
      {
        name: "an oversized author",
        value: [
          {
            authors: ["a".repeat(SECURITY_LIMITS.MAX_PUBKEY_LENGTH + 1)],
          },
        ],
        message: "String exceeds maximum length",
      },
      {
        name: "a non-hex author",
        value: [{ authors: ["not-hex"] }],
        message: "Invalid author format",
      },
      {
        name: "non-array kinds",
        value: [{ kinds: 1 }],
        message: "Filter kinds must be an array",
      },
      {
        name: "too many kinds",
        value: [
          {
            kinds: Array.from(
              { length: SECURITY_LIMITS.MAX_FILTER_KINDS + 1 },
              () => 1,
            ),
          },
        ],
        message: "Too many filter kinds",
      },
      {
        name: "a non-finite kind",
        value: [{ kinds: [Number.NaN] }],
        message: "must be a valid finite number",
      },
      {
        name: "a negative kind",
        value: [{ kinds: [SECURITY_LIMITS.MIN_KIND - 1] }],
        message: "must be between",
      },
      {
        name: "a kind above the maximum",
        value: [{ kinds: [SECURITY_LIMITS.MAX_KIND + 1] }],
        message: "must be between",
      },
      {
        name: "a non-finite limit",
        value: [{ limit: Number.POSITIVE_INFINITY }],
        message: "must be a valid finite number",
      },
      {
        name: "a negative limit",
        value: [{ limit: SECURITY_LIMITS.MIN_LIMIT - 1 }],
        message: "must be between",
      },
      {
        name: "a limit above the maximum",
        value: [{ limit: SECURITY_LIMITS.MAX_LIMIT + 1 }],
        message: "must be between",
      },
      {
        name: "since below the supported range",
        value: [{ since: SECURITY_LIMITS.MIN_SINCE - 1 }],
        message: "must be between",
      },
      {
        name: "until above the supported range",
        value: [{ until: SECURITY_LIMITS.MAX_UNTIL + 1 }],
        message: "must be between",
      },
      {
        name: "equal since and until",
        value: [
          {
            since: SECURITY_LIMITS.MIN_SINCE,
            until: SECURITY_LIMITS.MIN_SINCE,
          },
        ],
        message: "must be strictly less than",
      },
      {
        name: "reversed since and until",
        value: [
          {
            since: SECURITY_LIMITS.MAX_SINCE,
            until: SECURITY_LIMITS.MIN_UNTIL,
          },
        ],
        message: "must be strictly less than",
      },
      {
        name: "an oversized search term",
        value: [
          {
            search: "s".repeat(SECURITY_LIMITS.MAX_SEARCH_LENGTH + 1),
          },
        ],
        message: "String exceeds maximum length",
      },
      {
        name: "a non-string search term",
        value: [{ search: 42 }],
        message: "Input must be a string",
      },
      {
        name: "a non-array tag filter",
        value: [{ "#e": "event" }],
        message: "Filter tag #e must be an array",
      },
      {
        name: "too many tag filter values",
        value: [
          {
            "#e": Array.from(
              { length: SECURITY_LIMITS.MAX_FILTER_TAG_VALUES + 1 },
              () => "event",
            ),
          },
        ],
        message: "Too many filter tag values",
      },
      {
        name: "a non-string tag filter value",
        value: [{ "#e": [42] }],
        message: "Input must be a string",
      },
      {
        name: "an oversized tag filter value",
        value: [
          {
            "#e": ["e".repeat(SECURITY_LIMITS.MAX_TAG_ELEMENT_SIZE + 1)],
          },
        ],
        message: "String exceeds maximum length",
      },
    ])("rejects $name", ({ value, message }) => {
      expect(() => subscribe(value)).toThrow(message);
    });
  });

  describe("public Nostr rate limits", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("blocks at the configured boundary and resets exactly when the window expires", () => {
      const windowStart = new Date("2026-07-14T12:00:00.000Z").getTime();
      const now = jest.spyOn(Date, "now").mockReturnValue(windowStart);
      const client = new Nostr([], {
        rateLimits: {
          subscribe: { limit: 1, windowMs: 1000 },
        },
      });

      expect(() => client.subscribe([], () => {})).not.toThrow();
      expect(() => client.subscribe([], () => {})).toThrow(
        "Subscription rate limit exceeded. Try again in 1 seconds",
      );

      now.mockReturnValue(windowStart + 999);
      expect(() => client.subscribe([], () => {})).toThrow(
        "Subscription rate limit exceeded. Try again in 1 seconds",
      );

      now.mockReturnValue(windowStart + 1000);
      expect(() => client.subscribe([], () => {})).not.toThrow();
    });
  });
});
