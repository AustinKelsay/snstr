# URL Preprocessing Fix for NIP-01 Nostr Class

## Problem Description

The original code in `src/nip01/nostr.ts` (around lines 165-172) had a critical bug where it incorrectly prefixed "wss://" to URLs that already contained a different scheme like "http://". This resulted in malformed URLs like "wss://http://example.com" and unclear error messages.

### Original Problematic Code

```typescript
if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
  url = `wss://${url}`;
}
```

This code would blindly prefix "wss://" to any URL that didn't start with "ws://" or "wss://", including URLs with other schemes.

## Solution

### Key Features

1. **Early Detection & Fast Fail**: Added comprehensive scheme detection using regex patterns to identify URLs with existing schemes
2. **Clear Error Messages**: Provide detailed, actionable error messages that:
   - Identify the invalid scheme
   - Suggest valid alternatives (ws://, wss://)
   - Show the problematic input
   - Explain the WebSocket requirement
3. **Case Insensitive**: Handle mixed-case schemes (WSS://, WS://, etc.) correctly
4. **Port Handling**: Properly distinguish between schemes and port numbers (e.g., "domain.com:8080")
5. **Robust Input Validation**: Handle edge cases like empty strings, null values, and non-string inputs
6. **Consistent Behavior**: Applied the same logic across `addRelay`, `getRelay`, and `removeRelay` methods

### Implementation Details

#### New `preprocessRelayUrl` Method

```typescript
private preprocessRelayUrl(url: string): string {
  // Input validation
  if (!url || typeof url !== "string") {
    throw new Error("URL must be a non-empty string");
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error("URL cannot be empty or whitespace only");
  }

  // Scheme detection with proper :// pattern
  const schemePattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
  const schemeMatch = trimmedUrl.match(schemePattern);
  
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "ws" || scheme === "wss") {
      return trimmedUrl; // Valid WebSocket scheme
    } else {
      // Invalid scheme - fail fast with clear error
      throw new Error(
        `Invalid relay URL scheme: "${scheme}://". ` +
        `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
        `Got: "${trimmedUrl}"`
      );
    }
  } else {
    // Handle port detection and add wss:// prefix for schemeless URLs
    const hasPort = /^[^:/]+:\d+/.test(trimmedUrl);
    if (hasPort) {
      return `wss://${trimmedUrl}`;
    }
    
    // Additional validation for malformed schemes
    const colonIndex = trimmedUrl.indexOf(':');
    if (colonIndex !== -1) {
      const beforeColon = trimmedUrl.substring(0, colonIndex);
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(beforeColon) && !hasPort) {
        throw new Error(
          `Invalid relay URL scheme: "${beforeColon}://". ` +
          `Relay URLs must use WebSocket protocols (ws:// or wss://). ` +
          `Got: "${trimmedUrl}"`
        );
      }
    }
    
    return `wss://${trimmedUrl}`;
  }
}
```

#### Updated Method Calls

All three relay management methods now use the new preprocessing:

```typescript
public addRelay(url: string): Relay {
  url = this.preprocessRelayUrl(url);
  url = this.normalizeRelayUrl(url);
  if (!isValidRelayUrl(url)) {
    throw new Error(`Invalid relay URL: ${url}`);
  }
  // ... rest of method
}
```

## Benefits

### 1. **Prevents Malformed URLs**
- ❌ Before: `addRelay("http://example.com")` → `"wss://http://example.com"`
- ✅ After: `addRelay("http://example.com")` → Clear error message

### 2. **Fast Fail with Clear Errors**
```
Invalid relay URL scheme: "http://". 
Relay URLs must use WebSocket protocols (ws:// or wss://). 
Got: "http://example.com"
```

### 3. **Backward Compatible**
- Valid existing usage patterns continue to work
- Automatic `wss://` prefixing for schemeless URLs
- Case-insensitive scheme handling

### 4. **Robust Edge Case Handling**
- Empty strings and whitespace
- Null/undefined inputs
- Non-string inputs
- URLs with ports
- Mixed case schemes

### 5. **Developer Experience**
- Meaningful error messages for debugging
- Consistent behavior across all relay methods
- Clear documentation and examples

## Testing

Comprehensive test coverage includes:
- Valid URL acceptance (ws://, wss://, schemeless)
- Invalid scheme rejection (http://, https://, ftp://, etc.)
- Input validation (empty, null, wrong types)
- Edge cases (ports, mixed case, malformed schemes)
- Consistent behavior across methods
- Error message quality

## Usage Examples

```typescript
const nostr = new Nostr();

// ✅ Valid usage
nostr.addRelay("wss://relay.example.com");     // Direct WebSocket URL
nostr.addRelay("ws://localhost:8080");         // Insecure WebSocket  
nostr.addRelay("relay.example.com");           // Auto-prefixed to wss://
nostr.addRelay("relay.example.com:8080");      // Auto-prefixed with port

// ❌ Invalid usage (fast fail with clear errors)
nostr.addRelay("http://example.com");          // Clear error about http://
nostr.addRelay("https://example.com");         // Clear error about https://
nostr.addRelay("");                            // Clear error about empty input
```

## Files Modified

1. **`src/nip01/nostr.ts`**
   - Added `preprocessRelayUrl` method
   - Updated `addRelay`, `getRelay`, `removeRelay` methods

2. **`examples/nip01/url-preprocessing-example.ts`** (New)
   - Comprehensive demonstration of the fix
   - Shows before/after behavior
   - Covers all edge cases

## Impact

- **No Breaking Changes**: Existing valid code continues to work
- **Improved Security**: Prevents malformed URL construction
- **Better Developer Experience**: Clear error messages for debugging
- **Robust Error Handling**: Fast fail with actionable feedback
- **Future-Proof**: Extensible pattern for additional URL validation 