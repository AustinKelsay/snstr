# NIP-46 Examples Summary

## Overview

This directory contains comprehensive examples for NIP-46 (Remote Signing) implementation, all updated to comply with the latest NIP-46 specification changes.

## 🔄 Key NIP-46 Specification Updates

The examples in this directory have been systematically updated to reflect the following critical changes in the NIP-46 specification:

### 1. **remote-signer-key Introduction**
- **Change**: `remote-signer-key` is now introduced and passed in bunker URL
- **Impact**: Connection strings now contain the remote signer's communication key, not the user's identity key
- **Example**: `bunker://[remote-signer-pubkey]?relay=...`

### 2. **Pubkey Differentiation**
- **Change**: Clients must differentiate between `remote-signer-pubkey` and `user-pubkey`
- **Impact**: Two distinct keypairs are used:
  - `remote-signer-pubkey`: For encrypted communication between client/bunker
  - `user-pubkey`: For signing Nostr events (the user's identity)

### 3. **get_public_key() Requirement**
- **Change**: Must call `get_public_key()` after `connect()`
- **Impact**: Connection flow now requires two steps:
  1. `connect()` - Establishes connection, returns "ack"
  2. `get_public_key()` - Retrieves the actual user signing pubkey

### 4. **NIP-05 Login Removal**
- **Change**: NIP-05 login flows are removed
- **Impact**: Simplified authentication flow, no domain-based login

### 5. **create_account Migration**
- **Change**: `create_account` moved to another NIP
- **Impact**: Account creation is no longer part of NIP-46 specification

## 📁 Example Files

### Core Examples

#### 1. **unified-example.ts** ⭐ **(RECOMMENDED)**
- **Purpose**: Single comprehensive example showing all core functionality
- **Features**: Complete flow from setup to signing with clear explanations
- **Best for**: Understanding the full NIP-46 flow
- **Run**: `npm run example:nip46`

#### 2. **basic-example.ts**
- **Purpose**: Basic implementation showing essential features
- **Features**: Connection, key retrieval, signing, verification
- **Best for**: Getting started with NIP-46
- **Run**: `npm run example:nip46:basic`

#### 3. **minimal.ts**
- **Purpose**: Minimal working example with essential code only
- **Features**: Bare minimum implementation with detailed logging
- **Best for**: Understanding core concepts
- **Run**: `npm run example:nip46:minimal`

### Specialized Examples

#### 4. **simple/simple-example.ts**
- **Purpose**: Using SimpleNIP46 classes
- **Features**: Simplified API demonstration
- **Run**: `npm run example:nip46:simple`

#### 5. **simple/simple-client-test.ts**
- **Purpose**: Comprehensive testing of simple implementation
- **Features**: Full test coverage with validation
- **Run**: `npm run example:nip46:simple-client`

#### 6. **advanced/remote-signing-demo.ts**
- **Purpose**: Advanced features and edge cases
- **Features**: Permissions, encryption, error handling
- **Best for**: Production-ready implementations
- **Run**: `npm run example:nip46:advanced`

#### 7. **from-scratch/implementation-from-scratch.ts**
- **Purpose**: Complete implementation without library classes
- **Features**: Manual implementation of NIP-46 protocol
- **Best for**: Understanding protocol internals
- **Run**: `npm run example:nip46:from-scratch`

### Testing & Validation

#### 8. **test-all-examples.ts** 🧪
- **Purpose**: Comprehensive test runner for all examples
- **Features**: Automated testing with compliance verification
- **Run**: `npm run example:nip46:test-all`

## 🔧 Usage Patterns

### Basic Connection Flow
```typescript
// 1. Generate separate keypairs
const userKeypair = await generateKeypair();      // For signing events
const signerKeypair = await generateKeypair();    // For communication

// 2. Set up bunker with both keys
const bunker = new SimpleNIP46Bunker(
  relays,
  userKeypair.publicKey,     // User's identity key
  signerKeypair.publicKey,   // Signer's communication key
  { defaultPermissions: ["sign_event:1", "get_public_key", "ping"] }
);

// 3. Connection string contains signer pubkey (NOT user pubkey)
const connectionString = bunker.getConnectionString();
// Result: bunker://[signer-pubkey]?relay=...

// 4. Client connects and gets user pubkey separately
const client = new SimpleNIP46Client(relays);
await client.connect(connectionString);        // Returns "ack"
const userPubkey = await client.getPublicKey(); // Returns user's signing key
```

### Key Verification
```typescript
// Always verify the pubkey relationships
console.log(`Connection string contains signer pubkey: ${signerKeypair.publicKey}`);
console.log(`Retrieved user pubkey: ${userPubkey}`);
console.log(`User pubkey matches original: ${userPubkey === userKeypair.publicKey}`);
console.log(`User pubkey != signer pubkey: ${userPubkey !== signerKeypair.publicKey}`);
```

## 🛡️ Security Considerations

### Private Key Management
- **User Private Key**: Securely stored in bunker, never transmitted
- **Signer Private Key**: Used for communication encryption only
- **Separation**: Clear separation between identity and communication keys

### Permission System
```typescript
// Granular permissions
const permissions = [
  "sign_event:1",        // Allow signing kind 1 events
  "get_public_key",      // Allow retrieving user pubkey
  "ping",                // Allow ping/pong
  "nip44_encrypt",       // Allow NIP-44 encryption
  "nip44_decrypt"        // Allow NIP-44 decryption
];
```

### Connection Validation
- Validate connection strings before use
- Verify pubkey formats (hex, 64 chars)
- Check relay URL validity
- Implement proper timeout handling

## 🧪 Testing & Validation

### Manual Testing
Run individual examples:
```bash
npm run example:nip46              # Unified example
npm run example:nip46:basic        # Basic example
npm run example:nip46:minimal      # Minimal example
npm run example:nip46:advanced     # Advanced features
```

### Automated Testing
Run comprehensive test suite:
```bash
npm run example:nip46:test-all     # Test all examples
npm run test:nip46                 # Run unit tests
```

### Compliance Verification
The test runner verifies:
1. ✅ Connection strings contain remote-signer-pubkey (not user-pubkey)
2. ✅ connect() establishes connection but doesn't return user-pubkey
3. ✅ get_public_key() is called after connect() to retrieve user-pubkey
4. ✅ Examples clearly differentiate between signer and user pubkeys
5. ✅ No NIP-05 login flows present
6. ✅ No create_account operations present

## 🚀 Quick Start

1. **Start with the unified example**:
   ```bash
   npm run example:nip46
   ```

2. **Understand the key concepts**:
   - Remote signer pubkey (for communication)
   - User pubkey (for signing events)
   - Two-step connection process

3. **Explore specialized examples** based on your needs:
   - Basic implementation → `basic-example.ts`
   - Advanced features → `advanced/remote-signing-demo.ts`
   - Protocol internals → `from-scratch/implementation-from-scratch.ts`

4. **Run the comprehensive test**:
   ```bash
   npm run example:nip46:test-all
   ```

## 📚 Additional Resources

- **Architecture**: See `ARCHITECTURE.md` for visual diagrams
- **Specification**: [NIP-46 Official Spec](https://github.com/nostr-protocol/nips/blob/master/46.md)
- **API Reference**: Check `src/nip46/README.md` for detailed API docs

## ✅ Status

All examples are **fully compliant** with the updated NIP-46 specification and pass comprehensive testing.

**Last Updated**: January 2025  
**Specification Compliance**: ✅ Full compliance with latest NIP-46 spec  
**Test Coverage**: ✅ 100% of examples passing automated tests 