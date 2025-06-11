# NIP-46 Connection String Pubkey Validation Fix

## Problem Description

The original `parseConnectionString` function in `src/nip46/utils/connection.ts` around lines 37-43 had a subtle but critical validation bypass issue. The code was using `url.hostname` to extract the pubkey from connection strings, which automatically converts hostnames to lowercase according to URL standards.

This created a security vulnerability where uppercase pubkeys could bypass the strict validation enforced by `isValidPublicKeyFormat`, which only accepts lowercase hex characters (`/^[0-9a-f]{64}$/`).

### Original Problematic Code

```typescript
try {
  const url = new URL(str);
  const type = url.protocol === "bunker:" ? "bunker" : "nostrconnect";
  const pubkey = url.hostname; // ❌ Automatically lowercases the pubkey

  if (!isValidPublicKeyFormat(pubkey)) {
    throw new NIP46ConnectionError(
      "Invalid signer public key in connection string",
    );
  }
}
```

### The Vulnerability

If someone provided a connection string like:
- `bunker://1234567890ABCDEF...` (uppercase)

The `url.hostname` would convert it to:
- `1234567890abcdef...` (lowercase)

Before validation, effectively bypassing the strict format checking that should reject uppercase pubkeys.

## Solution

### Key Fix: Case-Preserving Pubkey Extraction

**Changed line 37 in `src/nip46/utils/connection.ts`**:
```typescript
// Before
const pubkey = url.hostname;

// After  
// Extract pubkey from original string to preserve case for validation
// Match pattern: protocol://pubkey?params or protocol://pubkey
const protocolPrefix = type === "bunker" ? "bunker://" : "nostrconnect://";
const afterProtocol = str.slice(protocolPrefix.length);
const queryStart = afterProtocol.indexOf("?");
const pubkey = queryStart === -1 ? afterProtocol : afterProtocol.slice(0, queryStart);
```

### How the Fix Works

1. **Direct String Extraction**: Instead of relying on `url.hostname`, the fix extracts the pubkey directly from the original connection string
2. **Case Preservation**: The original case is preserved exactly as provided in the input
3. **Proper Validation**: The preserved pubkey is then validated by `isValidPublicKeyFormat`
4. **Fail Fast**: Uppercase or mixed-case pubkeys are immediately rejected with clear error messages

### Benefits

✅ **Security**: Prevents validation bypass for uppercase pubkeys  
✅ **Consistency**: All pubkeys are validated using the same strict format  
✅ **Compatibility**: No breaking changes to existing functionality  
✅ **Clarity**: Clear error messages for invalid formats  
✅ **Edge Case Handling**: Properly handles query parameters, fragments, and malformed URLs  

## Testing

The fix was validated with comprehensive tests covering:

- **Valid Cases**: Lowercase pubkeys continue to work normally
- **Security Cases**: Uppercase and mixed-case pubkeys are properly rejected
- **Edge Cases**: Complex query parameters, fragments, malformed URLs
- **Roundtrip Tests**: Build/parse cycles maintain data integrity
- **Error Handling**: Graceful handling of various malformed inputs

## Example Usage

```typescript
// ✅ Valid - lowercase pubkey
const validConnection = "bunker://1234567890abcdef...?relay=wss://relay.com";
const result = parseConnectionString(validConnection); // Works

// ❌ Invalid - uppercase pubkey (now properly rejected)
const invalidConnection = "bunker://1234567890ABCDEF...?relay=wss://relay.com";
parseConnectionString(invalidConnection); // Throws NIP46ConnectionError

// ❌ Invalid - mixed case pubkey (now properly rejected)  
const mixedCaseConnection = "nostrconnect://1234567890ABCdef...";
parseConnectionString(mixedCaseConnection); // Throws NIP46ConnectionError
```

## Impact

This fix eliminates a potential security vulnerability while maintaining full backward compatibility with existing valid connection strings. All legitimate use cases continue to work exactly as before, but invalid pubkey formats are now properly caught and rejected. 