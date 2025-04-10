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
```

## Implementation Details

- Uses the `@scure/base` library for Bech32 encoding and decoding
- Implements TLV (Type-Length-Value) encoding for complex entities
- Includes robust validation for relay URLs and other entity components
- Handles large bech32 strings with custom limits
- Optimized error handling with detailed error messages

## Security Considerations

- Always validate entities before acting on them
- TLV values are size-constrained to prevent DoS attacks
- Use the explicit decoder functions for type-safety rather than the generic decode function
- Treat private keys (`nsec`) with appropriate security measures 