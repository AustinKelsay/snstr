"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventHash = getEventHash;
exports.signEvent = signEvent;
exports.verifySignature = verifySignature;
exports.generateKeypair = generateKeypair;
exports.getPublicKey = getPublicKey;
exports.sha256 = sha256;
exports.sha256Hex = sha256Hex;
const secp256k1_1 = require("@noble/curves/secp256k1");
const utils_1 = require("@noble/hashes/utils");
const sha256_1 = require("@noble/hashes/sha256");
const crypto_1 = require("crypto");
async function sha256Hash(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
/**
 * Compute the event ID from the event data
 */
async function getEventHash(event) {
    const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
    ]);
    return await sha256Hash(serialized);
}
/**
 * Sign an event with the given private key
 */
async function signEvent(eventId, privateKey) {
    const privateKeyBytes = (0, utils_1.hexToBytes)(privateKey);
    const eventIdBytes = (0, utils_1.hexToBytes)(eventId);
    const signatureBytes = await secp256k1_1.schnorr.sign(eventIdBytes, privateKeyBytes);
    return (0, utils_1.bytesToHex)(signatureBytes);
}
/**
 * Verify the signature of an event
 */
async function verifySignature(eventId, signature, publicKey) {
    try {
        const eventIdBytes = (0, utils_1.hexToBytes)(eventId);
        const signatureBytes = (0, utils_1.hexToBytes)(signature);
        const publicKeyBytes = (0, utils_1.hexToBytes)(publicKey);
        return await secp256k1_1.schnorr.verify(signatureBytes, eventIdBytes, publicKeyBytes);
    }
    catch (error) {
        console.error('Failed to verify signature:', error);
        return false;
    }
}
/**
 * Generate a keypair for Nostr
 */
async function generateKeypair() {
    const privateKeyBytes = (0, utils_1.randomBytes)(32);
    const privateKey = (0, utils_1.bytesToHex)(privateKeyBytes);
    const publicKey = getPublicKey(privateKey);
    return { privateKey, publicKey };
}
/**
 * Get the public key from a private key
 */
function getPublicKey(privateKey) {
    const privateKeyBytes = (0, utils_1.hexToBytes)(privateKey);
    const publicKeyBytes = secp256k1_1.schnorr.getPublicKey(privateKeyBytes);
    return (0, utils_1.bytesToHex)(publicKeyBytes);
}
// NIP-04 functions have been moved to the dedicated module at src/nip04/index.ts
// For NIP-04 encryption/decryption, please import from '../nip04' instead 
function sha256(data) {
    if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
    }
    return (0, sha256_1.sha256)(data);
}
function sha256Hex(data) {
    return (0, utils_1.bytesToHex)(sha256(data));
}
