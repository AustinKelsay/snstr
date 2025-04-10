/**
 * NIP-19 Basic Demo
 * 
 * This file demonstrates the core functionality of NIP-19 (Bech32-Encoded Entities)
 * including both basic Bech32 encodings and TLV encodings.
 */

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
  decode
} from '../../src/nip19';

// Configuration
const verbose = process.env.VERBOSE === 'true';
function log(...args: any[]) {
  if (verbose) {
    console.log(...args);
  }
}

// Sample data
const SAMPLE_PUBKEY = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const SAMPLE_NOTEID = '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c';
const SAMPLE_RELAYS = ['wss://relay.nostr.org', 'wss://relay.damus.io'];

function runDemo() {
  console.log('=== NIP-19 Basic Demo ===\n');
  
  // Basic Bech32 Encodings
  demonstrateBasicEncodings();
  
  // TLV Encodings
  demonstrateTLVEncodings();
  
  // Generic Decode Function
  demonstrateGenericDecoding();
  
  // Error Handling
  demonstrateErrorHandling();
  
  console.log("\nNIP-19 Demo completed.");
}

function demonstrateBasicEncodings() {
  console.log('=== Basic Bech32 Encodings ===');

  // Encode/decode public key
  const npub = encodePublicKey(SAMPLE_PUBKEY);
  const decodedPubkey = decodePublicKey(npub);
  
  console.log(`Public Key: ${SAMPLE_PUBKEY}`);
  console.log(`Encoded npub: ${npub}`);
  console.log(`Decoded public key: ${decodedPubkey}`);
  console.log(`Match: ${decodedPubkey === SAMPLE_PUBKEY}`);
  console.log();

  // Encode/decode note ID
  const note = encodeNoteId(SAMPLE_NOTEID);
  const decodedNoteId = decodeNoteId(note);
  
  console.log(`Note ID: ${SAMPLE_NOTEID}`);
  console.log(`Encoded note: ${note}`);
  console.log(`Decoded note ID: ${decodedNoteId}`);
  console.log(`Match: ${decodedNoteId === SAMPLE_NOTEID}`);
  console.log();
}

function demonstrateTLVEncodings() {
  console.log('=== TLV Encodings ===');

  // Encode/decode profile with relays
  const profileData = {
    pubkey: SAMPLE_PUBKEY,
    relays: SAMPLE_RELAYS
  };

  const nprofile = encodeProfile(profileData);
  const decodedProfile = decodeProfile(nprofile);
  
  console.log(`Profile data: ${JSON.stringify(profileData, null, 2)}`);
  console.log(`Encoded nprofile: ${nprofile}`);
  console.log(`Decoded profile: ${JSON.stringify(decodedProfile, null, 2)}`);
  console.log();

  // Encode/decode event
  const eventData = {
    id: '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d',
    relays: ['wss://relay.example.com'],
    author: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
    kind: 1
  };

  const nevent = encodeEvent(eventData);
  const decodedEvent = decodeEvent(nevent);
  
  console.log(`Event data: ${JSON.stringify(eventData, null, 2)}`);
  console.log(`Encoded nevent: ${nevent}`);
  console.log(`Decoded event: ${JSON.stringify(decodedEvent, null, 2)}`);
  console.log();

  // Encode/decode replaceable event address
  const addressData = {
    identifier: 'profile',
    pubkey: SAMPLE_PUBKEY,
    kind: 0, // Profile metadata
    relays: ['wss://relay.example.com']
  };

  try {
    const naddr = encodeAddress(addressData);
    const decodedAddress = decodeAddress(naddr);
    
    console.log(`Address data: ${JSON.stringify(addressData, null, 2)}`);
    console.log(`Encoded naddr: ${naddr}`);
    console.log(`Decoded address: ${JSON.stringify(decodedAddress, null, 2)}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error with naddr: ${errorMessage}`);
    console.log(`Address data that caused the error: ${JSON.stringify(addressData, null, 2)}`);
  }
  console.log();
}

function demonstrateGenericDecoding() {
  console.log('=== Generic Decode Function ===');

  // Encode various entities
  const npub = encodePublicKey(SAMPLE_PUBKEY);
  const note = encodeNoteId(SAMPLE_NOTEID);
  const nprofile = encodeProfile({
    pubkey: SAMPLE_PUBKEY,
    relays: SAMPLE_RELAYS
  });

  // Decode different formats using the generic decode function
  function testDecode(input: string, label: string) {
    try {
      const result = decode(input);
      console.log(`Decoded ${label}:`);
      console.log(`  Type: ${result.type}`);
      
      if (typeof result.data === 'string') {
        console.log(`  Data: ${result.data}`);
      } else {
        console.log(`  Data: ${JSON.stringify(result.data, null, 2)}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error decoding ${label}: ${errorMessage}`);
    }
    console.log();
  }

  testDecode(npub, 'npub (Public key)');
  testDecode(note, 'note (Note ID)');
  testDecode(nprofile, 'nprofile (Profile with relays)');
}

function demonstrateErrorHandling() {
  console.log('=== Error Handling ===');
  
  // Test invalid format
  try {
    console.log('Trying to decode invalid format:');
    decode('invalid_format');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${errorMessage}`);
  }
  console.log();
  
  // Test invalid hex
  try {
    console.log('Trying to encode invalid hex:');
    encodePublicKey('not-a-valid-hex-string');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${errorMessage}`);
  }
  console.log();
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

// Export functions for potential import in other examples
export {
  runDemo,
  demonstrateBasicEncodings,
  demonstrateTLVEncodings,
  demonstrateGenericDecoding,
  demonstrateErrorHandling
}; 