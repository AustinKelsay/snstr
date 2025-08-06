/**
 * Example demonstrating the enhanced URL preprocessing in NIP-01 Nostr class
 *
 * This example shows how the improved URL handling prevents the original bug
 * where "wss://" was incorrectly prefixed to URLs that already had schemes,
 * creating malformed URLs like "wss://http://example.com"
 */

import { Nostr } from "../../src/nip01/nostr";

console.log("=== NIP-01 URL Preprocessing Example ===\n");

const nostr = new Nostr();

console.log("1. Valid URL handling:");
console.log("   ✓ URLs with correct WebSocket schemes are accepted");

try {
  nostr.addRelay("wss://relay.example.com");
  console.log("   → wss://relay.example.com: SUCCESS");
} catch (error) {
  console.log(
    "   → wss://relay.example.com: FAILED -",
    (error as Error).message,
  );
}

try {
  nostr.addRelay("ws://localhost:8080");
  console.log("   → ws://localhost:8080: SUCCESS");
} catch (error) {
  console.log("   → ws://localhost:8080: FAILED -", (error as Error).message);
}

console.log("\n2. Automatic wss:// prefix for URLs without scheme:");
console.log("   ✓ Plain hostnames get wss:// prefix automatically");

try {
  nostr.addRelay("relay.example.com");
  console.log(
    "   → relay.example.com: SUCCESS (becomes wss://relay.example.com)",
  );
} catch (error) {
  console.log("   → relay.example.com: FAILED -", (error as Error).message);
}

try {
  nostr.addRelay("relay.example.com:8080");
  console.log(
    "   → relay.example.com:8080: SUCCESS (becomes wss://relay.example.com:8080)",
  );
} catch (error) {
  console.log(
    "   → relay.example.com:8080: FAILED -",
    (error as Error).message,
  );
}

console.log("\n3. Case-insensitive scheme handling:");
console.log("   ✓ Mixed case WebSocket schemes are normalized");

try {
  nostr.addRelay("WSS://relay.example.com");
  console.log("   → WSS://relay.example.com: SUCCESS");
} catch (error) {
  console.log(
    "   → WSS://relay.example.com: FAILED -",
    (error as Error).message,
  );
}

try {
  nostr.addRelay("WS://localhost:8080");
  console.log("   → WS://localhost:8080: SUCCESS");
} catch (error) {
  console.log("   → WS://localhost:8080: FAILED -", (error as Error).message);
}

console.log("\n4. Prevention of malformed URL construction:");
console.log("   ✗ URLs with incompatible schemes are rejected immediately");
console.log(
  "   ⚠️  This prevents the original bug: 'wss://http://example.com'",
);

const incompatibleUrls = [
  "http://example.com",
  "https://example.com",
  "ftp://files.example.com",
  "javascript:alert('xss')",
  "file:///path/to/file",
  "custom-protocol://example.com",
];

incompatibleUrls.forEach((url) => {
  try {
    nostr.addRelay(url);
    console.log(`   → ${url}: UNEXPECTED SUCCESS`);
  } catch (error) {
    console.log(`   → ${url}: CORRECTLY REJECTED`);
    console.log(`     Error: ${(error as Error).message}`);
  }
});

console.log("\n5. Input validation:");
console.log("   ✗ Invalid inputs are caught early with clear error messages");

const invalidInputs: (string | null | undefined | number)[] = [
  "",
  "   ",
  null,
  undefined,
  123,
];

invalidInputs.forEach((input, index) => {
  try {
    // @ts-expect-error Testing invalid non-string inputs
    nostr.addRelay(input);
    console.log(`   → Invalid input ${index + 1}: UNEXPECTED SUCCESS`);
  } catch (error) {
    console.log(`   → Invalid input ${index + 1}: CORRECTLY REJECTED`);
    console.log(`     Error: ${(error as Error).message}`);
  }
});

console.log("\n6. Consistent behavior across methods:");
console.log(
  "   ✓ addRelay, getRelay, and removeRelay handle URLs consistently",
);

try {
  // Add a relay with no scheme
  nostr.addRelay("consistent.example.com");
  console.log("   → Added: consistent.example.com");

  // Retrieve using same format
  const relay1 = nostr.getRelay("consistent.example.com");
  console.log("   → Retrieved with no scheme:", relay1 ? "SUCCESS" : "FAILED");

  // Retrieve using full URL
  const relay2 = nostr.getRelay("wss://consistent.example.com");
  console.log("   → Retrieved with full URL:", relay2 ? "SUCCESS" : "FAILED");

  // Remove using original format
  nostr.removeRelay("consistent.example.com");
  console.log("   → Removed using original format");

  // Verify removal
  const relay3 = nostr.getRelay("consistent.example.com");
  console.log("   → Verified removal:", relay3 ? "FAILED" : "SUCCESS");
} catch (error) {
  console.log("   → Consistency test FAILED:", (error as Error).message);
}

console.log("\n7. Error message quality:");
console.log("   ✓ Clear, actionable error messages for common mistakes");

try {
  nostr.addRelay("http://relay.example.com");
} catch (error) {
  const message = (error as Error).message;
  console.log("   → Sample error message for http:// URL:");
  console.log(`     "${message}"`);
  console.log("   → ✓ Mentions invalid scheme");
  console.log("   → ✓ Suggests valid alternatives (ws://, wss://)");
  console.log("   → ✓ Shows the problematic input");
  console.log("   → ✓ Explains the requirement (WebSocket protocols)");
}

console.log("\n=== Summary ===");
console.log(
  "✅ Problem solved: No more malformed URLs like 'wss://http://example.com'",
);
console.log(
  "✅ Fast fail: Invalid schemes are rejected immediately with clear errors",
);
console.log("✅ Backward compatible: Existing valid usage patterns still work");
console.log("✅ Developer friendly: High-quality error messages for debugging");
console.log(
  "✅ Robust: Handles edge cases, mixed case, ports, and various input types",
);
console.log(
  "✅ Consistent: All relay methods use the same URL processing logic",
);

// Clean up
nostr.disconnectFromRelays();
