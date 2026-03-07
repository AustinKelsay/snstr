import {
  AUTH_EVENT_KIND,
  createAuthEventTemplate,
  createSignedAuthEvent,
  isAuthEvent,
  parseAuthRequiredReason,
  validateAuthEvent,
} from "../../src/nip42";
import { createAuthEventTemplate as createAuthEventTemplateFromEntry } from "../../src";
import { generateKeypair } from "../../src/utils/crypto";

describe("NIP-42", () => {
  test("should create an auth event template with normalized relay tag", () => {
    const template = createAuthEventTemplate(
      "challenge-123",
      "WSS://Relay.Example.com/",
      1234,
    );

    expect(template.kind).toBe(AUTH_EVENT_KIND);
    expect(template.content).toBe("");
    expect(template.created_at).toBe(1234);
    expect(template.tags).toEqual([
      ["relay", "wss://relay.example.com"],
      ["challenge", "challenge-123"],
    ]);
  });

  test("should create and validate a signed auth event", async () => {
    const keypair = await generateKeypair();
    const authEvent = await createSignedAuthEvent(
      "challenge-456",
      "wss://relay.example.com",
      keypair.privateKey,
      Math.floor(Date.now() / 1000),
    );

    expect(authEvent.kind).toBe(AUTH_EVENT_KIND);
    expect(isAuthEvent(authEvent)).toBe(true);

    await expect(
      validateAuthEvent(authEvent, {
        challenge: "challenge-456",
        relayUrl: "wss://relay.example.com",
      }),
    ).resolves.toBe(true);
  });

  test("should parse auth-required NIP-20 reasons", () => {
    expect(parseAuthRequiredReason("auth-required: membership required")).toBe(
      "membership required",
    );
    expect(parseAuthRequiredReason("blocked: nope")).toBeUndefined();
  });

  test("should expose NIP-42 helpers from the main entry surface", () => {
    const template = createAuthEventTemplateFromEntry(
      "entry-challenge",
      "wss://relay.example.com",
      42,
    );

    expect(template.kind).toBe(AUTH_EVENT_KIND);
    expect(template.tags).toEqual([
      ["relay", "wss://relay.example.com"],
      ["challenge", "entry-challenge"],
    ]);
  });

  test("should reject oversized auth challenge tag values", () => {
    expect(() =>
      createAuthEventTemplate(
        "c".repeat(513),
        "wss://relay.example.com",
      ),
    ).toThrow(/maximum length/i);
  });

  test("should reject oversized normalized relay tag values", () => {
    expect(() =>
      createAuthEventTemplate(
        "challenge",
        `wss://relay.example.com/${"r".repeat(600)}`,
      ),
    ).toThrow(/maximum length/i);
  });
});
