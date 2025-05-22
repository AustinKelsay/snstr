/**
 * NIP-19 TLV Encoding Examples
 *
 * This file focuses on the Type-Length-Value (TLV) encoding aspects of NIP-19,
 * demonstrating how to encode and decode complex Nostr entities.
 */

import {
  encodeProfile,
  decodeProfile,
  encodeEvent,
  decodeEvent,
  encodeAddress,
  decodeAddress,
  encodePublicKey,
  encodeNoteId,
  decode,
} from "../../src/nip19";

/**
 * Demonstrates encoding and decoding of nprofile entities
 */
function demonstrateNprofileEncoding() {
  console.log("=== NProfile Encoding/Decoding ===");

  // Example public key and relay URLs
  const pubkey =
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
  const relays = [
    "wss://relay.nostr.info",
    "wss://relay.damus.io",
    "wss://nos.lol",
  ];

  console.log("Input data:");
  console.log(`Pubkey: ${pubkey}`);
  console.log("Relays:");
  relays.forEach((relay: string) => console.log(`- ${relay}`));

  // Encode to TLV format (nprofile)
  const nprofile = encodeProfile({
    pubkey: pubkey,
    relays: relays,
  });

  console.log(`\nEncoded nprofile: ${nprofile}`);

  // Decode back to components
  const decoded = decodeProfile(nprofile);
  console.log("\nDecoded data:");
  console.log(`Pubkey: ${decoded.pubkey}`);
  console.log("Relays:");
  if (decoded.relays) {
    decoded.relays.forEach((relay: string) => console.log(`- ${relay}`));
  } else {
    console.log("(no relays)");
  }

  // Verify roundtrip
  const pubkeyMatch = decoded.pubkey === pubkey;
  const relaysMatch =
    decoded.relays &&
    JSON.stringify([...decoded.relays].sort()) ===
      JSON.stringify([...relays].sort());
  console.log(`\nRoundtrip successful: ${pubkeyMatch && relaysMatch}`);
}

/**
 * Demonstrates encoding and decoding of nevent entities
 */
function demonstrateNeventEncoding() {
  console.log("\n=== NEvent Encoding/Decoding ===");

  // Example event ID, author, and relay URLs
  const id = "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c";
  const author =
    "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245";
  const relays = ["wss://relay.nostr.info", "wss://relay.damus.io"];
  const originalKind = 1; // This kind is part of the EventData in memory

  console.log("Input data (EventData object):");
  console.log(`Event ID: ${id}`);
  console.log(`Author: ${author}`);
  console.log(`Kind (in memory): ${originalKind}`);
  console.log("Relays:");
  relays.forEach((relay: string) => console.log(`- ${relay}`));

  // Encode to TLV format (nevent)
  // The 'originalKind' from EventData is NOT encoded into the nevent string
  const nevent = encodeEvent({
    id: id,
    author: author,
    kind: originalKind, // Passed to encodeEvent, but won't be in the nevent TLV
    relays: relays,
  });

  console.log(`\nEncoded nevent: ${nevent}`);

  // Decode back to components
  const decoded = decodeEvent(nevent);
  console.log("\nDecoded data (from nevent string):");
  console.log(`Event ID: ${decoded.id}`);
  console.log(`Author: ${decoded.author || "(Not included)"}`);
  // 'kind' is not part of nevent TLV, so decoded.kind will be undefined
  console.log(
    `Kind (from nevent): ${decoded.kind !== undefined ? decoded.kind : "(Not part of nevent encoding)"}`,
  );
  console.log("Relays:");
  if (decoded.relays) {
    decoded.relays.forEach((relay: string) => console.log(`- ${relay}`));
  } else {
    console.log("(no relays)");
  }

  // Verify roundtrip for fields that ARE part of nevent encoding
  const idMatch = decoded.id === id;
  const authorMatch = decoded.author === author;
  // kindMatch is no longer applicable as kind is not encoded in nevent
  const relaysMatch =
    (!relays && !decoded.relays) || // Both undefined/empty
    (relays &&
      decoded.relays && // Both defined
      JSON.stringify([...decoded.relays].sort()) ===
        JSON.stringify([...relays].sort()));

  console.log(
    `\nRoundtrip successful (for id, author, relays): ${idMatch && authorMatch && relaysMatch}`,
  );
  console.log(
    "Note: 'kind' is not part of 'nevent' encoding and is not expected to roundtrip.",
  );
}

/**
 * Demonstrates encoding and decoding of naddr entities
 */
function demonstrateNaddrEncoding() {
  console.log("\n=== NAddr Encoding/Decoding ===");

  // Example address components
  const pubkey =
    "e8b487c079b0f67c695ae6c4c2552a47f38adfa2533cc5926bd2c102942fdcb5";
  const kind = 300023; // Example of a 32-bit kind (0x493F7), e.g., for long-form content. Previously 30023.
  const identifier = "article-about-tlv";
  const relays = ["wss://relay.example.com", "wss://nos.lol"];

  console.log("Input data:");
  console.log(`Pubkey: ${pubkey}`);
  console.log(`Kind: ${kind}`);
  console.log(`Identifier: ${identifier}`);
  console.log("Relays:");
  relays.forEach((relay: string) => console.log(`- ${relay}`));

  // Encode to TLV format (naddr)
  const naddr = encodeAddress({
    pubkey: pubkey,
    kind: kind,
    identifier: identifier,
    relays: relays,
  });

  console.log(`\nEncoded naddr: ${naddr}`);

  // Decode back to components
  const decoded = decodeAddress(naddr);
  console.log("\nDecoded data:");
  console.log(`Pubkey: ${decoded.pubkey}`);
  console.log(`Kind: ${decoded.kind}`);
  console.log(`Identifier: ${decoded.identifier}`);
  console.log("Relays:");
  if (decoded.relays) {
    decoded.relays.forEach((relay: string) => console.log(`- ${relay}`));
  } else {
    console.log("(no relays)");
  }

  // Verify roundtrip
  const pubkeyMatch = decoded.pubkey === pubkey;
  const kindMatch = decoded.kind === kind;
  const identifierMatch = decoded.identifier === identifier;
  const relaysMatch =
    decoded.relays &&
    JSON.stringify([...decoded.relays].sort()) ===
      JSON.stringify([...relays].sort());
  console.log(
    `\nRoundtrip successful: ${pubkeyMatch && kindMatch && identifierMatch && relaysMatch}`,
  );
}

/**
 * Explains the TLV format structure
 */
function explainTLVFormat() {
  console.log("\n=== Understanding TLV Format ===");
  console.log(
    "TLV (Type-Length-Value) format allows encoding complex entities with multiple fields:",
  );
  console.log("1. Type: 1 byte identifying the field type");
  console.log("2. Length: 1 byte indicating the length of the value");
  console.log("3. Value: The actual data");

  console.log("\nTLV encoding enables:");
  console.log(
    "- Including multiple pieces of information in a single Bech32 string",
  );
  console.log("- Optional fields (like relays or kinds)");
  console.log("- Future extensibility by adding new field types");

  console.log("\nCommon TLV types in NIP-19:");
  console.log("- Type 0: Special (reserved)");
  console.log("- Type 1: Relay URL");
  console.log("- Type 2: Author public key");
  console.log("- Type 3: Kind number");
  console.log("- Type 4: Event ID");
  console.log("- Type 5: Identifier string");
}

/**
 * Demonstrates generic decoding of any NIP-19 entity
 */
function demonstrateGenericDecoding() {
  console.log("\n=== Generic Decoding of NIP-19 Entities ===");

  // Create sample entities
  const npub = encodePublicKey(
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  );
  const note = encodeNoteId(
    "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c",
  );
  const nprofile = encodeProfile({
    pubkey: "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
    relays: ["wss://relay.nostr.info"],
  });

  // Decode with generic decoder
  console.log("Decoding npub:");
  const decodedNpub = decode(npub);
  console.log(decodedNpub);

  console.log("\nDecoding note:");
  const decodedNote = decode(note);
  console.log(decodedNote);

  console.log("\nDecoding nprofile:");
  const decodedNprofile = decode(nprofile);
  console.log(decodedNprofile);

  console.log("\nThe generic decode function returns:");
  console.log('- type: The entity type (e.g., "npub", "note", "nprofile")');
  console.log("- data: The decoded data (structure depends on type)");
}

/**
 * Main function that runs all the demonstrations
 */
function runTLVExamples() {
  console.log("=== NIP-19 TLV Encoding Examples ===\n");

  demonstrateNprofileEncoding();
  demonstrateNeventEncoding();
  demonstrateNaddrEncoding();
  explainTLVFormat();
  demonstrateGenericDecoding();

  console.log("\nNIP-19 TLV Examples completed.\n");
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runTLVExamples();
}

// Export functions for potential import in other examples
export {
  runTLVExamples,
  demonstrateNprofileEncoding,
  demonstrateNeventEncoding,
  demonstrateNaddrEncoding,
  explainTLVFormat,
  demonstrateGenericDecoding,
};
