import { Nostr } from "../../../src/nip01/nostr";

describe("Nostr URL Normalization", () => {
  let nostr: Nostr;

  beforeEach(() => {
    nostr = new Nostr();
  });

  afterEach(async () => {
    // Await in case disconnectFromRelays becomes asynchronous or returns Promise in future
    await nostr.disconnectFromRelays();
  });

  it("should normalize a simple URL correctly", () => {
    const input = "wss://Example.Com/path";
    const expected = "wss://example.com/path";
    
    const relay = nostr.addRelay(input);
    expect(relay).toBeDefined();
    
    // Try to retrieve with the normalized URL
    const retrievedRelay = nostr.getRelay(expected);
    expect(retrievedRelay).toBe(relay);
  });

  it("should handle URL without path correctly", () => {
    const input = "wss://Example.Com";
    const expected = "wss://example.com";
    
    const relay = nostr.addRelay(input);
    expect(relay).toBeDefined();
    
    const retrievedRelay = nostr.getRelay(expected);
    expect(retrievedRelay).toBe(relay);
  });

  it("should preserve case in path and query parameters", () => {
    const input = "wss://Example.Com/CaseSensitive/Path?Query=Value&key=CaseValue";
    const expected = "wss://example.com/CaseSensitive/Path?Query=Value&key=CaseValue";
    
    const relay = nostr.addRelay(input);
    expect(relay).toBeDefined();
    
    const retrievedRelay = nostr.getRelay(expected);
    expect(retrievedRelay).toBe(relay);
  });

  it("should handle URLs with fragments correctly", () => {
    const input = "wss://Relay.Example.Com/path?query=value#Fragment";
    const expected = "wss://relay.example.com/path?query=value#Fragment";
    
    const relay = nostr.addRelay(input);
    const retrievedRelay = nostr.getRelay(expected);
    expect(retrievedRelay).toBe(relay);
  });
}); 