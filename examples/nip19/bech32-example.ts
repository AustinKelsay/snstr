/**
 * NIP-19 Bech32 Encoding Examples
 *
 * This file focuses on the Bech32 encoding aspects of NIP-19,
 * demonstrating how to encode and decode basic Nostr entities.
 */

import {
  encodePublicKey,
  encodePrivateKey,
  encodeNoteId,
  decode,
} from "../../src/nip19";

/**
 * Demonstrates encoding and decoding of public keys (npub)
 */
function demonstratePublicKeyEncoding() {
  console.log("=== Public Key Encoding/Decoding ===");

  // Example public key (hex format)
  const pubkey =
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
  console.log(`Original public key (hex): ${pubkey}`);

  // Encode to Bech32 format (npub)
  const npub = encodePublicKey(pubkey);
  console.log(`Encoded npub: ${npub}`);

  // Decode back to hex
  const decoded = decode(npub);
  console.log(`Decoded type: ${decoded.type}`);
  console.log(`Decoded data: ${decoded.data}`);

  // Verify roundtrip
  console.log(`Roundtrip successful: ${decoded.data === pubkey}`);
}

/**
 * Demonstrates encoding and decoding of private keys (nsec)
 */
function demonstratePrivateKeyEncoding() {
  console.log("\n=== Private Key Encoding/Decoding ===");

  // Example private key (hex format)
  const privkey =
    "d55f1f2d59c62fb6fa5b1d88adf3e9aad291d63f9d0fcef6b5c8139a400f3dd6";
  console.log(`Original private key (hex): ${privkey}`);

  // Encode to Bech32 format (nsec)
  const nsec = encodePrivateKey(privkey);
  console.log(`Encoded nsec: ${nsec}`);

  // Decode back to hex
  const decoded = decode(nsec);
  console.log(`Decoded type: ${decoded.type}`);
  console.log(`Decoded data: ${decoded.data}`);

  // Verify roundtrip
  console.log(`Roundtrip successful: ${decoded.data === privkey}`);

  // Security warning
  console.log("\n⚠️ SECURITY WARNING: Never share your nsec with anyone!");
  console.log(
    "Private keys should be kept secure and not exposed in applications.",
  );
}

/**
 * Demonstrates encoding and decoding of note IDs (note)
 */
function demonstrateNoteIdEncoding() {
  console.log("\n=== Note ID Encoding/Decoding ===");

  // Example note ID (hex format)
  const noteId =
    "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c";
  console.log(`Original note ID (hex): ${noteId}`);

  // Encode to Bech32 format (note)
  const note = encodeNoteId(noteId);
  console.log(`Encoded note: ${note}`);

  // Decode back to hex
  const decoded = decode(note);
  console.log(`Decoded type: ${decoded.type}`);
  console.log(`Decoded data: ${decoded.data}`);

  // Verify roundtrip
  console.log(`Roundtrip successful: ${decoded.data === noteId}`);
}

/**
 * Explains the Bech32 format
 */
function explainBech32Format() {
  console.log("\n=== Understanding Bech32 Format ===");
  console.log("Bech32 encoding provides:");
  console.log("1. Human-readable prefixes (e.g., npub, nsec, note)");
  console.log("2. Error detection with checksums");
  console.log("3. Case-insensitive format");
  console.log("4. No similar looking characters (no 1, b, i, o)");

  console.log("\nBech32 encoded strings have two parts:");
  console.log(
    "1. Human-readable part (HRP): The prefix that indicates the type",
  );
  console.log("2. Data part: The actual data encoded in base32");

  console.log("\nCommon NIP-19 HRPs:");
  console.log("- npub: Public keys");
  console.log("- nsec: Private keys");
  console.log("- note: Note IDs (event IDs)");
  console.log("- nprofile: Profile information with optional relay hints");
  console.log("- nevent: Event information with optional relay hints");
  console.log("- naddr: Addresses for parameterized replaceable events");
}

/**
 * Demonstrates example usage in an application
 */
function demonstrateApplicationUsage() {
  console.log("\n=== Example Application Usage ===");

  // Profile display example
  const pubkey =
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
  const npub = encodePublicKey(pubkey);

  console.log("User Profile Page Example:");
  console.log("-------------------------");
  console.log("Username: satoshi");
  console.log(
    `ID: ${npub.substring(0, 8)}...${npub.substring(npub.length - 8)}`,
  );
  console.log(`Full ID: ${npub}`);

  // Note display example
  const noteId =
    "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c";
  const note = encodeNoteId(noteId);

  console.log("\nNote Sharing Example:");
  console.log("-------------------");
  console.log(`Check out this note: ${note.substring(0, 12)}...`);
  console.log(`Direct link: https://example.com/note/${note}`);
}

/**
 * Main function that runs all the demonstrations
 */
function runBech32Examples() {
  console.log("=== NIP-19 Bech32 Encoding Examples ===\n");

  demonstratePublicKeyEncoding();
  demonstratePrivateKeyEncoding();
  demonstrateNoteIdEncoding();
  explainBech32Format();
  demonstrateApplicationUsage();

  console.log("\nNIP-19 Bech32 Examples completed.\n");
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runBech32Examples();
}

// Export functions for potential import in other examples
export {
  runBech32Examples,
  demonstratePublicKeyEncoding,
  demonstratePrivateKeyEncoding,
  demonstrateNoteIdEncoding,
  explainBech32Format,
  demonstrateApplicationUsage,
};
