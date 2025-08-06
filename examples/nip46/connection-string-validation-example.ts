/**
 * Example demonstrating the enhanced pubkey validation in NIP-46 connection strings
 *
 * This example shows how the improved connection string parsing prevents uppercase
 * pubkeys from bypassing validation by preserving the original case before validation.
 */

import {
  parseConnectionString,
  buildConnectionString,
} from "../../src/nip46/utils/connection";
import { NIP46ConnectionError } from "../../src/nip46/types";

console.log("=== NIP-46 Connection String Pubkey Validation Example ===\n");

// Valid lowercase pubkey (should work)
const validLowercasePubkey =
  "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
// Invalid uppercase pubkey (should be rejected)
const invalidUppercasePubkey =
  "1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF";
const validRelay = "wss://relay.example.com";

console.log("1. Valid connection string parsing:");
console.log(
  "   ✓ Connection strings with properly formatted lowercase pubkeys are accepted\n",
);

try {
  const validConnectionString = `bunker://${validLowercasePubkey}?relay=${encodeURIComponent(validRelay)}&secret=test123`;
  const result = parseConnectionString(validConnectionString);

  console.log("   → Connection string:", validConnectionString);
  console.log("   → Parsed successfully:");
  console.log("     • Type:", result.type);
  console.log("     • Pubkey:", result.pubkey);
  console.log("     • Relays:", result.relays);
  console.log("     • Secret:", result.secret || "none");
  console.log();
} catch (error) {
  console.log("   → Unexpected error:", (error as Error).message);
  console.log();
}

console.log("2. Invalid uppercase pubkey rejection:");
console.log(
  "   ✗ Connection strings with uppercase pubkeys are properly rejected\n",
);

try {
  const invalidConnectionString = `bunker://${invalidUppercasePubkey}?relay=${encodeURIComponent(validRelay)}`;

  console.log("   → Connection string:", invalidConnectionString);
  console.log("   → Attempting to parse...");

  const result = parseConnectionString(invalidConnectionString);
  console.log(
    "   → ERROR: Should have been rejected but was accepted:",
    result,
  );
} catch (error) {
  if (error instanceof NIP46ConnectionError) {
    console.log("   → ✓ Correctly rejected:", error.message);
  } else {
    console.log("   → Unexpected error type:", (error as Error).message);
  }
}
console.log();

console.log("3. Case preservation validation:");
console.log(
  "   The fix ensures that pubkey case is preserved during validation\n",
);

// Before the fix, URL.hostname would have lowercased this automatically
const mixedCasePubkey =
  "1234567890ABCdef1234567890ABCdef1234567890ABCdef1234567890ABCdef";

try {
  const mixedCaseConnectionString = `nostrconnect://${mixedCasePubkey}`;

  console.log("   → Mixed case connection string:", mixedCaseConnectionString);
  console.log("   → Attempting to parse...");

  parseConnectionString(mixedCaseConnectionString);
  console.log("   → ERROR: Should have been rejected but was accepted");
} catch (error) {
  if (error instanceof NIP46ConnectionError) {
    console.log("   → ✓ Correctly rejected mixed case pubkey:", error.message);
  } else {
    console.log("   → Unexpected error:", (error as Error).message);
  }
}
console.log();

console.log("4. Build and parse roundtrip:");
console.log(
  "   Testing that valid pubkeys work through the full build/parse cycle\n",
);

try {
  // Build a connection string with a valid pubkey
  const connectionOptions = {
    pubkey: validLowercasePubkey,
    relays: [validRelay, "wss://backup.relay.com"],
    secret: "roundtrip-secret",
  };

  const builtString = buildConnectionString(connectionOptions);
  console.log("   → Built connection string:", builtString);

  const parsedResult = parseConnectionString(builtString);
  console.log("   → Parsed back successfully:");
  console.log(
    "     • Pubkey matches:",
    parsedResult.pubkey === connectionOptions.pubkey,
  );
  console.log(
    "     • Relays match:",
    JSON.stringify(parsedResult.relays) ===
      JSON.stringify(connectionOptions.relays),
  );
  console.log(
    "     • Secret matches:",
    parsedResult.secret === connectionOptions.secret,
  );
  console.log();
} catch (error) {
  console.log("   → Error in roundtrip test:", (error as Error).message);
  console.log();
}

console.log("5. Edge case handling:");
console.log("   Testing various edge cases and malformed inputs\n");

const edgeCases = [
  {
    name: "Short pubkey",
    connectionString: "bunker://1234abcd?relay=wss://relay.com",
    shouldFail: true,
  },
  {
    name: "Non-hex characters",
    connectionString:
      "bunker://1234567890abcdefg234567890abcdef1234567890abcdef1234567890abcdef?relay=wss://relay.com",
    shouldFail: true,
  },
  {
    name: "Empty pubkey",
    connectionString: "bunker://?relay=wss://relay.com",
    shouldFail: true,
  },
  {
    name: "Valid with fragment",
    connectionString: `bunker://${validLowercasePubkey}?relay=wss://relay.com#fragment`,
    shouldFail: false,
  },
];

for (const { name, connectionString, shouldFail } of edgeCases) {
  try {
    const result = parseConnectionString(connectionString);
    if (shouldFail) {
      console.log(
        `   → ${name}: ERROR - Should have failed but parsed successfully`,
      );
    } else {
      console.log(
        `   → ${name}: ✓ Parsed successfully (pubkey: ${result.pubkey.substring(0, 16)}...)`,
      );
    }
  } catch (error) {
    if (shouldFail) {
      console.log(
        `   → ${name}: ✓ Correctly rejected - ${(error as Error).message}`,
      );
    } else {
      console.log(
        `   → ${name}: ERROR - Should have succeeded but failed: ${(error as Error).message}`,
      );
    }
  }
}

console.log("\n=== Summary ===");
console.log("The fix ensures that:");
console.log("• Pubkey case is preserved during validation");
console.log("• Uppercase pubkeys are properly rejected");
console.log("• URL.hostname normalization doesn't bypass validation");
console.log("• All existing functionality remains intact");
console.log("• Edge cases are handled gracefully");
