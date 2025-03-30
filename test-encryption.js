const { generateKeypair, encryptMessage, decryptMessage, getPublicKey } = require('./src/utils/crypto');

/**
 * Simple test for NIP-04 encryption/decryption.
 * Run with: node test-encryption.js
 */
async function testEncryption() {
  console.log('Testing NIP-04 encryption/decryption...');
  
  // Generate keypairs for Alice and Bob
  const alicePrivateKey = '7b9d3f26146a9efbabfc58010f5b6d42d8b3654d68eb9909a216c7308f1ffaf3';
  const alicePublicKey = getPublicKey(alicePrivateKey);
  console.log('Alice Public Key:', alicePublicKey);
  
  const bobPrivateKey = '35f839ba6f1ea584ad32d1afbf5554cc13a51c2cdc39d750a4cc4c7e47dddd05';
  const bobPublicKey = getPublicKey(bobPrivateKey);
  console.log('Bob Public Key:', bobPublicKey);
  
  // Test message
  const originalMessage = 'Hello Bob! This is a secret message.';
  console.log('\nOriginal Message:', originalMessage);
  
  try {
    // Alice encrypts a message for Bob
    console.log('\nAlice encrypting message for Bob...');
    const encrypted = encryptMessage(originalMessage, alicePrivateKey, bobPublicKey);
    console.log('Encrypted:', encrypted);
    
    // Bob decrypts the message from Alice
    console.log('\nBob decrypting message from Alice...');
    const decrypted = decryptMessage(encrypted, bobPrivateKey, alicePublicKey);
    console.log('Decrypted:', decrypted);
    
    // Verification
    console.log('\nSuccessful?', originalMessage === decrypted);
  } catch (error) {
    console.error('Error during encryption/decryption:', error);
  }
}

testEncryption(); 