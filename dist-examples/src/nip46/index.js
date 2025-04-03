"use strict";
/**
 * NIP-46 Remote Signing Protocol
 *
 * This implementation provides a way to manage private keys remotely
 * and sign events from different clients. The protocol establishes a secure
 * connection between clients and a "bunker" which holds the private keys.
 *
 * Reference: https://github.com/nostr-protocol/nips/blob/master/46.md
 *
 * Two implementations are provided:
 *
 * 1. NostrRemoteSignerClient/NostrRemoteSignerBunker:
 *    - Full-featured implementation with all NIP-46 capabilities
 *    - Supports auth challenges via URL
 *    - Handles permissions for specific event kinds
 *    - Supports both NIP-04 and NIP-44 encryption
 *    - Connection metadata for better UX
 *    - Secret token support for secure connections
 *
 * 2. SimpleNIP46Client/SimpleNIP46Bunker:
 *    - Simplified implementation for basic use cases
 *    - Minimal code with core functionality
 *    - NIP-04 encryption only
 *    - Basic permission handling
 *    - No auth challenges or metadata support
 *    - Good for learning and simple applications
 *
 * Choose the implementation that best fits your needs based on the complexity
 * and security requirements of your application.
 */
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
exports.createErrorResponse = exports.createSuccessResponse = exports.createRequest = exports.generateRequestId = exports.LogLevel = exports.Logger = exports.SimpleNIP46Bunker = exports.SimpleNIP46Client = exports.NostrRemoteSignerBunker = exports.NostrRemoteSignerClient = void 0;
// Export types
__exportStar(require("./types"), exports);
// Export client and bunker implementations
var client_1 = require("./client");
Object.defineProperty(exports, "NostrRemoteSignerClient", { enumerable: true, get: function () { return client_1.NostrRemoteSignerClient; } });
var bunker_1 = require("./bunker");
Object.defineProperty(exports, "NostrRemoteSignerBunker", { enumerable: true, get: function () { return bunker_1.NostrRemoteSignerBunker; } });
// Export simplified implementation
var simple_client_1 = require("./simple-client");
Object.defineProperty(exports, "SimpleNIP46Client", { enumerable: true, get: function () { return simple_client_1.SimpleNIP46Client; } });
var simple_bunker_1 = require("./simple-bunker");
Object.defineProperty(exports, "SimpleNIP46Bunker", { enumerable: true, get: function () { return simple_bunker_1.SimpleNIP46Bunker; } });
// Export utilities
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_1.LogLevel; } });
var request_response_1 = require("./utils/request-response");
Object.defineProperty(exports, "generateRequestId", { enumerable: true, get: function () { return request_response_1.generateRequestId; } });
Object.defineProperty(exports, "createRequest", { enumerable: true, get: function () { return request_response_1.createRequest; } });
Object.defineProperty(exports, "createSuccessResponse", { enumerable: true, get: function () { return request_response_1.createSuccessResponse; } });
Object.defineProperty(exports, "createErrorResponse", { enumerable: true, get: function () { return request_response_1.createErrorResponse; } });
