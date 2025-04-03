"use strict";
/**
 * NIP-44 Debug with Official Vector
 *
 * This script manually verifies the simplest test vector from the NIP-44 official test vectors
 * to debug why MAC validation is failing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const nip44_1 = require("../../src/nip44");
// The simplest test vector from the official tests
const vector = {
    "sec1": "0000000000000000000000000000000000000000000000000000000000000001",
    "sec2": "0000000000000000000000000000000000000000000000000000000000000002",
    "conversation_key": "c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d",
    "nonce": "0000000000000000000000000000000000000000000000000000000000000001",
    "plaintext": "a",
    "payload": "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb"
};
// Helper function to get the public key for a given private key
function getPublicKeyHex(privateKeyHex) {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    const publicKey = secp256k1.getPublicKey(privateKeyHex, false); // Get uncompressed public key
    return Buffer.from(publicKey.slice(1, 33)).toString('hex'); // Return x-coordinate only
}
function hexToBytes(hex) {
    return Buffer.from(hex, 'hex');
}
function compareUint8Arrays(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
async function debug() {
    console.log('🔍 NIP-44 Debug with Official Vector');
    console.log('==================================\n');
    // Calculate public keys
    const pub1 = getPublicKeyHex(vector.sec1);
    const pub2 = getPublicKeyHex(vector.sec2);
    console.log(`pub1 (from sec1): ${pub1}`);
    console.log(`pub2 (from sec2): ${pub2}`);
    // Verify we can derive the correct shared secret
    const sharedSecret1 = (0, nip44_1.getSharedSecret)(vector.sec1, pub2);
    const sharedSecret1Hex = Buffer.from(sharedSecret1).toString('hex');
    console.log(`\nShared secret 1->2: ${sharedSecret1Hex}`);
    console.log(`Expected:           ${vector.conversation_key}`);
    console.log(`Matches expected:   ${sharedSecret1Hex === vector.conversation_key}`);
    // Decode the payload
    const decodedPayload = (0, nip44_1.decodePayload)(vector.payload);
    console.log(`\nDecoded payload:`);
    console.log(`- Version: ${decodedPayload.version}`);
    console.log(`- Nonce: ${Buffer.from(decodedPayload.nonce).toString('hex')}`);
    console.log(`- Ciphertext length: ${decodedPayload.ciphertext.length}`);
    console.log(`- MAC: ${Buffer.from(decodedPayload.mac).toString('hex')}`);
    // Check if nonce matches expected
    console.log(`\nNonce matches expected: ${Buffer.from(decodedPayload.nonce).toString('hex') === vector.nonce}`);
    // Get message keys
    const nonceBytes = hexToBytes(vector.nonce);
    const conversationKeyBytes = hexToBytes(vector.conversation_key);
    const keys = (0, nip44_1.getMessageKeys)(conversationKeyBytes, nonceBytes);
    console.log(`\nDerived message keys:`);
    console.log(`- chacha_key: ${Buffer.from(keys.chacha_key).toString('hex')}`);
    console.log(`- chacha_nonce: ${Buffer.from(keys.chacha_nonce).toString('hex')}`);
    console.log(`- hmac_key: ${Buffer.from(keys.hmac_key).toString('hex')}`);
    // Calculate MAC
    const calculatedMac = (0, nip44_1.hmacWithAAD)(keys.hmac_key, decodedPayload.ciphertext, decodedPayload.nonce);
    console.log(`\nCalculated MAC: ${Buffer.from(calculatedMac).toString('hex')}`);
    console.log(`Payload MAC:    ${Buffer.from(decodedPayload.mac).toString('hex')}`);
    console.log(`MACs match:     ${Buffer.from(calculatedMac).toString('hex') === Buffer.from(decodedPayload.mac).toString('hex')}`);
    // Let's try to decrypt with the official test vector's HMAC
    console.log('\nTrying to decrypt with the official vector...');
    try {
        const decrypted = (0, nip44_1.decrypt)(vector.payload, vector.sec2, pub1);
        console.log(`Successfully decrypted: "${decrypted}"`);
        console.log(`Matches expected plaintext: ${decrypted === vector.plaintext}`);
    }
    catch (error) {
        console.error('Decryption failed:', error instanceof Error ? error.message : error);
    }
    // Let's try our own encryption
    console.log('\nTesting our own encryption with the same keys...');
    const encrypted = (0, nip44_1.encrypt)(vector.plaintext, vector.sec1, pub2, hexToBytes(vector.nonce));
    console.log(`Our encrypted payload: ${encrypted}`);
    console.log(`Official payload:     ${vector.payload}`);
    console.log(`Payloads match:       ${encrypted === vector.payload}`);
    try {
        const decrypted = (0, nip44_1.decrypt)(encrypted, vector.sec2, pub1);
        console.log(`Our decrypt successful: "${decrypted}"`);
        console.log(`Matches plaintext: ${decrypted === vector.plaintext}`);
    }
    catch (error) {
        console.error('Our decryption failed:', error instanceof Error ? error.message : error);
    }
}
debug().catch(console.error);
