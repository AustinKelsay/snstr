# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.6] - 2025-11-11

### Fixed
- NIP-57: export `parseBolt11Invoice` from both the package root and the web/React-Native entry, resolving import errors for browser/RN consumers.

### Added
- Tests: export-parity tests to ensure `parseBolt11Invoice` stays available from both entries.

### Docs
- README: correct example to use `generateKeypair` (the root helper) instead of the `Nostr` instance method `generateKeys`.
- NIP standardization doc: include `parseBolt11Invoice` in the documented exports.

## [0.1.5] - 2025-11-06

### Added
- **WebSocket abstraction layer** for improved compatibility and testing
  - Dynamic WebSocket implementation resolution with feature-based detection
  - In-memory WebSocket implementation for sandboxed test environments
  - WebSocket implementation resolution utilities (`hasRequiredWebSocketFeatures`, `resolveDefaultWebSocket`)
- **Relay info management utilities** (NIP-11)
  - `useFetchImplementation` for custom fetch implementations
  - `clearRelayInfoCache` for cache management
  - `getRelayInfo` alias exported
- **Security filtering helpers** (NIP-19)
  - `filterProfile`, `filterEvent`, `filterAddress`, `filterEntity` utilities
  - `isValidRelayUrl` validation helper
  - Additional security-related types exported

### Changed
- **Jest setup migrated to TypeScript** (`jest.setup.js` → `jest.setup.ts`)
  - Improved test environment initialization
  - Enhanced test WebSocket wiring
  - Better console spy/restoration handling
- **Relay implementation** (NIP-01)
  - Added `WebSocketLike` abstraction for flexible WebSocket support
  - Support for both native and in-memory WebSocket transports
  - Per-subscription pending validation counters
  - Async validation flow with deferred EOSE finalization
  - Unified socket event wiring for both transports
- **Ephemeral relay server** updates
  - Dual startup paths for real vs in-memory server
  - Improved permission-error fallback handling
  - Enhanced lifecycle and cleanup management

### Fixed
- Dynamic WebSocket implementation selection with safer fallback behavior
- Improved error signaling in WebSocket implementation resolution

## [0.1.2] - 2025-08-16

### Fixed
- **CRITICAL**: Fixed module resolution error in published package
  - Removed redundant root `index.ts` file that was causing incorrect build output
  - Fixed TypeScript `rootDir` configuration from `".."` to `"./"`
  - Updated package.json entry points to correct paths (`dist/src/index.js`)
  - This fixes the "Module not found: Can't resolve './src/index'" error in v0.1.1

## [0.1.1] - 2025-08-07

### Added
- Beta release status
- Comprehensive release documentation

### Changed
- Updated project name to "Secure Nostr Software Toolkit for Renegades"
- Improved warning messages from alpha to beta status
- Renamed `initializeCrypto` export to `initializeNIP17Crypto` for clarity

### Deprecated
- `initializeCrypto` export - use `initializeNIP17Crypto` instead (backward compatibility alias provided)

### Known Issues
- Module resolution error when importing package - fixed in v0.1.2

## [0.1.0] - 2025-07-01

### Added
- Initial beta release
- Support for 20+ NIPs (Nostr Implementation Possibilities)
- Core features:
  - Event creation and signing
  - Relay connections with automatic reconnect
  - RelayPool for multi-relay management
  - Cross-relay event querying
  - Rate limiting support
- Advanced features:
  - Encrypted messaging (NIP-04, NIP-44)
  - Identity verification (NIP-05)
  - Browser extension integration (NIP-07)
  - Remote signing (NIP-46)
  - Lightning Zaps (NIP-57)
  - Wallet Connect (NIP-47)
- Comprehensive test suite
- Extensive examples for all features
- Full TypeScript support

### Security
- Input validation across all components
- Secure key generation
- URL validation and filtering
- Authenticated encryption support

[Unreleased]: https://github.com/AustinKelsay/snstr/compare/v0.1.6...HEAD
[0.1.6]: https://github.com/AustinKelsay/snstr/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/AustinKelsay/snstr/compare/v0.1.2...v0.1.5
[0.1.2]: https://github.com/AustinKelsay/snstr/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AustinKelsay/snstr/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AustinKelsay/snstr/releases/tag/v0.1.0
