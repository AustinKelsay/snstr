/**
 * NIP-19 Security Features Examples
 * 
 * This file specifically demonstrates the security features implemented in the NIP-19 module.
 * It shows how the library protects against common security issues and potential attacks.
 */

import {
  encodeProfile,
  encodeEvent,
  encodeAddress,
  decode,
  ProfileData,
  EventData,
  AddressData
} from '../../src/nip19';
const chalk = require('chalk');

/**
 * Security Example for NIP-19
 * 
 * This example demonstrates security features in the NIP-19 implementation:
 * 1. Relay URL validation during encoding
 * 2. TLV entry limits to prevent DoS attacks
 * 3. Size limits for URLs and identifiers
 * 4. Proper error handling
 */

// Constants defined locally (values based on codebase implementation)
const MAX_RELAYS = 100; // Max number of relays allowed
const MAX_TLV_ENTRIES = 100; // Max number of TLV entries
const MAX_RELAY_URL_LENGTH = 1024; // Max length for relay URLs
const MAX_IDENTIFIER_LENGTH = 1024; // Max length for identifiers

// Helper function to run and log a function with a try/catch
function tryExample(name: string, fn: () => any) {
  console.log(chalk.cyan(`\n=== ${name} ===`));
  try {
    const result = fn();
    console.log(chalk.green('✓ Success:'), result);
    return result;
  } catch (error: any) {
    console.log(chalk.red('✗ Error:'), error.message);
    return null;
  }
}

/**
 * Demonstrates protection against relay URL injection
 */
function demonstrateRelayURLProtection() {
  console.log('=== Relay URL Injection Protection ===');
  
  // Sample valid pubkey
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  // Potentially malicious relay URLs
  const maliciousURLs = [
    { type: 'JavaScript Protocol', url: 'javascript:alert("XSS")' },
    { type: 'Data URI', url: 'data:text/html,<script>alert("XSS")</script>' },
    { type: 'HTML Injection', url: 'wss://<script>alert("XSS")</script>.example.com' },
    { type: 'Protocol-relative URL', url: '//malicious-site.com' },
    { type: 'Local File Access', url: 'file:///etc/passwd' }
  ];
  
  console.log('Attempting to encode potentially malicious relay URLs:');
  
  maliciousURLs.forEach(({ type, url }) => {
    try {
      encodeProfile({
        pubkey,
        relays: [url]
      });
      console.error(`❌ Security issue: ${type} URL was accepted: ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✅ ${type} URL correctly rejected: "${url}" - ${message}`);
    }
  });
  
  console.log('\nThis protection prevents:');
  console.log('- Cross-site scripting (XSS) attacks through relay URLs');
  console.log('- Protocol confusion attacks');
  console.log('- Local file access attempts');
  console.log('- Other URL-based injection vectors');
}

/**
 * Demonstrates protection against resource exhaustion (DoS)
 */
function demonstrateDoSProtection() {
  console.log('\n=== Denial of Service Protection ===');
  
  // Sample valid data
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const eventId = '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d';
  
  // Test cases for DoS protection
  const dosTests = [
    { 
      name: 'Too many TLV entries (relays)', 
      test: () => {
        // Create 101 relays (exceeding MAX_TLV_ENTRIES limit of 100)
        const manyRelays = Array(101).fill(0).map((_, i) => `wss://relay${i}.example.com`);
        encodeProfile({ pubkey, relays: manyRelays });
      }
    },
    { 
      name: 'Overly long relay URL', 
      test: () => {
        // Create extremely long URL (exceeding MAX_RELAY_URL_LENGTH limit of 512)
        const longUrl = 'wss://' + 'a'.repeat(600) + '.example.com';
        encodeEvent({ id: eventId, relays: [longUrl] });
      }
    },
    { 
      name: 'Excessively long identifier', 
      test: () => {
        // Create extremely long identifier (exceeding MAX_IDENTIFIER_LENGTH limit of 1024)
        const longIdentifier = 'a'.repeat(2000);
        encodeAddress({ pubkey, kind: 30023, identifier: longIdentifier });
      }
    }
  ];
  
  console.log('Testing DoS protection mechanisms:');
  
  dosTests.forEach(({ name, test }) => {
    try {
      test();
      console.error(`❌ Security issue: ${name} - DoS protection failed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✅ ${name} correctly prevented: ${message}`);
    }
  });
  
  console.log('\nThis protection prevents:');
  console.log('- Resource exhaustion through excessive entries');
  console.log('- Memory issues from extremely long values');
  console.log('- Processing overhead from maliciously crafted inputs');
  console.log('- Application crashes due to oversized data');
}

/**
 * Demonstrates permissive decoding with warnings
 */
function demonstratePermissiveDecoding() {
  console.log('\n=== Permissive Decoding with Warnings ===');
  
  // Create a profile with valid pubkey but invalid relay URL
  // Note: We manually craft this since encodeProfile would reject the invalid URL
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  console.log('Important note about decoding behavior:');
  console.log('- The library follows the Nostr specification by being permissive during decoding');
  console.log('- Invalid relay URLs are accepted during decoding but generate warnings');
  console.log('- Applications should perform additional validation on decoded data');
  console.log('- This permissive behavior ensures compatibility with other implementations');
  
  // Create a valid profile to demonstrate proper decoding
  try {
    const validProfile = encodeProfile({
      pubkey,
      relays: ['wss://relay.example.com']
    });
    
    console.log('\nSuccessfully decoded valid profile:');
    const decoded = decode(validProfile);
    
    if (decoded.type === 'nprofile') {
      const profileData = decoded.data as ProfileData;
      console.log(`Pubkey: ${profileData.pubkey}`);
      console.log(`Relays: ${profileData.relays?.join(', ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error: ${message}`);
  }
}

/**
 * Demonstrates security best practices for working with NIP-19 entities
 */
function demonstrateSecurityBestPractices() {
  console.log('\n=== Security Best Practices ===');
  
  console.log('Follow these security practices when working with NIP-19 entities:');
  console.log('1. Always validate user input before encoding');
  console.log('   - Sanitize and validate all public keys, relay URLs, and identifiers');
  console.log('   - Use try/catch when calling encoding functions');
  
  console.log('\n2. Add extra validation for decoded data');
  console.log('   - The library is intentionally permissive during decoding');
  console.log('   - Add application-specific validation for security-sensitive contexts');
  console.log('   - Be especially careful with relay URLs from decoded entities');
  
  console.log('\n3. Respect the library\'s size limits');
  console.log('   - Don\'t try to bypass MAX_TLV_ENTRIES (100 entries)');
  console.log('   - Keep relay URLs under MAX_RELAY_URL_LENGTH (512 characters)');
  console.log('   - Keep identifiers under MAX_IDENTIFIER_LENGTH (1024 characters)');
  
  console.log('\n4. Handle private keys securely');
  console.log('   - Never log or expose nsec strings');
  console.log('   - Apply proper access controls when storing private keys');
  console.log('   - Consider hardware security or encryption for private key storage');
  
  console.log('\n5. Use type-specific functions when possible');
  console.log('   - Prefer encodePublicKey() over a generic encoder');
  console.log('   - This provides additional type safety and validation');
}

/**
 * Run all security examples
 */
function runSecurityExamples() {
  console.log('NIP-19 SECURITY FEATURES EXAMPLES\n');
  console.log('This example demonstrates the security features implemented in the NIP-19 module.');
  
  demonstrateRelayURLProtection();
  demonstrateDoSProtection();
  demonstratePermissiveDecoding();
  demonstrateSecurityBestPractices();
  
  console.log('\n=== End of Security Examples ===');
}

// Security Feature 1: Relay URL Validation
console.log(chalk.yellow('\n✦✦✦ SECURITY FEATURE: Relay URL Validation ✦✦✦'));

// Helper function for logging examples
const logExample = (title: string, callback: () => void) => {
  console.log(chalk.bold(`\n${title}:`));
  console.log(''.padStart(title.length + 1, '='));
  try {
    callback();
  } catch (error) {
    console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
  }
};

// Example 1: Relay URL Validation
logExample('Relay URL Validation Examples', () => {
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  console.log('Valid relay URLs:');
  const validUrls = ['wss://relay.damus.io', 'ws://localhost:8080'];
  const nprofile = encodeProfile({ pubkey, relays: validUrls });
  console.log(chalk.green(`- Encoded nprofile: ${nprofile}`));
  
  console.log('\nInvalid relay URLs (will throw errors):');
  const invalidUrls = [
    'http://example.com', // Wrong protocol
    'wss:/relay.com', // Malformed URL
    'ftp://example.com', // Invalid protocol
    'javascript:alert(1)', // Potential XSS
    'ws://relay example.com' // Contains space
  ];
  
  invalidUrls.forEach(url => {
    try {
      encodeProfile({ pubkey, relays: [url] });
      console.log(chalk.yellow(`- Should have rejected: ${url}`));
    } catch (error) {
      console.log(chalk.green(`- Correctly rejected URL "${url}": ${error instanceof Error ? error.message : String(error)}`));
    }
  });
});

// Example 2: TLV Entry Limits
logExample('TLV Entry Limits', () => {
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  // Create array with MAX_RELAYS + 1 entries
  const tooManyRelays = Array(MAX_RELAYS + 1).fill('wss://relay.example.com');
  
  try {
    encodeProfile({ pubkey, relays: tooManyRelays });
    console.log(chalk.yellow('- Should have thrown an error for too many relays'));
  } catch (error) {
    console.log(chalk.green(`- Correctly enforced relay limit: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  // Using valid number of relays
  const validRelayCount = Array(3).fill('wss://relay.example.com');
  const validProfile = encodeProfile({ pubkey, relays: validRelayCount });
  console.log(chalk.green(`- Valid profile with ${validRelayCount.length} relays: ${validProfile}`));
});

// Example 3: Size Limits for URLs and Identifiers
logExample('Size Limits for URLs and Identifiers', () => {
  const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  
  // Create extremely long relay URL
  const longUrl = `wss://relay.example.com/${'x'.repeat(MAX_RELAY_URL_LENGTH)}`;
  
  try {
    encodeProfile({ pubkey, relays: [longUrl] });
    console.log(chalk.yellow('- Should have thrown an error for URL too long'));
  } catch (error) {
    console.log(chalk.green(`- Correctly enforced URL length limit: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  // Long identifier for address
  const longIdentifier = 'a'.repeat(MAX_IDENTIFIER_LENGTH + 1);
  
  try {
    encodeAddress({ 
      pubkey, 
      kind: 1, 
      identifier: longIdentifier, 
      relays: ['wss://relay.example.com'] 
    });
    console.log(chalk.yellow('- Should have thrown an error for identifier too long'));
  } catch (error) {
    console.log(chalk.green(`- Correctly enforced identifier length limit: ${error instanceof Error ? error.message : String(error)}`));
  }
});

// Example 4: Proper Error Handling and Decoding
logExample('Error Handling and Decoding', () => {
  // Decode a valid nprofile
  console.log(chalk.blue('\n[VALID NPROFILE]'));
  try {
    const validNprofile = 'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p';
    const result = decode(validNprofile);
    console.log(chalk.green(`✓ Decoded successfully as: ${result.type}`));
    
    // Check if the result is an nprofile type
    if (result.type === 'nprofile') {
      // Safe to cast to ProfileData
      const profileData = result.data as ProfileData;
      console.log(chalk.green(`  Pubkey: ${profileData.pubkey}`));
      console.log(chalk.green(`  Relays: ${profileData.relays?.join(', ') || 'none'}`));
      
      // Attempt to tamper with the data
      console.log(chalk.yellow('\n[TAMPERING ATTEMPT]'));
      
      // Try to add a malicious relay URL
      const maliciousUrl = 'ws://malicious.com/<script>alert("XSS")</script>';
      try {
        const relays = profileData.relays ? [...profileData.relays] : [];
        relays.push(maliciousUrl);
        
        const tamperedData: ProfileData = {
          pubkey: profileData.pubkey,
          relays
        };
        
        const reEncoded = encodeProfile(tamperedData);
        console.log(chalk.red(`✗ Encoding succeeded with malicious relay: ${reEncoded}`));
      } catch (error) {
        console.log(chalk.green(`✓ Prevented malicious relay URL: ${error instanceof Error ? error.message : 'unknown error'}`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`✗ Failed to decode: ${error instanceof Error ? error.message : 'unknown error'}`));
  }
});

console.log(chalk.bold('\nSecurity Example Complete'));

// Run the examples
runSecurityExamples(); 