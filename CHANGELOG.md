# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Beta release status
- Comprehensive release documentation

### Changed
- Updated project name to "Secure Nostr Software Toolkit for Renegades"
- Improved warning messages from alpha to beta status

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

[Unreleased]: https://github.com/AustinKelsay/snstr/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AustinKelsay/snstr/releases/tag/v0.1.0