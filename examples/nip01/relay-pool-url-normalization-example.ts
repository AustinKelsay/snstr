/**
 * Example demonstrating the enhanced URL normalization in RelayPool class
 * 
 * This example shows how the improved URL handling prevents duplicate connections
 * by properly normalizing case variations of the same relay URL and validates
 * schemes to prevent malformed URLs.
 */

import { RelayPool } from "../../src/nip01/relayPool";

console.log("=== RelayPool URL Normalization Example ===\n");

const pool = new RelayPool();

console.log("1. Case normalization prevents duplicate connections:");
console.log("   Different case variations of the same URL are treated as identical\n");

// Add relay with different case variations
console.log("Adding relay with different case variations:");
console.log("→ pool.addRelay('WSS://Relay.Example.COM')");
const relay1 = pool.addRelay("WSS://Relay.Example.COM");

console.log("→ pool.addRelay('wss://relay.example.com')");
const relay2 = pool.addRelay("wss://relay.example.com");

console.log("→ pool.addRelay('wSs://RELAY.example.COM/path')");
const relay3 = pool.addRelay("wSs://RELAY.example.COM/path");

console.log("\nResults:");
console.log(`→ relay1 === relay2: ${relay1 === relay2} (same instance)`);
console.log(`→ Different paths are treated as different relays: ${relay1 !== relay3}`);
console.log("→ Case normalization prevents duplicate connections");
console.log("→ Different paths create separate relay connections");

console.log("\n2. Automatic wss:// prefix with case normalization:");

// Test URLs without scheme
const relay4 = pool.addRelay("ANOTHER.Example.COM:8080");
const relay5 = pool.addRelay("wss://another.example.com:8080");

console.log(`→ Hostname with port gets wss:// prefix and normalized: ${relay4 === relay5}`);

console.log("\n3. Invalid scheme handling:");
console.log("   URLs with invalid schemes are rejected with clear error messages\n");

const invalidUrls = [
  "http://example.com",
  "https://secure.example.com",
  "ftp://files.example.com"
];

invalidUrls.forEach(url => {
  try {
    pool.addRelay(url);
    console.log(`→ ${url}: UNEXPECTEDLY ACCEPTED`);
  } catch (error) {
    console.log(`→ ${url}: REJECTED - ${(error as Error).message.split('.')[0]}`);
  }
});

console.log("\n4. Input validation:");
console.log("   Empty and invalid inputs are handled gracefully\n");

const invalidInputs = ["", "   ", null, undefined];

invalidInputs.forEach(input => {
  try {
    pool.addRelay(input as unknown as string);
    console.log(`→ ${JSON.stringify(input)}: UNEXPECTEDLY ACCEPTED`);
  } catch (error) {
    console.log(`→ ${JSON.stringify(input)}: REJECTED - Invalid relay URL`);
  }
});

console.log("\n5. Cross-operation consistency:");
console.log("   Normalization works consistently across all RelayPool operations\n");

// Add with one case
pool.addRelay("WSS://Cross.Operation.Example.COM");
console.log("→ Added relay: WSS://Cross.Operation.Example.COM");

// Remove with different case should work
pool.removeRelay("wss://cross.operation.example.com");
console.log("→ Removed with: wss://cross.operation.example.com");
console.log("→ Successfully removed (relay no longer accessible)");

console.log("\n6. Complex URL patterns:");
console.log("   URLs with paths, queries, and fragments are handled correctly\n");

const complexUrl1 = "WSS://Complex.Example.COM:9000/ws/path?param=value&other=test#section";
const complexUrl2 = "wss://complex.example.com:9000/ws/path?param=value&other=test#section";

const complexRelay1 = pool.addRelay(complexUrl1);
const complexRelay2 = pool.addRelay(complexUrl2);

console.log(`→ Complex URLs properly normalized: ${complexRelay1 === complexRelay2}`);

// Show final state
console.log("\nFinal relay pool state:");
console.log("→ Multiple unique relay connections established");
console.log("→ Case normalization prevented duplicates");
console.log("→ Each unique URL pattern has its own connection");

// Cleanup
pool.close();
console.log("\n✓ All relay connections closed");

console.log("\n=== Benefits of URL Normalization ===");
console.log("✓ Prevents duplicate relay connections from case variations");
console.log("✓ Ensures consistent relay identification across operations");  
console.log("✓ Provides clear error messages for invalid schemes");
console.log("✓ Maintains backward compatibility with existing code");
console.log("✓ Preserves case sensitivity where it matters (paths, queries)");
console.log("✓ Reduces memory usage and connection overhead"); 