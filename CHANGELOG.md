# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.10] - 2025-11-14

### Fixed
- Packaging: `.npmignore` now explicitly keeps `dist/esm/src/**` so the new ESM build actually ships to npm and Turbopack no longer resolves to missing files.
- Build tooling: `scripts/postbuild-esm.js` rewrites every relative specifier in `dist/esm/src/*.js` to include `.js` (or `/index.js`), satisfying Node/Turbopack ESM resolution and preventing `ERR_MODULE_NOT_FOUND` at runtime.
- Tooling: replaced the `tests/tsconfig.json` symlink with a real wrapper config so editors/tsserver stop reporting “No inputs were found…” errors when opening files inside `tests/`.

## [0.1.9] - 2025-11-14

### Added
- Dual-build pipeline that emits both CommonJS and native ESM bundles, complete with conditional exports for Node, browsers, and React Native plus a post-build helper that marks `dist/esm` as `"type": "module"` so bundlers pick up the optimized entry points.
- `snstr/nip07-ambient` side-effect module to optionally augment `window.nostr` typings for browser apps without forcing extra runtime code into non-browser builds.

### Changed
- Relay WebSocket plumbing now shares explicit handler/event types, threading the same stronger typings through the core relay implementation and the in-memory test transport to remove `any` usage and surface better editor tooling.
- Refined TypeScript configs and React Native/browser export targets to consistently resolve the ESM entry files, preventing stale CJS shims from leaking into client builds.

### Fixed
- Addressed ambient export regressions so the new NIP-07 helper is available from the package root and from the `./nip07-ambient` subpath.
- Hardened the custom in-memory WebSocket implementation (and its tests) so it mirrors the shape of DOM events, preventing undefined handler parameters during stress tests.

### Docs
- README and example guides now include a Next.js/Turbopack compatibility section, refreshed tables of test/example scripts, and corrected npm script names (such as `test:crypto` and new example bundles).

### Removed
- Deleted unused release/Claude GitHub workflows to keep CI focused on active pipelines.

## [0.1.8] - 2025-11-12

### Fixed
- Packaging: ensure `parseBolt11Invoice` is exported from both Node and web/RN entry points in the published bundle. This release supersedes v0.1.6, which had a stale dist.

### Chore
- Add `prepublishOnly` to always build before `npm publish`, preventing stale artifacts.

## [0.1.7] - 2025-11-11

Note: Internal/in-between version; not published to npm. Superseded by v0.1.8.

### Fixed
- Prepared packaging fix for `parseBolt11Invoice` export.

### Chore
- Added `prepublishOnly` build step.

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

[Unreleased]: https://github.com/AustinKelsay/snstr/compare/v0.1.10...HEAD
[0.1.10]: https://github.com/AustinKelsay/snstr/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/AustinKelsay/snstr/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/AustinKelsay/snstr/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/AustinKelsay/snstr/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/AustinKelsay/snstr/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/AustinKelsay/snstr/compare/v0.1.2...v0.1.5
[0.1.2]: https://github.com/AustinKelsay/snstr/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AustinKelsay/snstr/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AustinKelsay/snstr/releases/tag/v0.1.0
