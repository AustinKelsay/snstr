/**
 * NIP-19 Comprehensive Demo
 * 
 * This file demonstrates the complete functionality of NIP-19, including:
 * - Basic Bech32 encoding/decoding (npub, nsec, note)
 * - TLV encoding/decoding (nprofile, nevent, naddr)
 * - Validation and error handling
 * - Common usage patterns and best practices
 */

import {
  // Basic Bech32 encoders
  encodePublicKey,
  encodePrivateKey,
  encodeNoteId,
  
  // TLV encoders
  encodeProfile,
  encodeEvent,
  encodeAddress,
  
  // TLV decoders
  decodeProfile,
  decodeEvent,
  decodeAddress,
  
  // Generic decoder
  decode
} from '../../src/nip19';

/**
 * Helper validation functions
 */
function validatePublicKey(pubkey: string): boolean {
  // Public keys should be 64 hex characters (32 bytes)
  return /^[0-9a-f]{64}$/.test(pubkey);
}

function validatePrivateKey(privkey: string): boolean {
  // Private keys should be 64 hex characters (32 bytes)
  return /^[0-9a-f]{64}$/.test(privkey);
}

function validateEventId(eventId: string): boolean {
  // Event IDs should be 64 hex characters (32 bytes)
  return /^[0-9a-f]{64}$/.test(eventId);
}

/**
 * Separates output sections with a header
 */
function printSection(title: string) {
  console.log('\n' + '='.repeat(50));
  console.log(`${title}`);
  console.log('='.repeat(50));
}

/**
 * PART 1: Bech32 Basic Encoding/Decoding
 * Demonstrates encoding and decoding of basic Nostr entities
 */
function demonstrateBasicEncoding() {
  printSection('PART 1: Basic Bech32 Encoding/Decoding');
  
  // Public Key (npub)
  console.log('📋 PUBLIC KEY ENCODING:');
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  try {
    // Always validate inputs before encoding
    if (!validatePublicKey(pubkey)) {
      throw new Error('Invalid public key format');
    }
    
    const npub = encodePublicKey(pubkey);
    console.log(`Hex:  ${pubkey}`);
    console.log(`Npub: ${npub}`);
    
    // Decode back to verify roundtrip
    const decoded = decode(npub);
    console.log(`Decoded type: ${decoded.type}`);
    console.log(`Decoded data: ${decoded.data}`);
    console.log(`Roundtrip successful: ${decoded.data === pubkey}`);
  } catch (error) {
    console.error(`Error encoding public key: ${(error as Error).message}`);
  }
  
  // Private Key (nsec)
  console.log('\n📋 PRIVATE KEY ENCODING:');
  const privkey = 'd55f1f2d59c62fb6fa5b1d88adf3e9aad291d63f9d0fcef6b5c8139a400f3dd6';
  
  try {
    // Always validate inputs before encoding
    if (!validatePrivateKey(privkey)) {
      throw new Error('Invalid private key format');
    }
    
    const nsec = encodePrivateKey(privkey);
    console.log(`Hex:  ${privkey}`);
    console.log(`Nsec: ${nsec}`);
    
    // Security warning
    console.log('\n⚠️ SECURITY WARNING: Never share your nsec with anyone!');
    console.log('Private keys should be kept secure and not exposed in applications.');
  } catch (error) {
    console.error(`Error encoding private key: ${(error as Error).message}`);
  }
  
  // Note ID (note)
  console.log('\n📋 NOTE ID ENCODING:');
  const noteId = '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c';
  
  try {
    // Always validate inputs before encoding
    if (!validateEventId(noteId)) {
      throw new Error('Invalid note ID format');
    }
    
    const note = encodeNoteId(noteId);
    console.log(`Hex:  ${noteId}`);
    console.log(`Note: ${note}`);
    
    // Decode back to verify roundtrip
    const decoded = decode(note);
    console.log(`Decoded type: ${decoded.type}`);
    console.log(`Decoded data: ${decoded.data}`);
    console.log(`Roundtrip successful: ${decoded.data === noteId}`);
  } catch (error) {
    console.error(`Error encoding note ID: ${(error as Error).message}`);
  }
}

/**
 * PART 2: TLV Encoding/Decoding
 * Demonstrates encoding and decoding of complex Nostr entities
 */
function demonstrateTLVEncoding() {
  printSection('PART 2: TLV Encoding/Decoding');
  
  // Profile (nprofile)
  console.log('📋 PROFILE ENCODING:');
  const profileData = {
    pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol'
    ]
  };
  
  try {
    const nprofile = encodeProfile(profileData);
    console.log(`Nprofile: ${nprofile}`);
    
    // Decode back to verify
    const decoded = decodeProfile(nprofile);
    console.log('\nDecoded profile data:');
    console.log(`Pubkey: ${decoded.pubkey}`);
    console.log('Relays:');
    if (decoded.relays && decoded.relays.length > 0) {
      decoded.relays.forEach(relay => console.log(`- ${relay}`));
    } else {
      console.log('(No relays included)');
    }
  } catch (error) {
    console.error(`Error encoding profile: ${(error as Error).message}`);
  }
  
  // Event (nevent)
  console.log('\n📋 EVENT ENCODING:');
  const eventData = {
    id: '6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c',
    relays: ['wss://relay.nostr.info'],
    author: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    kind: 1
  };
  
  try {
    const nevent = encodeEvent(eventData);
    console.log(`Nevent: ${nevent}`);
    
    // Decode back to verify
    const decoded = decodeEvent(nevent);
    console.log('\nDecoded event data:');
    console.log(`ID: ${decoded.id}`);
    console.log(`Author: ${decoded.author || '(Not included)'}`);
    console.log(`Kind: ${decoded.kind || '(Not included)'}`);
    console.log('Relays:');
    if (decoded.relays && decoded.relays.length > 0) {
      decoded.relays.forEach(relay => console.log(`- ${relay}`));
    } else {
      console.log('(No relays included)');
    }
  } catch (error) {
    console.error(`Error encoding event: ${(error as Error).message}`);
  }
  
  // Address (naddr)
  console.log('\n📋 ADDRESS ENCODING:');
  const addressData = {
    pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    kind: 30023,
    identifier: 'comprehensive-guide-to-nip19',
    relays: ['wss://relay.damus.io']
  };
  
  try {
    const naddr = encodeAddress(addressData);
    console.log(`Naddr: ${naddr}`);
    
    // Decode back to verify
    const decoded = decodeAddress(naddr);
    console.log('\nDecoded address data:');
    console.log(`Pubkey: ${decoded.pubkey}`);
    console.log(`Kind: ${decoded.kind}`);
    console.log(`Identifier: ${decoded.identifier}`);
    console.log('Relays:');
    if (decoded.relays && decoded.relays.length > 0) {
      decoded.relays.forEach(relay => console.log(`- ${relay}`));
    } else {
      console.log('(No relays included)');
    }
  } catch (error) {
    console.error(`Error encoding address: ${(error as Error).message}`);
  }
}

/**
 * PART 3: Error Handling and Validation
 * Demonstrates proper error handling and validation techniques
 */
function demonstrateErrorHandling() {
  printSection('PART 3: Error Handling and Validation');
  
  // Invalid public key (wrong length)
  console.log('📋 HANDLING INVALID PUBLIC KEY:');
  const invalidPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa45'; // too short
  
  try {
    if (!validatePublicKey(invalidPubkey)) {
      throw new Error('Invalid public key format');
    }
    const npub = encodePublicKey(invalidPubkey);
    console.log(`Encoded: ${npub}`);
  } catch (error) {
    console.error(`✓ Caught error: ${(error as Error).message}`);
  }
  
  // Invalid Bech32 string
  console.log('\n📋 HANDLING INVALID BECH32 STRING:');
  const invalidBech32 = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; // invalid checksum
  
  try {
    const decoded = decode(invalidBech32);
    console.log(`Decoded: ${JSON.stringify(decoded)}`);
  } catch (error) {
    console.error(`✓ Caught error: ${(error as Error).message}`);
  }
  
  // Missing required fields in TLV
  console.log('\n📋 HANDLING MISSING REQUIRED FIELDS:');
  const incompleteProfile = {
    // Missing pubkey, which is required
    relays: ['wss://relay.damus.io']
  };
  
  try {
    // @ts-ignore - intentionally passing invalid data for demonstration
    const nprofile = encodeProfile(incompleteProfile);
    console.log(`Encoded: ${nprofile}`);
  } catch (error) {
    console.error(`✓ Caught error: ${(error as Error).message}`);
  }
}

/**
 * PART 4: Real-world Usage Examples
 * Demonstrates how to use NIP-19 in real applications
 */
function demonstrateRealWorldUsage() {
  printSection('PART 4: Real-world Usage Examples');
  
  // Example 1: Sharing a profile
  console.log('📋 EXAMPLE: SHARING A PROFILE');
  
  const profileData = {
    pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    relays: [
      'wss://relay.damus.io',
      'wss://relay.nostr.info',
      'wss://nos.lol'
    ]
  };
  
  try {
    // Encode as nprofile for sharing
    const nprofile = encodeProfile(profileData);
    
    console.log('User Interface Example:');
    console.log('---------------------');
    console.log('✅ Profile successfully generated!');
    console.log('Share this link with friends:');
    console.log(`https://nostr.com/profile/${nprofile}`);
    console.log('\nOr scan this code:');
    console.log('[QR code would be generated here]');
  } catch (error) {
    console.error(`Error creating shareable profile: ${(error as Error).message}`);
  }
  
  // Example 2: Processing user input
  console.log('\n📋 EXAMPLE: PROCESSING USER INPUT');
  
  const userInputs = [
    'npub1937dhu0k878h5jyc6wyjtfg97x2ravl3cn9j7cmwhnuefmkygdmqlwm5w6',
    'note1pst25fn4grsmmuvwh9jdueesj4m5m9v4j5ygwj0qfj4ushefucgqd0ztrg',
    'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p'
  ];
  
  userInputs.forEach(input => {
    console.log(`\nProcessing: ${input}`);
    
    try {
      // Generic decode handles any type
      const decoded = decode(input);
      
      console.log(`Decoded type: ${decoded.type}`);
      
      // Handle different entity types appropriately
      switch (decoded.type) {
        case 'npub':
          console.log(`✓ Valid public key: ${decoded.data}`);
          console.log('Action: Navigate to user profile');
          break;
          
        case 'note':
          console.log(`✓ Valid note ID: ${decoded.data}`);
          console.log('Action: Fetch and display the note');
          break;
          
        case 'nprofile': {
          const profileData = decoded.data as any;
          console.log(`✓ Valid profile: ${JSON.stringify(profileData)}`);
          console.log(`Public key: ${profileData.pubkey}`);
          console.log(`Suggested relays: ${profileData.relays?.join(', ') || 'None'}`);
          console.log('Action: Navigate to user profile and connect to suggested relays');
          break;
        }
          
        default:
          console.log(`Entity type ${decoded.type} not handled in this example`);
      }
    } catch (error) {
      console.error(`Invalid input: ${(error as Error).message}`);
      console.log('Action: Show error message to user');
    }
  });
}

/**
 * Main function that runs all demonstrations
 */
function runNIP19Demo() {
  console.log('🔐 NIP-19 COMPREHENSIVE DEMO 🔐');
  
  demonstrateBasicEncoding();
  demonstrateTLVEncoding();
  demonstrateErrorHandling();
  demonstrateRealWorldUsage();
  
  printSection('Demo Complete');
  console.log('This demo has shown:');
  console.log('1. Basic Bech32 encoding and decoding');
  console.log('2. TLV encoding and decoding for complex entities');
  console.log('3. Proper error handling and validation');
  console.log('4. Real-world usage examples and best practices');
  console.log('\nTo learn more, check out the NIP-19 specification:');
  console.log('https://github.com/nostr-protocol/nips/blob/master/19.md');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runNIP19Demo();
}

// Export functions for potential import in other examples
export {
  runNIP19Demo,
  demonstrateBasicEncoding,
  demonstrateTLVEncoding,
  demonstrateErrorHandling,
  demonstrateRealWorldUsage
}; 