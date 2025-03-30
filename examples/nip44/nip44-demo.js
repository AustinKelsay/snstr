"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var src_1 = require("../src");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var aliceKeypair, bobKeypair, messages, _i, messages_1, message_1, encrypted_1, decrypted, eveKeypair, message, encrypted, decrypted, originalMessage, encryptedOriginal, tamperedEncrypted, decryptedTampered, shortMessage, longMessage, encryptedShort, encryptedLong;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🔒 NIP-44 Encryption Demo');
                    console.log('====================\n');
                    // Generate keypairs for Alice and Bob
                    console.log('Generating keypairs for Alice and Bob...');
                    return [4 /*yield*/, (0, src_1.generateKeypair)()];
                case 1:
                    aliceKeypair = _a.sent();
                    return [4 /*yield*/, (0, src_1.generateKeypair)()];
                case 2:
                    bobKeypair = _a.sent();
                    console.log("Alice's public key: ".concat(aliceKeypair.publicKey));
                    console.log("Bob's public key: ".concat(bobKeypair.publicKey, "\n"));
                    messages = [
                        'Hello Bob, this is a secret message!',
                        'NIP-44 uses ChaCha20 + HMAC-SHA256 for better security!',
                        '🔐 Special characters and emojis work too! こんにちは!',
                        ' ', // Minimum message size (1 byte)
                    ];
                    console.log('Encrypting and decrypting messages:');
                    console.log('----------------------------------');
                    for (_i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                        message_1 = messages_1[_i];
                        console.log("\nOriginal message: \"".concat(message_1, "\""));
                        encrypted_1 = (0, src_1.encryptNIP44)(message_1, aliceKeypair.privateKey, bobKeypair.publicKey);
                        console.log("Encrypted (base64): ".concat(encrypted_1));
                        decrypted = (0, src_1.decryptNIP44)(encrypted_1, bobKeypair.privateKey, aliceKeypair.publicKey);
                        console.log("Decrypted: \"".concat(decrypted, "\""));
                        console.log("Successful decryption: ".concat(message_1 === decrypted));
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
                            console.log("Encryption failed as expected: ".concat(error.message));
                        }
                        else {
                            console.log('Encryption failed as expected');
                        }
                    }
                    // Demonstrate failed decryption with wrong keys
                    console.log('\n\nDemonstrating failed decryption:');
                    console.log('--------------------------------');
                    return [4 /*yield*/, (0, src_1.generateKeypair)()];
                case 3:
                    eveKeypair = _a.sent();
                    console.log("Eve's public key: ".concat(eveKeypair.publicKey));
                    message = 'This message is only for Bob';
                    console.log("\nOriginal message: \"".concat(message, "\""));
                    encrypted = (0, src_1.encryptNIP44)(message, aliceKeypair.privateKey, bobKeypair.publicKey);
                    console.log("Encrypted (base64): ".concat(encrypted));
                    try {
                        decrypted = (0, src_1.decryptNIP44)(encrypted, eveKeypair.privateKey, aliceKeypair.publicKey);
                        console.log("Decrypted by Eve: \"".concat(decrypted, "\" (This should not happen!)"));
                    }
                    catch (error) {
                        console.log('Eve failed to decrypt the message (expected)');
                    }
                    // Demonstrate tampered message
                    console.log('\n\nDemonstrating tampered message:');
                    console.log('------------------------------');
                    originalMessage = 'Important financial information: send 1 BTC';
                    console.log("Original message: \"".concat(originalMessage, "\""));
                    encryptedOriginal = (0, src_1.encryptNIP44)(originalMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
                    tamperedEncrypted = encryptedOriginal.substring(0, encryptedOriginal.length - 5) + 'XXXXX';
                    console.log("Tampered ciphertext: ".concat(tamperedEncrypted));
                    try {
                        decryptedTampered = (0, src_1.decryptNIP44)(tamperedEncrypted, bobKeypair.privateKey, aliceKeypair.publicKey);
                        console.log("Decrypted tampered message: \"".concat(decryptedTampered, "\" (This should not happen!)"));
                    }
                    catch (error) {
                        console.log('Decryption of tampered message failed (expected)');
                    }
                    // Demonstrate the padding scheme
                    console.log('\n\nDemonstrating padding scheme:');
                    console.log('----------------------------');
                    shortMessage = 'Hi';
                    longMessage = 'This is a much longer message that will have different padding applied to it compared to the short message. The padding scheme helps conceal the exact length of messages.';
                    console.log("Short message (".concat(shortMessage.length, " chars): \"").concat(shortMessage, "\""));
                    console.log("Long message (".concat(longMessage.length, " chars): \"").concat(longMessage, "\""));
                    encryptedShort = (0, src_1.encryptNIP44)(shortMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
                    encryptedLong = (0, src_1.encryptNIP44)(longMessage, aliceKeypair.privateKey, bobKeypair.publicKey);
                    console.log("\nEncrypted short message length: ".concat(encryptedShort.length));
                    console.log("Encrypted long message length: ".concat(encryptedLong.length));
                    console.log('Note: The padding scheme makes short messages have a minimum encrypted size');
                    console.log('\n\nNIP-44 vs NIP-04:');
                    console.log('----------------');
                    console.log('1. NIP-44 uses ChaCha20 + HMAC-SHA256 instead of AES-CBC');
                    console.log('2. NIP-44 includes authentication (tamper resistance)');
                    console.log('3. NIP-44 has a version byte for future upgradability');
                    console.log('4. NIP-44 uses HKDF for key derivation');
                    console.log('5. NIP-44 uses padding to help conceal message length');
                    console.log('6. NIP-44 payload is versioned, allowing future encryption improvements');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
