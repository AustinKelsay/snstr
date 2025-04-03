"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NIP46Method = void 0;
/**
 * Supported NIP-46 methods
 */
var NIP46Method;
(function (NIP46Method) {
    NIP46Method["CONNECT"] = "connect";
    NIP46Method["GET_PUBLIC_KEY"] = "get_public_key";
    NIP46Method["SIGN_EVENT"] = "sign_event";
    NIP46Method["PING"] = "ping";
    NIP46Method["NIP04_ENCRYPT"] = "nip04_encrypt";
    NIP46Method["NIP04_DECRYPT"] = "nip04_decrypt";
    NIP46Method["NIP44_ENCRYPT"] = "nip44_encrypt";
    NIP46Method["NIP44_DECRYPT"] = "nip44_decrypt";
})(NIP46Method || (exports.NIP46Method = NIP46Method = {}));
