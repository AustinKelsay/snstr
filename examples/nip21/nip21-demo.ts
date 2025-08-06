#!/usr/bin/env ts-node

/**
 * NIP-21: URI Scheme Demo
 *
 * This example demonstrates:
 * - Encoding Nostr entities as nostr: URIs
 * - Decoding nostr: URIs back to entities
 * - Working with different entity types
 * - Error handling for invalid URIs
 */

import {
  encodeNostrURI,
  decodeNostrURI,
  encodePublicKey,
  encodeNoteId,
  encodeProfile,
  encodeEvent,
  encodeAddress,
  generateKeypair,
} from "../../src/index";

async function main() {
  console.log("🔗 NIP-21: Nostr URI Scheme Demo\n");

  // Generate a sample keypair for examples
  const alice = await generateKeypair();

  console.log("📦 Basic Entity URIs\n");

  // Encode public key as URI
  const npubURI = encodeNostrURI(encodePublicKey(alice.publicKey));
  console.log("👤 Public Key URI:", npubURI);

  // Decode it back
  const decodedPubkey = decodeNostrURI(npubURI);
  console.log("   Decoded:", decodedPubkey);
  console.log();

  // Note: Private keys cannot be encoded as nostr: URIs for security reasons
  console.log("🔐 Private Key URIs are not allowed for security reasons");
  console.log("   Private keys should never be shared in URIs");
  console.log();

  // Encode note ID as URI
  const noteId =
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const encodedNote = encodeNoteId(noteId);
  const noteURI = encodeNostrURI(encodedNote);
  console.log("📝 Note ID URI:", noteURI);
  console.log("   Decoded:", decodeNostrURI(noteURI));
  console.log();

  console.log("🔗 Complex Entity URIs\n");

  // Profile with relays
  const profileData = {
    pubkey: alice.publicKey,
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
  };
  const profileBech32 = encodeProfile(profileData);
  const profileURI = encodeNostrURI(profileBech32);
  console.log("👤 Profile URI:", profileURI);
  console.log("   Decoded:", decodeNostrURI(profileURI));
  console.log();

  // Event with relays and author
  const eventData = {
    id: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    relays: ["wss://relay.damus.io"],
    author: alice.publicKey,
  };
  const eventBech32 = encodeEvent(eventData);
  const eventURI = encodeNostrURI(eventBech32);
  console.log("📄 Event URI:", eventURI);
  console.log("   Decoded:", decodeNostrURI(eventURI));
  console.log();

  // Address (replaceable event)
  const addressData = {
    identifier: "my-article",
    pubkey: alice.publicKey,
    kind: 30023,
    relays: ["wss://relay.damus.io"],
  };
  const addressBech32 = encodeAddress(addressData);
  const addressURI = encodeNostrURI(addressBech32);
  console.log("📍 Address URI:", addressURI);
  console.log("   Decoded:", decodeNostrURI(addressURI));
  console.log();

  console.log("❌ Error Handling\n");

  // Test invalid URIs
  const invalidURIs = [
    "not-a-uri",
    "http://example.com",
    "nostr:invalid",
    "nostr:",
    "mailto:test@example.com",
  ];

  invalidURIs.forEach((uri) => {
    try {
      const result = decodeNostrURI(uri);
      console.log(`✅ ${uri} -> ${JSON.stringify(result)}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${uri} -> Error: ${message}`);
    }
  });

  console.log("\n🌐 Use Cases\n");

  console.log("📱 Mobile App Deep Links:");
  console.log("   nostr:" + encodePublicKey(alice.publicKey));
  console.log("   Opens user profile in app\n");

  console.log("🌍 Web Links:");
  console.log(
    "   https://example.com/user/" + encodePublicKey(alice.publicKey),
  );
  console.log(
    "   Could redirect to: nostr:" + encodePublicKey(alice.publicKey),
  );
  console.log();

  console.log("📧 QR Codes:");
  console.log("   Encode this URI in a QR code:");
  console.log(
    "   nostr:" +
      encodeProfile({
        pubkey: alice.publicKey,
        relays: ["wss://relay.damus.io"],
      }),
  );
  console.log();

  console.log("✨ NIP-21 URI Demo Complete!");
}

// Run the demo
main().catch(console.error);
