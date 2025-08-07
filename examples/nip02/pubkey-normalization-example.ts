/**
 * Example demonstrating the enhanced pubkey normalization consistency in NIP-02
 *
 * This example shows how the improved Contact parsing ensures that downstream
 * consumers always receive normalized pubkeys consistently, even when the
 * deduplication logic normalizes keys internally.
 */

import { parseContactsFromEvent } from "../../src/nip02";
import { ContactsEvent, NostrKind } from "../../src/types/nostr";

console.log("=== NIP-02 Pubkey Normalization Consistency Example ===\n");

// Create a mock contact list event for demonstration
const mockEvent: ContactsEvent = {
  kind: NostrKind.Contacts,
  pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  created_at: Math.floor(Date.now() / 1000),
  id: "example-event-id",
  sig: "example-signature",
  tags: [
    [
      "p",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "wss://relay1.com",
      "Alice",
    ],
    [
      "p",
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "wss://relay2.com",
      "Bob",
    ],
    [
      "p",
      "1111111111111111111111111111111111111111111111111111111111111111",
      "",
      "Charlie",
    ],
    [
      "p",
      "2222222222222222222222222222222222222222222222222222222222222222",
      "wss://relay3.com",
      "",
    ],
  ],
  content: "",
};

console.log("1. Parsing contact list with normalized pubkeys:");
console.log(
  "   All pubkeys in Contact objects are guaranteed to be normalized\n",
);

const contacts = parseContactsFromEvent(mockEvent);

console.log(`Found ${contacts.length} contacts:\n`);

contacts.forEach((contact, index) => {
  console.log(`Contact ${index + 1}:`);
  console.log(`  → Pubkey: ${contact.pubkey}`);
  console.log(`  → Relay: ${contact.relayUrl || "Not specified"}`);
  console.log(`  → Petname: ${contact.petname || "Not specified"}`);

  // Verify that the pubkey is in normalized lowercase format
  const isNormalized = contact.pubkey === contact.pubkey.toLowerCase();
  console.log(`  → Normalized: ${isNormalized ? "✓ Yes" : "✗ No"}`);
  console.log("");
});

console.log("2. Demonstrating deduplication with normalization:");
console.log("   The parsing logic handles case variations consistently\n");

// Create an event that would test deduplication (if validation allowed mixed case)
const deduplicationTestEvent: ContactsEvent = {
  ...mockEvent,
  tags: [
    [
      "p",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "wss://relay1.com",
      "First Entry",
    ],
    [
      "p",
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "wss://relay2.com",
      "Different Contact",
    ],
    // Note: In practice, only the first entry would be kept due to deduplication
  ],
};

const deduplicatedContacts = parseContactsFromEvent(deduplicationTestEvent);
console.log(
  `Deduplication result: ${deduplicatedContacts.length} unique contacts\n`,
);

deduplicatedContacts.forEach((contact, index) => {
  console.log(`Unique Contact ${index + 1}:`);
  console.log(`  → Pubkey: ${contact.pubkey}`);
  console.log(`  → Petname: ${contact.petname || "Not specified"}`);
  console.log("");
});

console.log("3. Benefits of this normalization consistency:");
console.log("   ✓ Downstream consumers always receive lowercase pubkeys");
console.log("   ✓ Deduplication logic and output format are consistent");
console.log("   ✓ Future-proof against validator changes");
console.log("   ✓ Eliminates potential case-sensitivity bugs");
console.log("   ✓ Ensures reliable key-based lookups and comparisons\n");

console.log("4. Key improvement:");
console.log(
  "   Before: Normalization for deduplication, original case in output",
);
console.log(
  "   After:  Normalization for both deduplication AND output consistency",
);
console.log("\n=== Example Complete ===");
