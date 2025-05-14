# SNSTR - Simple Nostr Software Toolkit for Retards
### Still Under Construction 🚧

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Table of Contents

- [Features](#features)
- [Supported NIPs](#supported-nips)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Documentation](#documentation)
- [Examples](#examples)
- [Testing](#testing)
- [Scripts](#scripts)
  - [Build Scripts](#build-scripts)
  - [Testing Scripts](#testing-scripts)
  - [Example Scripts](#example-scripts)
  - [Code Quality Scripts](#code-quality-scripts)
- [Development](#development)
- [Security](#security)

## Features

### Core Functionality
- Event creation and signing with comprehensive validation
- Relay connections with automatic reconnect
- Filter-based subscriptions
- Support for replaceable events (kinds 0, 3, 10000-19999)
- Support for addressable events (kinds 30000-39999)

### Advanced Features
- Encrypted messaging with both NIP-04 (AES-CBC) and NIP-44 (ChaCha20+HMAC)
- Identity verification with NIP-05 DNS-based identifiers
- Browser extension integration via NIP-07
- Remote signing capability via NIP-46
- Lightning Zaps integration via NIP-57
- Wallet connection via NIP-47
- Built-in ephemeral relay for testing and development

## Supported NIPs

SNSTR currently implements the following Nostr Implementation Possibilities (NIPs):

- **NIP-01**: Basic protocol functionality with comprehensive event validation
- **NIP-04**: Encrypted direct messages using AES-CBC
- **NIP-05**: DNS identifier verification and relay discovery
- **NIP-07**: Browser extension integration for key management
- **NIP-11**: Relay Information Document for discovering relay capabilities
- **NIP-19**: Bech32-encoded entities for human-readable identifiers
- **NIP-44**: Improved encryption with ChaCha20 and HMAC-SHA256 authentication
- **NIP-46**: Remote signing (bunker) support for secure key management
- **NIP-57**: Lightning Zaps protocol for Bitcoin payments via Lightning
- **NIP-47**: Nostr Wallet Connect for secure wallet communication

For detailed information on each implementation, see the corresponding files in the `src/` directory. Note that NIP-01 functionality is implemented throughout the core files (event handling, relay communication, etc.) rather than in a dedicated directory.

## Installation

```bash
# Coming soon
```

## Basic Usage

```typescript
import { Nostr, RelayEvent } from 'snstr';

async function main() {
  // Initialize with relays and connection timeout
  const client = new Nostr(['wss://relay.nostr.band']);
  
  // Generate keypair
  const keys = await client.generateKeys();
  
  // Connect to relays
  await client.connectToRelays();
  
  // Set up event handlers
  client.on(RelayEvent.Connect, (relay) => {
    console.log(`Connected to ${relay}`);
  });
  
  // Publish a note
  const note = await client.publishTextNote('Hello, Nostr!');
  console.log(`Published note with ID: ${note?.id}`);

  // Subscribe to events
  const subIds = client.subscribe(
    [{ kinds: [1], limit: 10 }], // Filter for text notes
    (event, relay) => {
      console.log(`Received event from ${relay}:`, event);
    }
  );

  // Cleanup
  setTimeout(() => {
    client.unsubscribe(subIds);
    client.disconnectFromRelays();
  }, 10000);
}

main().catch(console.error);
```

For more examples including encryption, relay management, and NIP-specific features, see the [examples directory](./examples/README.md).

## Documentation

The project is organized with detailed documentation for different components:

- **[NIP Implementation Guide](src/NIP_STANDARDIZATION.md)**: Standards for implementing NIPs
- **[Test Documentation](tests/README.md)**: Overview of test organization and execution
- **[Examples Documentation](examples/README.md)**: Complete guide to examples for all features
- **[Test Standardization](tests/TEST_STANDARDIZATION.md)**: Guide for writing standardized tests
- **[Example Standardization](examples/EXAMPLE_STANDARDIZATION.md)**: Guide for creating standardized examples

## Examples

SNSTR includes comprehensive examples for all supported features and NIPs:

```bash
# Run the basic example
npm run example

# Run the direct messaging example
npm run example:dm  # Uses NIP-04 implementation

# Run client-related examples
npm run example:relay-connection  # Relay connection management
npm run example:event-ordering    # Event ordering demonstration
npm run example:filter-types      # Filter types
npm run example:addressable       # Addressable events
npm run example:replaceable       # Replaceable events
npm run example:nip01:validation  # NIP-01 validation flow

# Run NIP-specific examples
npm run example:nip04  # Encrypted direct messages
npm run example:nip05  # DNS identifiers
npm run example:nip19  # Bech32-encoded entities
npm run example:nip44  # Versioned encryption
npm run example:nip46  # Remote signing protocol
npm run example:nip57  # Lightning Zaps
```

For a full list of examples and detailed descriptions, see the [examples README](./examples/README.md).

## Testing

SNSTR includes a comprehensive test suite that uses an ephemeral relay to avoid external dependencies:

```bash
# Run all tests
npm test

# Run tests by category
npm run test:core     # Core functionality tests
npm run test:crypto   # Encryption and crypto tests
npm run test:identity # Identity-related tests
npm run test:protocols # Protocol implementation tests

# Run tests for specific NIPs
npm run test:nip04
npm run test:nip44
npm run test:nip57
```

The test suite is organized with a mix of individual test files (like `relay.test.ts`, `nostr.test.ts`) for core functionality and dedicated directories (like `nip19/`, `nip44/`) for NIP-specific tests. This structure allows for focused testing of specific implementations while maintaining comprehensive coverage.

For more information about the test structure and methodology, see the [tests README](./tests/README.md).

## Scripts

SNSTR provides numerous npm scripts to help with development, testing, and running examples:

### Build Scripts
```bash
# Build the library
npm run build

# Build example files
npm run build:examples
```

### Testing Scripts
```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Generate code coverage report
npm run test:coverage

# Test by category
npm run test:core          # Core functionality (event, nostr, relay)
npm run test:crypto        # All crypto (core + NIP-04 + NIP-44)
npm run test:identity      # Identity-related features (NIP-05, NIP-07, NIP-19)
npm run test:protocols     # Protocol implementations (NIP-46, NIP-47, NIP-57)
npm run test:integration   # Integration tests

# Test specific core components
npm run test:event         # Event creation and validation
npm run test:nostr         # Nostr client 
npm run test:relay         # Relay functionality
npm run test:crypto:core   # Core cryptographic utilities only

# Test specific NIPs
npm run test:nip04         # NIP-04 (Encrypted Direct Messages)
npm run test:nip05         # NIP-05 (DNS Identifiers)
npm run test:nip07         # NIP-07 (Browser Extensions)
npm run test:nip11         # NIP-11 (Relay Information)
npm run test:nip19         # NIP-19 (Bech32 Entities)
npm run test:nip44         # NIP-44 (Versioned Encryption)
npm run test:nip46         # NIP-46 (Remote Signing)
npm run test:nip47         # NIP-47 (Wallet Connect)
npm run test:nip57         # NIP-57 (Lightning Zaps)
```

### Example Scripts
```bash
# Run the basic example
npm run example

# Run with different logging levels
npm run example:verbose    # Verbose logging
npm run example:debug      # Debug logging

# Example categories
npm run example:basic      # Basic functionality (core, crypto, direct messages)
npm run example:messaging  # Messaging examples (DM, NIP-04, NIP-44)
npm run example:identity   # Identity examples (NIP-05, NIP-07, NIP-19)
npm run example:payments   # Payment examples (NIP-47, NIP-57)
npm run example:advanced   # Advanced protocol examples (NIP-46, error handling)

# Feature-specific examples
npm run example:crypto     # Cryptographic functions
npm run example:dm         # Direct messaging (NIP-04)
npm run example:relay-connection  # Relay connection management

# Client-specific examples
npm run example:addressable      # Addressable events (kinds 30000-39999)
npm run example:replaceable      # Replaceable events (kinds 0, 3, 10000-19999)
npm run example:nip01:validation # Event validation workflow

# NIP-specific examples
npm run example:nip04      # Encrypted direct messages (NIP-04)
npm run example:nip05      # DNS identifiers (NIP-05)
npm run example:nip07      # Browser extensions (NIP-07)
npm run example:nip11      # Relay information (NIP-11)
npm run example:nip19      # Bech32-encoded entities (NIP-19)
npm run example:nip44      # Versioned encryption (NIP-44)
npm run example:nip46      # Remote signing protocol (NIP-46)
npm run example:nip47      # Wallet connect (NIP-47)
npm run example:nip57      # Lightning zaps (NIP-57)
```

### Code Quality Scripts
```bash
# Run linting
npm run lint

# Format code with Prettier
npm run format
```

For a complete list of available scripts, see the `scripts` section in `package.json`.

## Development

```bash
# Build the project
npm run build

# Build examples
npm run build:examples

# Run linting
npm run lint

# Format code
npm run format
```

### Directory Structure Notes

- **Source Code**: All NIP implementations follow the `src/nipXX` naming pattern (lowercase)
- **Examples**: Organized by NIP in `examples/nipXX` directories and client examples in `examples/client`
- **Core Functionality**: NIP-01 features are integrated throughout the base implementation
- For more details on code organization standards, see the [NIP Implementation Guide](src/NIP_STANDARDIZATION.md)

## Security

SNSTR implements robust security features throughout the codebase:

- **Comprehensive Event Validation**: Full verification of event signatures and structure
- **Secure Key Generation**: Safe private key generation within the secp256k1 curve limits
- **NIP-19 Security**: Relay URL validation and filtering to prevent injection attacks
- **NIP-44 Encryption**: Authenticated encryption with ChaCha20 and HMAC-SHA256
- **Input Validation**: Thorough validation and error checking across all components

For details on security considerations for specific NIPs, see the documentation in each implementation folder.