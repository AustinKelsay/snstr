# NIP-46 Tests

This directory contains comprehensive tests for the NIP-46 (Nostr Connect) implementation, which provides a remote signing protocol for securely storing private keys in a separate "bunker" application.

## Test Architecture

The test suite is organized into **7 focused test files** that provide complete coverage of the NIP-46 specification and implementation security:

### 🔧 **Core Test Files**

#### **`core-functionality.test.ts`** (1,398 lines)
**The main integration test suite** covering:
- ✅ **Client State Management** - Connection lifecycle, error handling
- ✅ **Event Signing** - Complete signing workflow and edge cases  
- ✅ **Encryption Support** - NIP-44 and NIP-04 encryption/decryption
- ✅ **Authentication Challenge System** - Auth challenge resolution and validation
- ✅ **Full Implementation Unit Tests** - Comprehensive bunker and client unit tests
- ✅ **Basic Integration Tests** - End-to-end functionality verification
- ✅ **Static Methods & Utilities** - Connection string generation, ping, etc.
- ✅ **Race Condition Fixes** - Client disconnect safety and state consistency

#### **`validator-unit.test.ts`** (565 lines)  
**Input validation and security hardening**:
- ✅ **NIP46Validator Methods** - All validation functions (pubkeys, signatures, events, etc.)
- ✅ **Security Error Handling** - Secure error responses and timing attack prevention
- ✅ **Request ID Generation** - Cryptographically secure ID generation
- ✅ **Private Key Security** - Key validation and secure handling
- ✅ **Timing Attack Prevention** - Constant-time operations

#### **`input-validation.test.ts`** (579 lines)
**Comprehensive input validation and security**:
- ✅ **Connection String Validation** - Format validation, security checks, dangerous character filtering
- ✅ **Key Validation** - Public/private key format and security validation
- ✅ **Event Content Validation** - Event structure and content security
- ✅ **Parameter Validation** - Method parameter validation and sanitization
- ✅ **Rate Limiting** - Input-based rate limiting and DoS protection
- ✅ **Error Handling Security** - Secure error responses

### 🛡️ **Security & Performance Test Files**

#### **`performance-security.test.ts`** (683 lines)
**DoS protection and performance testing**:
- ✅ **Resource Exhaustion Protection** - Memory, CPU, and connection limits
- ✅ **Request Rate Limiting** - Per-client and global rate limiting
- ✅ **DoS Protection** - Advanced DoS attack prevention
- ✅ **Memory Management** - Memory leak prevention and cleanup
- ✅ **Connection Handling** - Connection pool management and limits
- ✅ **Replay Attack Protection** - Request replay prevention

#### **`permissions.test.ts`** (442 lines)
**Permission system and access control**:
- ✅ **Permission Validation** - Method-specific permission checking
- ✅ **Permission Inheritance** - Default and custom permission handling
- ✅ **Custom Permission Handlers** - Dynamic permission resolution
- ✅ **Permission Security** - Unauthorized access prevention

### 🔗 **Connection & Infrastructure Test Files**

#### **`connection-failures.test.ts`** (283 lines)
**Connection resilience and failure handling**:
- ✅ **Connection Failures** - Network failure simulation and recovery
- ✅ **Timeout Handling** - Request timeout and retry logic
- ✅ **Reconnection Logic** - Automatic reconnection and state recovery
- ✅ **Error Recovery** - Graceful degradation and error handling

#### **`bunker-functionality.test.ts`** (437 lines)
**Bunker-specific functionality**:
- ✅ **Bunker Configuration** - Setup, initialization, and configuration
- ✅ **Permission System** - Bunker-side permission management
- ✅ **Event Signing Validation** - Bunker signing workflow
- ✅ **State Management** - Bunker internal state and lifecycle
- ✅ **Security Initialization** - Secure bunker startup and key management

## Test Coverage

### **✅ Complete NIP-46 Specification Coverage**
- **Connection & Authentication** - Full handshake and challenge system
- **Event Signing** - All event types and signing scenarios
- **Encryption** - NIP-44 and NIP-04 encryption/decryption
- **Permission Control** - Granular permission system
- **Error Handling** - Comprehensive error scenarios
- **Security** - DoS protection, input validation, timing attacks

### **✅ Implementation Security**
- **Input Validation** - All inputs validated and sanitized
- **Rate Limiting** - Multiple layers of rate limiting
- **Memory Safety** - Memory leak prevention and cleanup
- **Timing Attacks** - Constant-time operations where needed
- **DoS Protection** - Resource exhaustion prevention

### **✅ Edge Cases & Error Conditions**
- **Connection Failures** - Network issues, timeouts, reconnection
- **Invalid Inputs** - Malformed requests, invalid keys, bad parameters
- **Race Conditions** - Concurrent operations and state consistency
- **Resource Limits** - Memory, CPU, and connection limits

## Running the Tests

```bash
# Run all NIP-46 tests
npm run test tests/nip46/

# Run specific test categories
npx jest tests/nip46/core-functionality.test.ts    # Core functionality
npx jest tests/nip46/validator-unit.test.ts        # Input validation
npx jest tests/nip46/performance-security.test.ts  # Security & performance
npx jest tests/nip46/permissions.test.ts           # Permission system
npx jest tests/nip46/connection-failures.test.ts   # Connection resilience
npx jest tests/nip46/input-validation.test.ts      # Input security
npx jest tests/nip46/bunker-functionality.test.ts  # Bunker features

# Run with coverage
npx jest tests/nip46/ --coverage
```

## Test Environment

- **Ephemeral Relay**: Tests use in-memory relay to avoid external dependencies
- **Isolated Instances**: Each test creates fresh client/bunker instances
- **Deterministic**: Tests are deterministic and can run in parallel
- **Comprehensive Cleanup**: Proper cleanup prevents test interference

## Implementation Verification

The tests verify complete adherence to the NIP-46 specification:

- ✅ **Event Encryption** - Proper encryption between client and bunker
- ✅ **Request-Response Pattern** - Correct message flow and timing
- ✅ **Authentication Mechanisms** - Challenge-response authentication
- ✅ **Permission-Based Access** - Granular permission enforcement
- ✅ **Secure Key Management** - Keys never leave the bunker
- ✅ **Error Standardization** - Consistent error handling and reporting 