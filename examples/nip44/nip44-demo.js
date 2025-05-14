// Import functions from the compiled library
const { 
    generateKeypair, 
    encryptNIP44, 
    decryptNIP44 
  } = require('../../dist/snstr');
  
  async function main() {
    console.log('🔒 NIP-44 Encryption Demo');
    console.log('====================\n');
    
    // Generate keypairs for Alice and Bob
    console.log('Generating keypairs for Alice and Bob...');
    const aliceKeypair = await generateKeypair();
    const bobKeypair = await generateKeypair();
    
    console.log(`Alice's public key: ${aliceKeypair.publicKey}`);
    console.log(`Bob's public key: ${bobKeypair.publicKey}\n`);
    
    // Messages to encrypt
    const messages = [
      'Hello Bob, this is a secret message!',
      'NIP-44 uses ChaCha20 + HMAC-SHA256 for better security!',
      '🔐 Special characters and emojis work too! こんにちは!',
      ' ',  // Minimum message size (1 byte)
    ];
    
    console.log('Encrypting and decrypting messages:');
    console.log('----------------------------------');
    
    for (const message of messages) {
      console.log(`\nOriginal message: "${message}"`);
      
      // Alice encrypts a message for Bob
      const encrypted = encryptNIP44(
        message,
        aliceKeypair.privateKey,
        bobKeypair.publicKey
      );
      console.log(`Encrypted (base64): ${encrypted}`);
      
      // Bob decrypts the message from Alice
      const decrypted = decryptNIP44(
        encrypted,
        bobKeypair.privateKey,
        aliceKeypair.publicKey
      );
      console.log(`Decrypted: "${decrypted}"`);
      console.log(`Successful decryption: ${message === decrypted}`);
    }
    
    // Demonstrate empty message handling
    console.log('\n\nDemonstrating minimum message length requirement:');
    console.log('----------------------------------------------');
    console.log('NIP-44 requires messages to be at least 1 byte in length.');
    console.log('Trying to encrypt an empty message:');
    
    try {
      encryptNIP44('', aliceKeypair.privateKey, bobKeypair.publicKey);
      console.log('ERROR: Empty message encryption succeeded when it should have failed!');
    } catch (error) {
      console.log(`Encryption failed as expected: ${error.message}`);
    }
    
    // Demonstrate decryption attempt by wrong person
    console.log('\n\nDemonstrating failed decryption:');
    console.log('--------------------------------');
    
    // Generate a keypair for Eve (the eavesdropper)
    const eveKeypair = await generateKeypair();
    console.log(`Eve's public key: ${eveKeypair.publicKey}\n`);
    
    const secretMessage = 'This message is only for Bob';
    console.log(`Original message: "${secretMessage}"`);
    
    const encryptedForBob = encryptNIP44(
      secretMessage,
      aliceKeypair.privateKey,
      bobKeypair.publicKey
    );
    console.log(`Encrypted (base64): ${encryptedForBob}`);
    
    try {
      // Eve tries to decrypt the message meant for Bob
      const eveDecrypted = decryptNIP44(
        encryptedForBob,
        eveKeypair.privateKey,
        aliceKeypair.publicKey
      );
      console.log(`Eve decrypted the message: "${eveDecrypted}" (This should not happen!)`);
    } catch (error) {
      console.log(`Eve failed to decrypt the message (expected)`);
    }
    
    // Demonstrate tampered message
    console.log('\n\nDemonstrating tampered message:');
    console.log('------------------------------');
    
    const originalMessage = 'Important financial information: send 1 BTC';
    console.log(`Original message: "${originalMessage}"`);
    
    const encryptedOriginal = encryptNIP44(
      originalMessage,
      aliceKeypair.privateKey,
      bobKeypair.publicKey
    );
    
    // Tamper with the encrypted message
    const tamperedEncrypted = encryptedOriginal.substring(0, encryptedOriginal.length - 5) + 'XXXXX';
    console.log(`Tampered ciphertext: ${tamperedEncrypted}`);
    
    try {
      const decryptedTampered = decryptNIP44(
        tamperedEncrypted,
        bobKeypair.privateKey,
        aliceKeypair.publicKey
      );
      console.log(`Decrypted tampered message: "${decryptedTampered}" (This should not happen!)`);
    } catch (error) {
      console.log('Decryption of tampered message failed (expected)');
    }
  }
  
  main().catch(console.error); 