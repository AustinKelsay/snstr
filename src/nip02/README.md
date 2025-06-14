# NIP-02: Contact List and Petnames

This directory contains the implementation for NIP-02, which defines a format for users to publish their contact list (follows) as a Nostr event of kind 3. Each contact in the list can include the user's public key, a recommended relay URL, and a petname for that user.

## Overview

NIP-02 events allow users to share and update contact lists. This module
provides helper functions for creating and parsing these events while
supporting optional relay URLs and petnames for each contact.

## Key Features

- Defines a `Contact` interface: `{ pubkey: string; relayUrl?: string; petname?: string; }`.
- `createContactListEvent(contacts: Contact[], content?: string)`: Creates `kind 3` events to publish a contact list. It populates "p" tags with the pubkey, an optional relay URL, and an optional petname.
- `parseContactsFromEvent(event: ContactsEvent, options?)`: Parses `kind 3` events to retrieve an array of `Contact` objects, extracting the pubkey, relay URL, and petname from "p" tags. Supports optional warning handling.
- `parseContactsFromEventWithWarnings(event: ContactsEvent, logger?)`: Convenience function that always returns both contacts and parsing warnings.
- Robust error handling with detailed warning messages for invalid data (relay URLs, public keys, duplicates).
- Optional external logger integration for warning handling.
- The `content` field of the kind 3 event can be used for arbitrary data or legacy petname JSON, but this implementation prioritizes petnames from tags.

## Basic Usage

```typescript
import {
  createContactListEvent,
  parseContactsFromEvent,
  parseContactsFromEventWithWarnings,
  Contact,
  Logger,
} from './index';
import { NostrEvent /*, signEvent */ } from 'snstr'; // Assuming signEvent and NostrEvent types

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

// Example: Parsing a contact list event (basic usage)
const receivedEvent: NostrEvent = {
  kind: 3,
  pubkey: 'xyz789...',
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['p', 'abcdef123456...', 'wss://relay.example.com', 'Alice'],
    ['p', 'fedcba654321...', '', 'Bob'], // Relay URL can be empty string if petname is present
    ['p', '123456abcdef...', 'wss://another.relay.org'],
    ['p', 'invalid-pubkey', 'wss://relay.com'], // Invalid pubkey - will be skipped
    ['p', 'abcdef123456...', 'invalid-url'], // Invalid relay URL - will generate warning
    ['e', 'someeventid'], // Other tags are ignored by parseContactsFromEvent
  ],
  content: 'Some content',
  id: 'eventid...',
  sig: 'eventsig...',
};

if (receivedEvent.kind === 3) {
  // Basic parsing (warnings are ignored)
  const contacts = parseContactsFromEvent(receivedEvent as any);
  console.log('Parsed Contacts:', contacts);
  
  // Parsing with custom logger
  const customLogger: Logger = {
    warn: (message: string, ...args: any[]) => {
      console.warn(`[Custom Logger] ${message}`, ...args);
    }
  };
  
  const contactsWithLogger = parseContactsFromEvent(receivedEvent as any, { 
    logger: customLogger 
  });
  
  // Parsing with warnings returned
  const result = parseContactsFromEvent(receivedEvent as any, { 
    returnWarnings: true 
  });
  console.log('Contacts:', result.contacts);
  console.log('Warnings:', result.warnings);
  
  // Convenient function that always returns warnings
  const resultWithWarnings = parseContactsFromEventWithWarnings(
    receivedEvent as any,
    customLogger
  );
  console.log('All warnings:', resultWithWarnings.warnings);
}
```

## Implementation Details

- The `ContactListEvent` interface (kind 3) extends the base `NostrEvent`.
- "p" tags are structured as `["p", <pubkey_hex>, <recommended_relay_url_or_empty_string>, <petname_or_empty_string>]`.
  - If `recommended_relay_url` is not provided but `petname` is, an empty string is used for the relay URL in the tag.
  - When parsing, empty strings for `relayUrl` or `petname` in tags result in these fields being `undefined` in the `Contact` object.
- Pubkey validation ensures the pubkey is a 64-character hex string. Invalid pubkeys are skipped with optional warning generation.
- Relay URL validation ensures the URL starts with `ws://` or `wss://`. Invalid relay URLs are ignored (the `relayUrl` field will be `undefined`) with optional warning generation.
- Duplicate pubkeys are detected and skipped to prevent contact list pollution.
- Warning handling can be configured via:
  - **Silent mode** (default): Warnings are collected but not output
  - **Logger mode**: Warnings are passed to a custom logger function
  - **Return warnings mode**: Warnings are returned alongside parsed contacts
- Warning types include: `invalid_relay_url`, `invalid_pubkey`, and `duplicate_pubkey`, each with detailed context information.

## Security Considerations

- Input sanitization for petnames is recommended if they are to be displayed directly in HTML to prevent XSS attacks.
- When processing relay URLs from events, validate them to ensure they are well-formed and potentially check against a whitelist if connecting automatically. 