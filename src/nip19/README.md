# NIP-19: Bech32-Encoded Entities

This module implements [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md), which defines human-readable encodings for Nostr entities using the Bech32 format.

## Overview

NIP-19 provides standardized human-friendly encodings for various Nostr entities like public keys, private keys, event IDs, and more complex structures like profiles, events, and addresses. These encodings use the Bech32 format which includes:

- Human-readable prefixes (e.g., `npub`, `nsec`, `note`)
- Error detection capabilities
- Consistent formatting across different types of entities

## Key Features

- 🔤 **Multiple Entity Types**: Support for all NIP-19 entities (npub, nsec, note, nprofile, nevent, naddr)
- 🔄 **Bi-directional Conversion**: Encode and decode all entity types
- ✅ **Validation**: Thorough validation for all entity formats
- 💼 **TLV Handling**: Support for Type-Length-Value data in complex entities
- 🛡️ **Error Handling**: Meaningful error messages for invalid inputs
- ⚡ **Performance**: Optimized for speed and memory efficiency

## Basic Usage

### Working with Public Keys

```typescript
import { encodePublicKey, decodePublicKey } from 'snstr';

// Convert a hex public key to npub format
const npub = encodePublicKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
console.log(npub); // npub1...

// Convert an npub back to hex format
const pubkey = decodePublicKey(npub);
console.log(pubkey); // 3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d
```

### Working with Private Keys

```typescript
import { encodePrivateKey, decodePrivateKey } from 'snstr';

// Convert a hex private key to nsec format
const nsec = encodePrivateKey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
console.log(nsec); // nsec1...

// Convert an nsec back to hex format
const privkey = decodePrivateKey(nsec);
console.log(privkey); // 3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d
```

### Working with Note IDs

```typescript
import { encodeNoteId, decodeNoteId } from 'snstr';

// Convert a hex note ID to note format
const note = encodeNoteId('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
console.log(note); // note1...

// Convert a note back to hex format
const noteId = decodeNoteId(note);
console.log(noteId); // 3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d
```

### Working with Profiles

```typescript
import { encodeProfile, decodeProfile } from 'snstr';

// Create a profile with relays
const profileData = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['wss://relay.example.com', 'wss://relay2.example.com']
};

// Encode the profile data
const nprofile = encodeProfile(profileData);
console.log(nprofile); // nprofile1...

// Decode the nprofile back to profile data
const decodedProfile = decodeProfile(nprofile);
console.log(decodedProfile);
// {
//   pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
//   relays: ['wss://relay.example.com', 'wss://relay2.example.com']
// }

// ⚠️ Security Note: Filter out invalid relay URLs after decoding
function filterInvalidRelays(profile) {
  if (!profile.relays || profile.relays.length === 0) return profile;
  
  function isValidRelayUrl(url) {
    try {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
      const parsedUrl = new URL(url);
      if (parsedUrl.username || parsedUrl.password) return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  return {
    ...profile,
    relays: profile.relays.filter(url => isValidRelayUrl(url))
  };
}

// Safe usage with filtering
const safeProfile = filterInvalidRelays(decodedProfile);
```

### Working with Events

```typescript
import { encodeEvent, decodeEvent } from 'snstr';

// Create an event reference with relays and author
const eventData = {
  id: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['wss://relay.example.com'],
  author: 'pubkey_here',
  kind: 1
};

// Encode the event data
const nevent = encodeEvent(eventData);
console.log(nevent); // nevent1...

// Decode the nevent back to event data
const decodedEvent = decodeEvent(nevent);
console.log(decodedEvent);
// {
//   id: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
//   relays: ['wss://relay.example.com'],
//   author: 'pubkey_here',
//   kind: 1
// }

// Don't forget to filter relays here too!
const safeEvent = filterInvalidRelays(decodedEvent);
```

### Working with Addresses

```typescript
import { encodeAddress, decodeAddress } from 'snstr';

// Create an address for a parameterized replaceable event
const addressData = {
  identifier: 'profile',
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  kind: 30023,
  relays: ['wss://relay.example.com']
};

// Encode the address data
const naddr = encodeAddress(addressData);
console.log(naddr); // naddr1...

// Decode the naddr back to address data
const decodedAddress = decodeAddress(naddr);
console.log(decodedAddress);
// {
//   identifier: 'profile',
//   pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
//   kind: 30023,
//   relays: ['wss://relay.example.com']
// }

// Apply the same relay filtering here
const safeAddress = filterInvalidRelays(decodedAddress);
```

### Universal Decoder

```typescript
import { decode } from 'snstr';

// Decode any NIP-19 entity
const result = decode('npub1xxxxxx...');

console.log(result);
// {
//   type: 'npub',
//   data: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
// }

// Or for more complex types:
const profileResult = decode('nprofile1...');
console.log(profileResult);
// {
//   type: 'nprofile',
//   data: {
//     pubkey: '...',
//     relays: [...]
//   }
// }

// Remember to filter invalid relay URLs when dealing with complex types
if (profileResult.type === 'nprofile') {
  const safeProfileData = filterInvalidRelays(profileResult.data);
  // Use safeProfileData...
}
```

## Implementation Details

- Uses the `@scure/base` library for Bech32 encoding and decoding
- Implements TLV (Type-Length-Value) encoding for complex entities
- Includes robust validation for relay URLs and other entity components
- Handles large bech32 strings with custom limits
- Optimized error handling with detailed error messages

## Security Considerations

- **🧪 Input Validation**: Always validate entities before encoding them to ensure they meet the NIP-19 specifications.
- **🛡️ Relay URL Filtering**: When decoding `nprofile`, `nevent`, or `naddr` entities, be aware that the decoder will include all relay URLs even if they're invalid. You MUST implement filtering after decoding.

### Recent Security Improvements

The SNSTR implementation of NIP-19 has been hardened with several security enhancements:

1. **Reduced TLV Entry Limits**: The maximum number of TLV entries (e.g., relay URLs in a profile) has been reduced from 100 to 20 to prevent potential denial of service attacks.

2. **Strict URL Validation During Encoding**: 
   - Enforces `wss://` or `ws://` protocol
   - Rejects URLs with credentials (username/password)
   - Validates URL structure
   - Maximum URL length of 512 characters

3. **Size Constraints**:
   - Maximum identifier length: 1024 characters
   - Maximum relay URL length: 512 characters
   - Maximum TLV entries: 20

### Best Practices for Secure Usage

**⚠️ Important**: The NIP-19 specification requires decoders to be permissive. This means our decoder will include invalid URLs in the output, which creates a security risk if not handled properly.

Always filter relay URLs after decoding using code similar to this:

```typescript
function filterValidRelays(data) {
  if (!data.relays || !Array.isArray(data.relays)) return data;
  
  return {
    ...data,
    relays: data.relays.filter(url => {
      try {
        // Check protocol
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
          return false;
        }
        
        // Check URL validity
        const parsedUrl = new URL(url);
        
        // Check for credentials (potential security risk)
        if (parsedUrl.username || parsedUrl.password) {
          return false;
        }
        
        return true;
      } catch (error) {
        // Invalid URL format
        return false;
      }
    })
  };
}

// Usage
const decodedProfile = decodeProfile(nprofileString);
const safeProfile = filterValidRelays(decodedProfile);
```

# NIP-19 Implementation

This directory contains the implementation of NIP-19, which defines encoding formats used to represent Nostr entities as strings. These entity encodings are known as Bech32 entities and are represented using Bech32 encoding.

## Supported NIP-19 Entities

The implementation supports the following NIP-19 entities:

- `npub`: Public key
- `nsec`: Private key
- `note`: Note ID (event ID)
- `nprofile`: Profile with pubkey and optional relays
- `nevent`: Event with ID and optional relays, author, and kind
- `naddr`: Address for a replaceable event with identifier (d tag), pubkey, kind, and optional relays

## Security Features

This implementation includes several important security measures:

1. **Relay URL Validation**: All relay URLs are validated during encoding to ensure they use the correct websocket protocol (`ws://` or `wss://`) and have a valid URL format. This prevents injection attacks through malformed relay URLs.

2. **Size Limits**: To prevent denial of service attacks, the implementation enforces reasonable size limits on various components:
   - Maximum of 20 TLV entries (reduced from 100 for better security)
   - Maximum relay URL length of 512 characters
   - Maximum identifier length of 1024 characters  
   - Default bech32 data limit of 5000 bytes

3. **Error Handling**: Comprehensive error handling ensures that invalid inputs are rejected with clear error messages.

## Decoding Behavior

The implementation follows the Nostr specification by being somewhat permissive during decoding:

- Invalid relay URLs are accepted during decoding but generate warnings in the console
- ⚠️ **Security Note**: You should always filter out invalid relay URLs after decoding
- All required fields are strictly validated
- Unknown TLV types are ignored, as specified by NIP-19

## Usage Examples

```typescript
import { 
  encodePublicKey, decodePublicKey,
  encodeProfile, decodeProfile,
  encodeEvent, decodeEvent,
  encodeAddress, decodeAddress
} from './index';

// Basic npub encoding/decoding
const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const npub = encodePublicKey(pubkey);
console.log(npub); // npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s
const decodedPubkey = decodePublicKey(npub);

// Profile with relays
const profile = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['wss://relay.example.com', 'wss://another.relay.com']
};
const nprofile = encodeProfile(profile);
const decodedProfile = decodeProfile(nprofile);

// Filter invalid relay URLs after decoding to ensure security
function filterInvalidRelays(data) {
  if (!data.relays || data.relays.length === 0) return data;
  
  const isValidRelayUrl = (url) => {
    try {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
      const parsedUrl = new URL(url);
      if (parsedUrl.username || parsedUrl.password) return false;
      return true;
    } catch (error) {
      return false;
    }
  };
  
  return { ...data, relays: data.relays.filter(isValidRelayUrl) };
}

// Apply the filtering to get a safe profile
const safeProfile = filterInvalidRelays(decodedProfile);

// Event with relays and author
const event = {
  id: '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d',
  relays: ['wss://relay.example.com'],
  author: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  kind: 1
};
const nevent = encodeEvent(event);
const decodedEvent = decodeEvent(nevent);
const safeEvent = filterInvalidRelays(decodedEvent);

// Address for a replaceable event
const address = {
  identifier: 'test',
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  kind: 1,
  relays: ['wss://relay.example.com']
};
const naddr = encodeAddress(address);
const decodedAddress = decodeAddress(naddr);
const safeAddress = filterInvalidRelays(decodedAddress);
``` 