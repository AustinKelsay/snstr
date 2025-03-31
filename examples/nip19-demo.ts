import {
  encodePublicKey,
  decodePublicKey,
  encodePrivateKey,
  decodePrivateKey,
  encodeNoteId,
  decodeNoteId,
  encodeProfile,
  decodeProfile,
  encodeEvent,
  decodeEvent,
  encodeAddress,
  decodeAddress,
  encodeRelay,
  decodeRelay,
  decode
} from '../src/nip19';

// Set log level
const verbose = process.env.VERBOSE === 'true';
function log(...args: any[]) {
  if (verbose) {
    console.log(...args);
  }
}

// Basic bech32 encodings
console.log('=== Basic Bech32 Encodings ===');

// Encode public key
const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const npub = encodePublicKey(pubkey);
console.log(`Public Key: ${pubkey}`);
console.log(`Encoded npub: ${npub}`);

// Decode npub
const decodedPubkey = decodePublicKey(npub);
console.log(`Decoded public key: ${decodedPubkey}`);
console.log(`Match: ${decodedPubkey === pubkey}`);
console.log();

// Encode note ID
const noteId = '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c';
const note = encodeNoteId(noteId);
console.log(`Note ID: ${noteId}`);
console.log(`Encoded note: ${note}`);
console.log();

// TLV encodings
console.log('=== TLV Encodings ===');

// Encode profile with relays
const profileData = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['wss://relay.nostr.org', 'wss://relay.damus.io']
};

const nprofile = encodeProfile(profileData);
console.log(`Profile data: ${JSON.stringify(profileData, null, 2)}`);
console.log(`Encoded nprofile: ${nprofile}`);

// Decode the nprofile
const decodedProfile = decodeProfile(nprofile);
console.log(`Decoded profile: ${JSON.stringify(decodedProfile, null, 2)}`);
console.log();

// Encode event with author and kind
const eventData = {
  id: '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d',
  relays: ['wss://relay.example.com'],
  author: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
  kind: 1
};

const nevent = encodeEvent(eventData);
console.log(`Event data: ${JSON.stringify(eventData, null, 2)}`);
console.log(`Encoded nevent: ${nevent}`);
console.log();

// Encode replaceable event address
const addressData = {
  identifier: 'profile',
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  kind: 0, // Profile metadata
  relays: ['wss://relay.example.com']
};

const naddr = encodeAddress(addressData);
console.log(`Address data: ${JSON.stringify(addressData, null, 2)}`);
console.log(`Encoded naddr: ${naddr}`);
console.log();

// Generic decode function
console.log('=== Generic Decode Function ===');

// Decode different formats
function testDecode(input: string) {
  try {
    const result = decode(input);
    console.log(`Decoded ${input}:`);
    console.log(`  Type: ${result.type}`);
    
    if (typeof result.data === 'string') {
      console.log(`  Data: ${result.data}`);
    } else {
      console.log(`  Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error decoding ${input}: ${errorMessage}`);
  }
  console.log();
}

testDecode(npub);    // Public key
testDecode(note);    // Note ID
testDecode(nprofile); // Profile
testDecode(nevent);   // Event
testDecode(naddr);    // Address

// Test error case
console.log('=== Error Handling ===');
try {
  console.log('Trying to decode invalid format:');
  decode('invalid_format');
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Error: ${errorMessage}`);
}

// Try the generic decode function
console.log("\nGeneric decode function:");
try {
  const decodedNpub = decode(npub);
  console.log(`Decoded npub: ${JSON.stringify(decodedNpub)}`);
  
  const decodedNote = decode(note);
  console.log(`Decoded note: ${JSON.stringify(decodedNote)}`);
  
  const decodedNprofile = decode(nprofile);
  console.log(`Decoded nprofile: ${JSON.stringify(decodedNprofile)}`);
  
  const decodedNevent = decode(nevent);
  console.log(`Decoded nevent: ${JSON.stringify(decodedNevent)}`);
  
  try {
    const decodedNaddr = decode(naddr);
    console.log(`Decoded naddr: ${JSON.stringify(decodedNaddr)}`);
  } catch (error) {
    console.error(`Error decoding naddr: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  
  // Test deprecated nrelay format (should show warnings but work)
  console.log("\nDeprecated nrelay format (expect warnings):");
  const relayData = {
    url: 'wss://relay.nostr.org'
  };
  const nrelay = encodeRelay(relayData);
  console.log(`Relay data: ${JSON.stringify(relayData)}`);
  console.log(`Encoded nrelay: ${nrelay}`);
  
  try {
    const decodedNrelay = decodeRelay(nrelay);
    console.log(`Decoded nrelay: ${JSON.stringify(decodedNrelay)}`);
    
    const genericDecoded = decode(nrelay);
    console.log(`Generic decode of nrelay: ${JSON.stringify(genericDecoded)}`);
  } catch (error) {
    console.error(`Error with nrelay: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  
} catch (error) {
  console.error(`Error with decode: ${error instanceof Error ? error.message : 'unknown error'}`);
}

console.log("\nDemo completed."); 