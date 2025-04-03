"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../src");
async function main() {
    console.log('🔒 NIP-44 Encryption Demo');
    console.log('====================\n');
    // Generate keypairs for Alice and Bob
    console.log('Generating keypairs for Alice and Bob...');
    const aliceKeypair = await (0, src_1.generateKeypair)();
    const bobKeypair = await (0, src_1.generateKeypair)();
    console.log(`Alice's public key: ${aliceKeypair.publicKey}`);
    console.log(`Bob's public key: ${bobKeypair.publicKey}\n`);
    // Messages to encrypt
    const messages = [
        'Hello Bob, this is a secret message!',
        'NIP-44 uses ChaCha20 + HMAC-SHA256 for better security!',
        '🔐 Special characters and emojis work too! こんにちは!',
        ' ', // Minimum message size (1 byte)
    ];
    console.log('Encrypting and decrypting messages:');
    console.log('----------------------------------');
    for (const message of messages) {
        console.log(`\nOriginal message: "${message}"`);
        // Alice encrypts a message for Bob
        const encrypted = (0, src_1.encryptNIP44)(message, aliceKeypair.privateKey, bobKeypair.publicKey);
        console.log(`Encrypted (base64): ${encrypted}`);
        // Bob decrypts the message from Alice
        const decrypted = (0, src_1.decryptNIP44)(encrypted, bobKeypair.privateKey, aliceKeypair.publicKey);
        console.log(`Decrypted: "${decrypted}"`);
        console.log(`Successful decryption: ${message === decrypted}`);
    }
    // Demonstrate the minimum message length requirement
    console.log('\n\nDemonstrating minimum message length requirement:');
    console.log('----------------------------------------------');
    console.log('NIP-44 requires messages to be at least 1 byte in length.');
    try {
        console.log('Trying to encrypt an empty message:');
        (0, src_1.encryptNIP44)('', // Empty message (0 bytes)
        aliceKeypair.privateKey, bobKeypair.publicKey);
        console.log('This should not happen - empty messages should be rejected');
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(`Encryption failed as expected: ${error.message}`);
        }
        else {
            console.log('Encryption failed as expected');
        }
    }
    // Demonstrate failed decryption with wrong keys
    console.log('\n\nDemonstrating failed decryption:');
    console.log('--------------------------------');
    // Generate a keypair for Eve (an eavesdropper)
    const eveKeypair = await (0, src_1.generateKeypair)();
    console.log(`Eve's public key: ${eveKeypair.publicKey}`);
    const message = 'This message is only for Bob';
    console.log(`\nOriginal message: "${message}"`);
    // Alice encrypts a message for Bob
    const encrypted = (0, src_1.encryptNIP44)(message, aliceKeypair.privateKey, bobKeypair.publicKey);
    console.log(`Encrypted (base64): ${encrypted}`);
    try {
        // Eve tries to decrypt the message using her key
        const decrypted = (0, src_1.decryptNIP44)(encrypted, eveKeypair.privateKey, aliceKeypair.publicKey);
        console.log(`Decrypted by Eve: "${decrypted}" (This should not happen!)`);
    }
    catch (error) {
        console.log('Eve failed to decrypt the message (expected)');
    }
    // Demonstrate tampered message
    console.log('\n\nDemonstrating tampered message:');
    console.log('------------------------------');
    const originalMessage = 'Important financial information: send 1 BTC';
    console.log(`Original message: "${originalMessage}"`);
    const encryptedOriginal = (0, src_1.encryptNIP44)(originalMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
    // Tamper with the encrypted message
    const tamperedEncrypted = encryptedOriginal.substring(0, encryptedOriginal.length - 5) + 'XXXXX';
    console.log(`Tampered ciphertext: ${tamperedEncrypted}`);
    try {
        const decryptedTampered = (0, src_1.decryptNIP44)(tamperedEncrypted, bobKeypair.privateKey, aliceKeypair.publicKey);
        console.log(`Decrypted tampered message: "${decryptedTampered}" (This should not happen!)`);
    }
    catch (error) {
        console.log('Decryption of tampered message failed (expected)');
    }
    // Demonstrate the padding scheme
    console.log('\n\nDemonstrating padding scheme:');
    console.log('----------------------------');
    const shortMessage = 'Hi';
    const longMessage = 'This is a much longer message that will have different padding applied to it compared to the short message. The padding scheme helps conceal the exact length of messages.';
    console.log(`Short message (${shortMessage.length} chars): "${shortMessage}"`);
    console.log(`Long message (${longMessage.length} chars): "${longMessage}"`);
    const encryptedShort = (0, src_1.encryptNIP44)(shortMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
    const encryptedLong = (0, src_1.encryptNIP44)(longMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
    console.log(`\nEncrypted short message length: ${encryptedShort.length}`);
    console.log(`Encrypted long message length: ${encryptedLong.length}`);
    console.log('Note: The padding scheme makes short messages have a minimum encrypted size');
    console.log('\n\nNIP-44 vs NIP-04:');
    console.log('----------------');
    console.log('1. NIP-44 uses ChaCha20 + HMAC-SHA256 instead of AES-CBC');
    console.log('2. NIP-44 includes authentication (tamper resistance)');
    console.log('3. NIP-44 has a version byte for future upgradability');
    console.log('4. NIP-44 uses HKDF for key derivation');
    console.log('5. NIP-44 uses padding to help conceal message length');
    console.log('6. NIP-44 payload is versioned, allowing future encryption improvements');
}
main().catch(console.error);
