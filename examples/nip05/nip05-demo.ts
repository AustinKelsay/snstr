/**
 * NIP-05 Demonstration
 *
 * This example shows how to use the NIP-05 functionality to:
 * 1. Verify a NIP-05 identifier against a pubkey
 * 2. Lookup a NIP-05 identifier to find the associated pubkey
 * 3. Get recommended relays for a user
 */

import {
  verifyNIP05,
  lookupNIP05,
  getNIP05PubKey,
  getNIP05Relays,
} from "../../src/nip05";

// Enable verbose logging if environment variable is set
const verbose = process.env.VERBOSE === "true";

/**
 * Log function that only prints if verbose mode is enabled
 */
function log(...args: any[]) {
  if (verbose) {
    console.log(...args);
  }
}

async function main() {
  // Example NIP-05 identifiers to test with
  // Replace these with real identifiers you want to test
  const identifiers = [
    "bob@example.com", // Sample from NIP-05 (won't work)
    "_@example.com", // Root identifier (won't work)
    "jack@cash.app", // Real example
    "jack@damus.io", // Real example
  ];

  console.log("===== NIP-05 DEMO =====\n");

  for (const identifier of identifiers) {
    console.log(`\n----- Testing identifier: ${identifier} -----`);

    try {
      // 1. Lookup the NIP-05 record
      console.log(`Looking up ${identifier}...`);
      const result = await lookupNIP05(identifier);

      if (result) {
        const [name] = identifier.split("@");
        console.log(`Found NIP-05 record for ${identifier}`);

        if (result.names && result.names[name.toLowerCase()]) {
          console.log(`Public key: ${result.names[name.toLowerCase()]}`);

          // 2. Get recommended relays
          const pubkey = result.names[name.toLowerCase()];
          const relays = await getNIP05Relays(identifier, pubkey);
          if (relays && relays.length > 0) {
            console.log("Recommended relays:");
            relays.forEach((relay) => console.log(`  - ${relay}`));
          } else {
            console.log("No recommended relays found");
          }

          // 3. Verify a pubkey (using the one we just found)
          const isValid = await verifyNIP05(identifier, pubkey);
          console.log(
            `Verification with correct pubkey: ${isValid ? "VALID ✅" : "INVALID ❌"}`,
          );

          // 4. Try verification with an incorrect pubkey
          const wrongPubkey =
            "e8b487c079b0f67c695ae6c4c2552a47c79e3b42c104952a214c6eb16cc30d10";
          const isInvalid = await verifyNIP05(identifier, wrongPubkey);
          console.log(
            `Verification with incorrect pubkey: ${isInvalid ? "VALID ✅" : "INVALID ❌"}`,
          );
        } else {
          console.log(`No name ${name} found in the response`);
        }
      } else {
        console.log(`Failed to find NIP-05 record for ${identifier}`);
      }
    } catch (error) {
      console.error(`Error processing ${identifier}:`, error);
    }
  }

  console.log("\n===== NIP-05 DEMO COMPLETE =====");
}

main().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
