# NIP-02: Contact List and Petnames

This directory contains the implementation for NIP-02, which defines a format for users to publish their contact list (follows) as a Nostr event of kind 3. Each contact in the list can include the user's public key, a recommended relay URL, and a petname for that user.

## Key Features

- Defines a `Contact` interface: `{ pubkey: string; relayUrl?: string; petname?: string; }`.
- `createContactListEvent(contacts: Contact[], content?: string)`: Creates `kind 3` events to publish a contact list. It populates "p" tags with the pubkey, an optional relay URL, and an optional petname.
- `parseContactsFromEvent(event: ContactsEvent)`: Parses `kind 3` events to retrieve an array of `Contact` objects, extracting the pubkey, relay URL, and petname from "p" tags.
- The `content` field of the kind 3 event can be used for arbitrary data or legacy petname JSON, but this implementation prioritizes petnames from tags.

## Basic Usage

```typescript
import {
  createContactListEvent,
  parseContactsFromEvent,
  Contact,
} from './index'; // Adjust path as necessary
import { NostrEvent /*, signEvent */ } from '../types/nostr'; // Assuming signEvent and NostrEvent types

// Example: Creating a contact list event
const myContacts: Contact[] = [
  {
    pubkey: 'abcdef123456...',
    relayUrl: 'wss://relay.example.com',
    petname: 'Alice',
  },
  {
    pubkey: 'fedcba654321...',
    petname: 'Bob',
  },
  {
    pubkey: '123456abcdef...',
    relayUrl: 'wss://another.relay.org',
  },
];

const unsignedContactEvent = createContactListEvent(myContacts, "My contact list notes");

// const privateKey = '...'; // User's private key
// const signedContactEvent = await signEvent(unsignedContactEvent, privateKey);
// console.log('Signed Contact Event:', signedContactEvent);

// Example: Parsing a contact list event
const receivedEvent: NostrEvent = {
  kind: 3,
  pubkey: 'xyz789...',
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['p', 'abcdef123456...', 'wss://relay.example.com', 'Alice'],
    ['p', 'fedcba654321...', '', 'Bob'], // Relay URL can be empty string if petname is present
    ['p', '123456abcdef...', 'wss://another.relay.org'],
    ['e', 'someeventid'], // Other tags are ignored by parseContactsFromEvent
  ],
  content: 'Some content',
  id: 'eventid...',
  sig: 'eventsig...',
};

if (receivedEvent.kind === 3) {
  // Assuming type assertion or a type guard if needed for ContactsEvent
  const contacts = parseContactsFromEvent(receivedEvent as any); // Use 'as ContactsEvent' if available and compatible
  console.log('Parsed Contacts:', contacts);
  // Output would be:
  // [
  //   { pubkey: 'abcdef123456...', relayUrl: 'wss://relay.example.com', petname: 'Alice' },
  //   { pubkey: 'fedcba654321...', petname: 'Bob' }, // relayUrl would be undefined if empty string in tag
  //   { pubkey: '123456abcdef...', relayUrl: 'wss://another.relay.org' }
  // ]
}
```

## Implementation Details

- The `ContactListEvent` interface (kind 3) extends the base `NostrEvent`.
- "p" tags are structured as `["p", <pubkey_hex>, <recommended_relay_url_or_empty_string>, <petname_or_empty_string>]`.
  - If `recommended_relay_url` is not provided but `petname` is, an empty string is used for the relay URL in the tag.
  - When parsing, empty strings for `relayUrl` or `petname` in tags result in these fields being `undefined` in the `Contact` object.
- Basic validation (hex, length 64) is performed for pubkeys. Relay URL validation is noted as a TODO.

## Security Considerations

- Input sanitization for petnames is recommended if they are to be displayed directly in HTML to prevent XSS attacks.
- When processing relay URLs from events, validate them to ensure they are well-formed and potentially check against a whitelist if connecting automatically. 