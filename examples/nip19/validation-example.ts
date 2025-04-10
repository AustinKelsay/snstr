/**
 * NIP-19 Validation and Error Handling Examples
 * 
 * This file demonstrates validation and error handling for NIP-19 entities,
 * covering common issues developers might encounter.
 */

import {
  encodePublicKey,
  encodePrivateKey,
  encodeNoteId,
  encodeProfile,
  encodeEvent,
  encodeAddress,
  decode
} from '../../src/nip19';

/**
 * Demonstrates hex string validation
 */
function demonstrateHexValidation() {
  console.log('=== Hex String Validation ===');
  
  const validHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const invalidHexCases = [
    { name: 'Wrong length', value: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa45' },
    { name: 'Non-hex characters', value: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459z' },
    { name: 'Empty string', value: '' },
    { name: 'Not a string', value: 12345 }
  ];
  
  // Valid case
  try {
    const npub = encodePublicKey(validHex);
    console.log(`✅ Successfully encoded valid hex: ${npub.substring(0, 20)}...`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Unexpected error with valid hex: ${errorMessage}`);
  }
  
  // Invalid cases
  console.log('\nInvalid hex cases:');
  invalidHexCases.forEach(({ name, value }: { name: string, value: any }) => {
    try {
      // @ts-ignore - purposely testing invalid input
      const encoded = encodePublicKey(value);
      console.error(`❌ Should have failed but passed: ${name}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates relay URL validation
 */
function demonstrateRelayValidation() {
  console.log('\n=== Relay URL Validation ===');
  
  const validRelays = [
    'wss://relay.nostr.info',
    'wss://relay.damus.io'
  ];
  
  const invalidRelays = [
    { name: 'Invalid protocol', relays: ['http://relay.nostr.info'] },
    { name: 'Missing protocol', relays: ['relay.nostr.info'] },
    { name: 'Invalid characters', relays: ['wss://relay.with spaces.com'] },
    { name: 'Empty URL', relays: [''] }
  ];
  
  // Valid case
  try {
    const nprofile = encodeProfile({
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
      relays: validRelays
    });
    console.log(`✅ Successfully encoded with valid relays: ${nprofile.substring(0, 20)}...`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Unexpected error with valid relays: ${errorMessage}`);
  }
  
  // Invalid cases
  console.log('\nInvalid relay cases:');
  invalidRelays.forEach(({ name, relays }: { name: string, relays: string[] }) => {
    try {
      const encoded = encodeProfile({
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: relays
      });
      console.log(`❓ ${name}: Might have passed depending on implementation strictness`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates required field validation
 */
function demonstrateRequiredFields() {
  console.log('\n=== Required Fields Validation ===');
  
  // naddr requires specific fields
  const requiredFieldCases = [
    { name: 'Missing pubkey', data: { kind: 30023, identifier: 'test' } },
    { name: 'Missing kind', data: { pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', identifier: 'test' } },
    { name: 'Missing identifier', data: { pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', kind: 30023 } }
  ];
  
  // Valid case
  try {
    const naddr = encodeAddress({
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
      kind: 30023,
      identifier: 'test-article'
    });
    console.log(`✅ Successfully encoded with all required fields: ${naddr.substring(0, 20)}...`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Unexpected error with valid fields: ${errorMessage}`);
  }
  
  // Invalid cases
  console.log('\nMissing required field cases:');
  requiredFieldCases.forEach(({ name, data }: { name: string, data: any }) => {
    try {
      // @ts-ignore - purposely testing invalid input
      const encoded = encodeAddress(data);
      console.error(`❌ Should have failed but passed: ${name}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates size limit validation
 */
function demonstrateSizeLimits() {
  console.log('\n=== Size Limit Validation ===');
  
  // Generate extremely long relay list
  const tooManyRelays = Array(1000).fill('wss://relay.example.com');
  
  // Very long identifier
  const veryLongIdentifier = 'a'.repeat(1000);
  
  const sizeLimitCases = [
    { name: 'Too many relays', test: () => {
      return encodeProfile({
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: tooManyRelays
      });
    }},
    { name: 'Very long identifier', test: () => {
      return encodeAddress({
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        kind: 30023,
        identifier: veryLongIdentifier
      });
    }}
  ];
  
  // Test size limits
  console.log('Size limit cases:');
  sizeLimitCases.forEach(({ name, test }: { name: string, test: () => string }) => {
    try {
      const encoded = test();
      console.log(`ℹ️ ${name}: Encoded successfully but resulted in a ${encoded.length} character string`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates handling of incorrect prefix
 */
function demonstrateIncorrectPrefix() {
  console.log('\n=== Incorrect Prefix Handling ===');
  
  // Create valid encodings
  const npub = encodePublicKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
  const note = encodeNoteId('6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c');
  
  // Try using wrong-type-specific functions
  console.log('Using type-specific decode with wrong type:');
  
  try {
    // @ts-ignore - purposely using wrong function
    const result = encodePrivateKey(npub);
    console.error('❌ Should have failed but passed: Trying to encode npub as private key');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`✅ Incorrect usage caught: ${errorMessage}`);
  }
  
  // Generic decode handles all prefixes correctly
  console.log('\nUsing generic decode with different prefixes:');
  try {
    const decodedNpub = decode(npub);
    console.log(`✅ Generic decode correctly identified: ${decodedNpub.type}`);
    
    const decodedNote = decode(note);
    console.log(`✅ Generic decode correctly identified: ${decodedNote.type}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Generic decode failed: ${errorMessage}`);
  }
}

/**
 * Demonstrates graceful error handling
 */
function demonstrateGracefulErrorHandling() {
  console.log('\n=== Graceful Error Handling ===');
  
  console.log('Example error handler for user input:');
  
  function safeEncode(input: string, type: string) {
    try {
      let encoded = '';
      
      switch (type) {
        case 'npub':
          encoded = encodePublicKey(input);
          break;
        case 'note':
          encoded = encodeNoteId(input);
          break;
        default:
          throw new Error(`Unsupported type: ${type}`);
      }
      
      return { success: true, result: encoded, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, result: null, error: errorMessage };
    }
  }
  
  // Valid input
  const validResult = safeEncode('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', 'npub');
  console.log(`Valid input: ${JSON.stringify(validResult)}`);
  
  // Invalid input
  const invalidResult = safeEncode('not-hex', 'npub');
  console.log(`Invalid input: ${JSON.stringify(invalidResult)}`);
  
  // Invalid type
  const invalidTypeResult = safeEncode('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', 'invalid');
  console.log(`Invalid type: ${JSON.stringify(invalidTypeResult)}`);
}

/**
 * Main function that runs all demonstrations
 */
function runValidationExamples() {
  console.log('=== NIP-19 Validation and Error Handling Examples ===\n');
  
  demonstrateHexValidation();
  demonstrateRelayValidation();
  demonstrateRequiredFields();
  demonstrateSizeLimits();
  demonstrateIncorrectPrefix();
  demonstrateGracefulErrorHandling();
  
  console.log('\nNIP-19 Validation Examples completed.\n');
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runValidationExamples();
}

// Export functions for potential import in other examples
export {
  runValidationExamples,
  demonstrateHexValidation,
  demonstrateRelayValidation,
  demonstrateRequiredFields,
  demonstrateSizeLimits,
  demonstrateIncorrectPrefix,
  demonstrateGracefulErrorHandling
}; 