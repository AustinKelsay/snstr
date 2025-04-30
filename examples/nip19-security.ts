import {
  decodeProfile,
  decodeEvent,
  decodeAddress,
  filterProfile,
  filterEvent,
  filterAddress,
  filterEntity,
  isValidRelayUrl,
} from "../src/nip19";

console.log("=== NIP-19 Security Examples ===");

// Example 1: Relay URL validation
console.log("\n--- Relay URL Validation ---");
const validUrls = [
  "wss://relay.example.com",
  "ws://localhost:8080",
  "wss://relay.nostr.org",
];

const invalidUrls = [
  "https://not-a-relay.com", // Not a websocket URL
  "wss://user:password@relay.com", // Contains credentials
  'wss://relay.com/malicious?script=alert("xss")', // Contains suspicious query
  "file:///etc/passwd", // Not a websocket protocol
  'javascript:alert("xss")', // JavaScript protocol
];

console.log("Valid URLs:");
validUrls.forEach((url) => {
  console.log(`  ${url}: ${isValidRelayUrl(url) ? "VALID" : "INVALID"}`);
});

console.log("\nInvalid URLs:");
invalidUrls.forEach((url) => {
  console.log(`  ${url}: ${isValidRelayUrl(url) ? "VALID" : "INVALID"}`);
});

// Example 2: Filtering a profile with mixed valid/invalid relays
console.log("\n--- Profile Filtering ---");
const profileWithMixedRelays = {
  pubkey: "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322",
  relays: [
    "wss://relay.example.com",
    "https://malicious.com",
    "wss://valid-relay.org",
    'javascript:alert("xss")',
  ],
};

console.log("Original profile relays:");
profileWithMixedRelays.relays.forEach((relay) => console.log(`  ${relay}`));

const filteredProfile = filterProfile(profileWithMixedRelays);
const originalProfileRelayCount = profileWithMixedRelays.relays.length;
const filteredProfileRelays = filteredProfile.relays || [];

console.log("\nFiltered profile relays:");
filteredProfileRelays.forEach((relay) => console.log(`  ${relay}`));
console.log(
  `Removed ${originalProfileRelayCount - filteredProfileRelays.length} unsafe relays`,
);

// Example 3: Filtering an event with mixed valid/invalid relays
console.log("\n--- Event Filtering ---");
const eventWithMixedRelays = {
  id: "79625777e5ce58dec2b8f4abd85c301935df29ef6f2803ba07af37f97f4a1d07",
  relays: [
    "wss://relay.example.com",
    "http://malicious.com",
    "wss://valid-relay.org",
    "ftp://attack.com",
  ],
};

console.log("Original event relays:");
eventWithMixedRelays.relays.forEach((relay) => console.log(`  ${relay}`));

const filteredEvent = filterEvent(eventWithMixedRelays);
const originalEventRelayCount = eventWithMixedRelays.relays.length;
const filteredEventRelays = filteredEvent.relays || [];

console.log("\nFiltered event relays:");
filteredEventRelays.forEach((relay) => console.log(`  ${relay}`));
console.log(
  `Removed ${originalEventRelayCount - filteredEventRelays.length} unsafe relays`,
);

// Example 4: Generic entity filtering
console.log("\n--- Generic Entity Filtering ---");
console.log("Auto-detecting and filtering different entity types:");

// Create a copy of each entity for filtering
const profileCopy = { ...profileWithMixedRelays };
const eventCopy = { ...eventWithMixedRelays };
const addressWithMixedRelays = {
  identifier: "test",
  pubkey: "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322",
  kind: 30023,
  relays: [
    "wss://relay.example.com",
    "https://malicious.com",
    "wss://valid-relay.org",
    'javascript:alert("xss")',
  ],
};
const addressCopy = { ...addressWithMixedRelays };

// Use the generic filter function
const safeProfile = filterEntity(profileCopy);
const safeEvent = filterEntity(eventCopy);
const safeAddress = filterEntity(addressCopy);

console.log(
  `Profile: ${profileCopy.relays.length} relays -> ${safeProfile.relays.length} safe relays`,
);
console.log(
  `Event: ${eventCopy.relays.length} relays -> ${safeEvent.relays.length} safe relays`,
);
console.log(
  `Address: ${addressCopy.relays.length} relays -> ${safeAddress.relays.length} safe relays`,
);

console.log("\n=== End of Security Examples ===");
