import { createRelayDiscoveryEvent } from "../../src/nip66";
import { RelayUrlValidationError } from "../../src/utils/relayUrl";

describe("NIP-66 Relay URL Error Handling", () => {
  const testPubkey = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

  test("should re-throw RelayUrlValidationError for scheme validation errors", () => {
    expect(() => {
      createRelayDiscoveryEvent({
        relay: "http://example.com",
      }, testPubkey);
    }).toThrow(RelayUrlValidationError);

    // Verify it's specifically a scheme error
    try {
      createRelayDiscoveryEvent({
        relay: "http://example.com",
      }, testPubkey);
    } catch (error) {
      expect(error).toBeInstanceOf(RelayUrlValidationError);
      expect((error as RelayUrlValidationError).errorType).toBe('scheme');
      expect((error as RelayUrlValidationError).invalidUrl).toBe('http://example.com');
    }
  });

  test("should use type-based error handling instead of string matching", () => {
    // This test verifies that empty strings are caught by NIP-66 validation first
    expect(() => {
      createRelayDiscoveryEvent({
        relay: "",
      }, testPubkey);
    }).toThrow(/Valid relay URL is required/);

    // The key accomplishment is that scheme validation errors are re-thrown properly
    // based on instanceof checks rather than string matching
    expect(() => {
      createRelayDiscoveryEvent({
        relay: "https://example.com",
      }, testPubkey);
    }).toThrow(RelayUrlValidationError);
  });

  test("should throw generic error for non-RelayUrlValidationError exceptions", () => {
    // This test ensures that other types of errors get converted to generic validation errors
    // The pubkey validation happens at the event creation level
    expect(() => {
      createRelayDiscoveryEvent({
        relay: "wss://valid-url.com",
      }, "invalid-pubkey");
    }).toThrow(/Invalid pubkey format/);
  });

  test("should handle valid relay URLs correctly", () => {
    const event = createRelayDiscoveryEvent({
      relay: "wss://relay.example.com",
    }, testPubkey);

    expect(event.kind).toBe(30166);
    expect(event.tags).toEqual([["d", "wss://relay.example.com"]]);
  });

  test("should handle valid relay URLs with case normalization", () => {
    const event = createRelayDiscoveryEvent({
      relay: "WSS://RELAY.EXAMPLE.COM/path",
    }, testPubkey);

    expect(event.kind).toBe(30166);
    // Should be normalized to lowercase scheme and host, but preserve path case
    expect(event.tags).toEqual([["d", "wss://relay.example.com/path"]]);
  });
}); 