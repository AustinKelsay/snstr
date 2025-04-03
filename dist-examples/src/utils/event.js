"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventHash = getEventHash;
exports.createEvent = createEvent;
exports.createSignedEvent = createSignedEvent;
exports.createTextNote = createTextNote;
exports.createDirectMessage = createDirectMessage;
exports.createMetadataEvent = createMetadataEvent;
const nip04_1 = require("../nip04");
const crypto_1 = require("crypto");
const secp256k1_1 = require("@noble/curves/secp256k1");
const utils_1 = require("@noble/hashes/utils");
const crypto_2 = require("./crypto");
const crypto_3 = require("./crypto");
async function sha256Hash(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
async function getEventHash(event) {
    const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
    ]);
    return (0, crypto_2.sha256Hex)(serialized);
}
async function signEvent(event, privateKey) {
    const signatureBytes = await secp256k1_1.schnorr.sign((0, utils_1.hexToBytes)(event.id), (0, utils_1.hexToBytes)(privateKey));
    const signature = (0, utils_1.bytesToHex)(signatureBytes);
    return {
        ...event,
        sig: signature
    };
}
/**
 * Create an unsigned event from a template
 */
function createEvent(template, pubkey) {
    return {
        pubkey,
        created_at: template.created_at || Math.floor(Date.now() / 1000),
        kind: template.kind,
        tags: template.tags || [],
        content: template.content,
    };
}
/**
 * Create and sign an event
 */
async function createSignedEvent(event, privateKey) {
    const id = await getEventHash(event);
    const sig = await (0, crypto_3.signEvent)(id, privateKey);
    return {
        ...event,
        id,
        sig
    };
}
/**
 * Create a text note event (kind 1)
 */
function createTextNote(content, tags = []) {
    return {
        pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags,
        content
    };
}
/**
 * Create a direct message event (kind 4)
 * Encrypts the content using NIP-04 specification
 */
function createDirectMessage(content, recipientPubkey, privateKey, tags = []) {
    // Encrypt the content using NIP-04
    const encryptedContent = (0, nip04_1.encrypt)(content, privateKey, recipientPubkey);
    return {
        pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', recipientPubkey], ...tags],
        content: encryptedContent
    };
}
/**
 * Create a metadata event (kind 0)
 */
function createMetadataEvent(metadata, privateKey) {
    return {
        pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: JSON.stringify(metadata)
    };
}
