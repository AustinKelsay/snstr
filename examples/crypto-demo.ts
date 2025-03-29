import { generateKeypair, encryptMessage, decryptMessage, getPublicKey, getSharedSecret } from '../src/utils/crypto';

/**
 * This example demonstrates the direct use of cryptographic functions
 * for Nostr, with a focus on NIP-04 encryption for direct messages.
 * 
 * NIP-04 uses ECDH (Elliptic Curve Diffie-Hellman) to create a shared secret
 * and AES-256-CBC for encrypting the message content.
 */
async function main() {
  console.log('===== Nostr Cryptography Demo =====\n');
  
  // Generate two keypairs (Alice and Bob)
  console.log('Generating keypairs...');
  const aliceKeypair = await generateKeypair();
  console.log('Alice:');
  console.log('  Private key:', aliceKeypair.privateKey);
  console.log('  Public key:', aliceKeypair.publicKey);
  
  const bobKeypair = await generateKeypair();
  console.log('\nBob:');
  console.log('  Private key:', bobKeypair.privateKey);
  console.log('  Public key:', bobKeypair.publicKey);
  
  // Demonstrate extracting public key from private key
  console.log('\nVerifying public key derivation:');
  const derivedPublicKey = getPublicKey(aliceKeypair.privateKey);
  console.log('  Derived public key matches:', derivedPublicKey === aliceKeypair.publicKey);
  
  // Demonstrate NIP-04 encryption/decryption
  console.log('\n===== NIP-04 Direct Message Encryption =====\n');
  
  const message = 'Hello Bob! This is a secret message that only you can read.';
  console.log('Original message:', message);
  
  // Alice encrypts a message for Bob
  console.log('\nAlice encrypts message for Bob...');
  const encryptedMessage = encryptMessage(
    message,
    aliceKeypair.privateKey,
    bobKeypair.publicKey
  );
  console.log('Encrypted format (NIP-04):', encryptedMessage);
  
  // Examine the parts of the encrypted message
  const [ciphertext, iv] = encryptedMessage.split('?iv=');
  console.log('  Ciphertext:', ciphertext);
  console.log('  IV:', iv);
  
  // Display information about the shared secret
  console.log('\nShared secret information:');
  console.log('  When Alice encrypts for Bob, she uses:');
  console.log('    - Her private key and Bob\'s public key');
  
  console.log('  When Bob decrypts from Alice, he uses:');
  console.log('    - His private key and Alice\'s public key');
  
  console.log('\nAlice and Bob derive the same shared secret:');
  const aliceSharedSecret = getSharedSecret(aliceKeypair.privateKey, bobKeypair.publicKey);
  const bobSharedSecret = getSharedSecret(bobKeypair.privateKey, aliceKeypair.publicKey);
  console.log('  Same shared secret:', Buffer.from(aliceSharedSecret).toString('hex') === 
                                        Buffer.from(bobSharedSecret).toString('hex'));
  
  // Bob decrypts the message from Alice
  console.log('\nBob decrypts message from Alice...');
  const decryptedMessage = decryptMessage(
    encryptedMessage,
    bobKeypair.privateKey,
    aliceKeypair.publicKey
  );
  console.log('Decrypted message:', decryptedMessage);
  console.log('Decryption successful:', decryptedMessage === message);
  
  // Demonstrate that only the intended recipient can decrypt
  console.log('\n===== Security Verification =====\n');
  
  // Create a third party (Eve)
  const eveKeypair = await generateKeypair();
  console.log('Eve (third party) tries to decrypt the message...');
  
  try {
    const eveDecryption = decryptMessage(
      encryptedMessage,
      eveKeypair.privateKey,
      aliceKeypair.publicKey
    );
    console.log('Eve\'s decryption attempt:', eveDecryption);
    console.log('Eve decrypted correctly:', eveDecryption === message);
  } catch (error) {
    console.log('Eve failed to decrypt properly (expected)');
  }
  
  console.log('\nDemo complete!');
}

main().catch(error => {
  console.error('Error in demo:', error);
}); 