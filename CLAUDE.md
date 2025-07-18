# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SNSTR (Simple Nostr Software Toolkit for Retards) is a comprehensive TypeScript library for the Nostr protocol. It implements multiple NIPs (Nostr Implementation Possibilities) with a focus on security, performance, and ease of use.

## Essential Commands

### Build and Development
```bash
npm run build                    # Build the main library
npm run build:examples          # Build example files  
npm run lint                     # Run ESLint
npm run format                   # Format code with Prettier
```

### Testing
```bash
npm test                         # Run all tests
npm run test:watch              # Run tests in watch mode
npm run test:coverage           # Generate coverage report
npm run test:core               # Test core NIP-01 functionality
npm run test:nip04              # Test specific NIP (replace 04 with any NIP number)
npm run test:crypto             # Test all crypto functionality
npm run test:integration        # Run integration tests
```

### Examples
```bash
npm run example                          # Basic example
npm run example:nip01:relay:connection   # Relay connection example
npm run example:nip04                    # Encrypted messaging example
npm run example:nip46                    # Remote signing example
npm run example:nip47                    # Wallet connect example
```

## Architecture Overview

### Core Components

**Main Client Classes:**
- `Nostr` (`src/nip01/nostr.ts`) - Primary client for single or multiple relay connections
- `RelayPool` (`src/nip01/relayPool.ts`) - Multi-relay connection pool with automatic failover
- `Relay` (`src/nip01/relay.ts`) - Individual relay connection management

**Key Architecture Patterns:**
- Each NIP is implemented in its own directory (`src/nipXX/`)
- NIP-01 contains the core protocol implementation with specialized files:
  - `event.ts` - Event creation, validation, and utilities
  - `nostr.ts` - Main client implementation with rate limiting
  - `relay.ts` - WebSocket relay connection management
  - `relayPool.ts` - Multi-relay coordination and batch operations
- Shared utilities in `src/utils/` and `src/types/`
- Comprehensive security validation throughout all components

### Entry Point and Exports

The main entry point (`src/index.ts`) exports all public APIs. Key exports include:
- Client classes: `Nostr`, `Relay`, `RelayPool`
- NIP-specific utilities (e.g., `encryptNIP04`, `createZapRequest`)
- Core utilities: `generateKeypair`, `createEvent`, `getEventHash`
- Type definitions for all interfaces

### Rate Limiting and Security

- Built-in rate limiting for all operations (subscribe, publish, fetch)
- Configurable via `NostrRateLimits` interface
- Security validation for all inputs via `src/utils/security-validator.ts`
- Comprehensive event signature verification

### Multi-Relay Operations

The library provides two approaches for multi-relay operations:
1. **Nostr client** - Uses `fetchMany()` and `fetchOne()` for cross-relay queries
2. **RelayPool** - Lower-level multi-relay coordination with batch operations

### Testing Infrastructure

- Uses Jest with ts-jest preset
- Ephemeral relay implementation for testing (`src/utils/ephemeral-relay.ts`)
- Comprehensive test coverage organized by NIP
- Integration tests and performance tests included

## Development Guidelines

### Code Organization
- Follow existing NIP directory structure (`src/nipXX/`)
- All new NIPs should include README.md with implementation details
- Export all public APIs through main `src/index.ts`
- Use TypeScript strict mode - all types must be properly defined

### Security Requirements
- Never expose private keys in logs or error messages
- All user inputs must go through security validation
- Use the existing security validator for input sanitization
- Follow rate limiting patterns for new operations

### Testing Requirements
- All new features require comprehensive tests
- Use the ephemeral relay for relay-dependent tests
- Follow the test organization pattern (`tests/nipXX/`)
- Aim for high test coverage on all new code

### Example Guidelines
- Provide working examples for all new features
- Examples should be runnable with npm scripts
- Include both basic and advanced usage examples
- Follow the standardization guide in `examples/EXAMPLE_STANDARDIZATION.md`

## Common Development Tasks

### Adding a New NIP Implementation
1. Create `src/nipXX/` directory with implementation
2. Add exports to main `src/index.ts`
3. Create comprehensive tests in `tests/nipXX/`
4. Add working examples in `examples/nipXX/`
5. Update README.md with new NIP support

### Running Specific Tests
Use the extensive npm script system for targeted testing. Examples:
- `npm run test:nip01:event` - Test event functionality
- `npm run test:nip01:relay:connection` - Test relay connections
- `npm run test:crypto:core` - Test core cryptographic functions

### Working with Multi-Relay Features
- Use `RelayPool` for low-level multi-relay coordination
- Use `Nostr.fetchMany()` and `fetchOne()` for high-level queries
- Always handle relay connection failures gracefully
- Use the existing relay URL normalization utilities

## Dependencies and Build System

- **TypeScript** - Compiled to CommonJS in `dist/`
- **Jest** - Testing framework with ts-jest
- **ESLint + Prettier** - Code quality and formatting
- **Noble libraries** - Cryptographic operations (@noble/curves, @noble/hashes, @noble/ciphers)
- **WebSocket polyfill** - Node.js WebSocket support
- **Zod** - Runtime type validation

The build system outputs to `dist/` with TypeScript declarations. Examples are built separately to `dist-examples/`.