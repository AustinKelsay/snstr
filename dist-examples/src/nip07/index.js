"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptNip44 = exports.encryptNip44 = exports.decryptNip04 = exports.encryptNip04 = exports.signEvent = exports.getPublicKey = exports.hasNip07Support = void 0;
/**
 * Checks if the browser has the NIP-07 extension available
 */
const hasNip07Support = () => {
    return typeof window !== 'undefined' && !!window.nostr;
};
exports.hasNip07Support = hasNip07Support;
/**
 * Gets the public key from the NIP-07 extension
 * @returns The public key in hex format
 * @throws Error if NIP-07 is not supported or fails
 */
const getPublicKey = async () => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    try {
        return await window.nostr.getPublicKey();
    }
    catch (error) {
        throw new Error(`Failed to get public key from NIP-07 extension: ${error}`);
    }
};
exports.getPublicKey = getPublicKey;
/**
 * Signs an event using the NIP-07 extension
 * @param event Event to sign (without id, pubkey, sig)
 * @returns Signed event with id, pubkey, and sig fields added
 * @throws Error if NIP-07 is not supported or fails
 */
const signEvent = async (event) => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    try {
        return await window.nostr.signEvent(event);
    }
    catch (error) {
        throw new Error(`Failed to sign event with NIP-07 extension: ${error}`);
    }
};
exports.signEvent = signEvent;
/**
 * Encrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
const encryptNip04 = async (pubkey, plaintext) => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    if (!window.nostr?.nip04?.encrypt) {
        throw new Error('NIP-04 encryption not supported by the extension');
    }
    try {
        return await window.nostr.nip04.encrypt(pubkey, plaintext);
    }
    catch (error) {
        throw new Error(`Failed to encrypt message with NIP-04: ${error}`);
    }
};
exports.encryptNip04 = encryptNip04;
/**
 * Decrypts a message using NIP-04 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-04, or fails
 */
const decryptNip04 = async (pubkey, ciphertext) => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    if (!window.nostr?.nip04?.decrypt) {
        throw new Error('NIP-04 decryption not supported by the extension');
    }
    try {
        return await window.nostr.nip04.decrypt(pubkey, ciphertext);
    }
    catch (error) {
        throw new Error(`Failed to decrypt message with NIP-04: ${error}`);
    }
};
exports.decryptNip04 = decryptNip04;
/**
 * Encrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Recipient's public key
 * @param plaintext Message to encrypt
 * @returns Encrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
const encryptNip44 = async (pubkey, plaintext) => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    if (!window.nostr?.nip44?.encrypt) {
        throw new Error('NIP-44 encryption not supported by the extension');
    }
    try {
        return await window.nostr.nip44.encrypt(pubkey, plaintext);
    }
    catch (error) {
        throw new Error(`Failed to encrypt message with NIP-44: ${error}`);
    }
};
exports.encryptNip44 = encryptNip44;
/**
 * Decrypts a message using NIP-44 via the NIP-07 extension
 * @param pubkey Sender's public key
 * @param ciphertext Encrypted message
 * @returns Decrypted message
 * @throws Error if NIP-07 is not supported, doesn't implement NIP-44, or fails
 */
const decryptNip44 = async (pubkey, ciphertext) => {
    if (!(0, exports.hasNip07Support)()) {
        throw new Error('NIP-07 extension not available');
    }
    if (!window.nostr?.nip44?.decrypt) {
        throw new Error('NIP-44 decryption not supported by the extension');
    }
    try {
        return await window.nostr.nip44.decrypt(pubkey, ciphertext);
    }
    catch (error) {
        throw new Error(`Failed to decrypt message with NIP-44: ${error}`);
    }
};
exports.decryptNip44 = decryptNip44;
