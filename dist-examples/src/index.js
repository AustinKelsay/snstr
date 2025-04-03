"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NIP46Method = exports.NostrRemoteSignerBunker = exports.NostrRemoteSignerClient = exports.SimpleNIP46Bunker = exports.SimpleNIP46Client = exports.Nip07Nostr = exports.decryptNip44WithExtension = exports.encryptNip44WithExtension = exports.decryptNip04WithExtension = exports.encryptNip04WithExtension = exports.signEventWithNip07 = exports.getNip07PublicKey = exports.hasNip07Support = exports.getRelaysFromNIP05 = exports.getPublicKeyFromNIP05 = exports.lookupNIP05 = exports.verifyNIP05 = exports.TLVType = exports.Prefix = exports.decodeAddress = exports.encodeAddress = exports.decodeEvent = exports.encodeEvent = exports.decodeProfile = exports.encodeProfile = exports.decodeNoteId = exports.encodeNoteId = exports.decodePrivateKey = exports.encodePrivateKey = exports.decodePublicKey = exports.encodePublicKey = exports.decode = exports.decodeBech32 = exports.encodeBech32 = exports.getNIP44SharedSecret = exports.generateNIP44Nonce = exports.decryptNIP44 = exports.encryptNIP44 = exports.getNIP04SharedSecret = exports.decryptNIP04 = exports.encryptNIP04 = exports.createEvent = exports.verifySignature = exports.signEvent = exports.getPublicKey = exports.generateKeypair = exports.Relay = exports.Nostr = void 0;
// Export client classes
var nostr_1 = require("./client/nostr");
Object.defineProperty(exports, "Nostr", { enumerable: true, get: function () { return nostr_1.Nostr; } });
var relay_1 = require("./client/relay");
Object.defineProperty(exports, "Relay", { enumerable: true, get: function () { return relay_1.Relay; } });
// Export types
__exportStar(require("./types/nostr"), exports);
// Export utilities
var crypto_1 = require("./utils/crypto");
Object.defineProperty(exports, "generateKeypair", { enumerable: true, get: function () { return crypto_1.generateKeypair; } });
Object.defineProperty(exports, "getPublicKey", { enumerable: true, get: function () { return crypto_1.getPublicKey; } });
Object.defineProperty(exports, "signEvent", { enumerable: true, get: function () { return crypto_1.signEvent; } });
Object.defineProperty(exports, "verifySignature", { enumerable: true, get: function () { return crypto_1.verifySignature; } });
var event_1 = require("./utils/event");
Object.defineProperty(exports, "createEvent", { enumerable: true, get: function () { return event_1.createEvent; } });
// Export NIP-04 utilities
var nip04_1 = require("./nip04");
Object.defineProperty(exports, "encryptNIP04", { enumerable: true, get: function () { return nip04_1.encrypt; } });
Object.defineProperty(exports, "decryptNIP04", { enumerable: true, get: function () { return nip04_1.decrypt; } });
Object.defineProperty(exports, "getNIP04SharedSecret", { enumerable: true, get: function () { return nip04_1.getSharedSecret; } });
// Export NIP-44 utilities
var nip44_1 = require("./nip44");
Object.defineProperty(exports, "encryptNIP44", { enumerable: true, get: function () { return nip44_1.encrypt; } });
Object.defineProperty(exports, "decryptNIP44", { enumerable: true, get: function () { return nip44_1.decrypt; } });
Object.defineProperty(exports, "generateNIP44Nonce", { enumerable: true, get: function () { return nip44_1.generateNonce; } });
Object.defineProperty(exports, "getNIP44SharedSecret", { enumerable: true, get: function () { return nip44_1.getSharedSecret; } });
// Export NIP-19 utilities
var nip19_1 = require("./nip19");
// Core encoding/decoding functions
Object.defineProperty(exports, "encodeBech32", { enumerable: true, get: function () { return nip19_1.encodeBech32; } });
Object.defineProperty(exports, "decodeBech32", { enumerable: true, get: function () { return nip19_1.decodeBech32; } });
Object.defineProperty(exports, "decode", { enumerable: true, get: function () { return nip19_1.decode; } });
// Public key (npub)
Object.defineProperty(exports, "encodePublicKey", { enumerable: true, get: function () { return nip19_1.encodePublicKey; } });
Object.defineProperty(exports, "decodePublicKey", { enumerable: true, get: function () { return nip19_1.decodePublicKey; } });
// Private key (nsec)
Object.defineProperty(exports, "encodePrivateKey", { enumerable: true, get: function () { return nip19_1.encodePrivateKey; } });
Object.defineProperty(exports, "decodePrivateKey", { enumerable: true, get: function () { return nip19_1.decodePrivateKey; } });
// Note ID (note)
Object.defineProperty(exports, "encodeNoteId", { enumerable: true, get: function () { return nip19_1.encodeNoteId; } });
Object.defineProperty(exports, "decodeNoteId", { enumerable: true, get: function () { return nip19_1.decodeNoteId; } });
// Profile (nprofile)
Object.defineProperty(exports, "encodeProfile", { enumerable: true, get: function () { return nip19_1.encodeProfile; } });
Object.defineProperty(exports, "decodeProfile", { enumerable: true, get: function () { return nip19_1.decodeProfile; } });
// Event (nevent)
Object.defineProperty(exports, "encodeEvent", { enumerable: true, get: function () { return nip19_1.encodeEvent; } });
Object.defineProperty(exports, "decodeEvent", { enumerable: true, get: function () { return nip19_1.decodeEvent; } });
// Address (naddr)
Object.defineProperty(exports, "encodeAddress", { enumerable: true, get: function () { return nip19_1.encodeAddress; } });
Object.defineProperty(exports, "decodeAddress", { enumerable: true, get: function () { return nip19_1.decodeAddress; } });
// Enums
Object.defineProperty(exports, "Prefix", { enumerable: true, get: function () { return nip19_1.Prefix; } });
Object.defineProperty(exports, "TLVType", { enumerable: true, get: function () { return nip19_1.TLVType; } });
// Export NIP-05 utilities
var nip05_1 = require("./nip05");
Object.defineProperty(exports, "verifyNIP05", { enumerable: true, get: function () { return nip05_1.verifyNIP05; } });
Object.defineProperty(exports, "lookupNIP05", { enumerable: true, get: function () { return nip05_1.lookupNIP05; } });
Object.defineProperty(exports, "getPublicKeyFromNIP05", { enumerable: true, get: function () { return nip05_1.getPublicKeyFromNIP05; } });
Object.defineProperty(exports, "getRelaysFromNIP05", { enumerable: true, get: function () { return nip05_1.getRelaysFromNIP05; } });
// Export NIP-07 utilities
var nip07_1 = require("./nip07");
Object.defineProperty(exports, "hasNip07Support", { enumerable: true, get: function () { return nip07_1.hasNip07Support; } });
Object.defineProperty(exports, "getNip07PublicKey", { enumerable: true, get: function () { return nip07_1.getPublicKey; } });
Object.defineProperty(exports, "signEventWithNip07", { enumerable: true, get: function () { return nip07_1.signEvent; } });
Object.defineProperty(exports, "encryptNip04WithExtension", { enumerable: true, get: function () { return nip07_1.encryptNip04; } });
Object.defineProperty(exports, "decryptNip04WithExtension", { enumerable: true, get: function () { return nip07_1.decryptNip04; } });
Object.defineProperty(exports, "encryptNip44WithExtension", { enumerable: true, get: function () { return nip07_1.encryptNip44; } });
Object.defineProperty(exports, "decryptNip44WithExtension", { enumerable: true, get: function () { return nip07_1.decryptNip44; } });
// Export NIP-07 adapter
var adapter_1 = require("./nip07/adapter");
Object.defineProperty(exports, "Nip07Nostr", { enumerable: true, get: function () { return adapter_1.Nip07Nostr; } });
// Export NIP-46 utilities
var index_1 = require("./nip46/index");
Object.defineProperty(exports, "SimpleNIP46Client", { enumerable: true, get: function () { return index_1.SimpleNIP46Client; } });
Object.defineProperty(exports, "SimpleNIP46Bunker", { enumerable: true, get: function () { return index_1.SimpleNIP46Bunker; } });
Object.defineProperty(exports, "NostrRemoteSignerClient", { enumerable: true, get: function () { return index_1.NostrRemoteSignerClient; } });
Object.defineProperty(exports, "NostrRemoteSignerBunker", { enumerable: true, get: function () { return index_1.NostrRemoteSignerBunker; } });
Object.defineProperty(exports, "NIP46Method", { enumerable: true, get: function () { return index_1.NIP46Method; } });
