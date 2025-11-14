# NIP-02 Examples: Contact Lists

This directory contains examples demonstrating how to work with Nostr NIP-02, which defines contact lists (follow lists) using `kind: 3` events.

## Examples

- **`nip02-demo.ts`**: 
  - Demonstrates how to fetch a specific user's contact list (the pubkeys they follow).
  - Shows how to find users who are following a specific pubkey (their followers).
  - Utilizes `kind: 3` events and `p` tags as per NIP-02.
- **`pubkey-normalization-example.ts`**:
  - Normalizes contact list entries by trimming whitespace, lowercasing hex strings, and removing duplicates.
  - Demonstrates how to validate malformed or mixed-case keys before publishing updates.
  - Highlights best practices for rejecting unsafe input early.

## Running the Example

To run the follows and followers example, use the following npm script:

```bash
npm run example:nip02
```

This script will:
1. Connect to predefined relays.
2. Fetch and display the contact list for the `USER_PUBKEY` defined in the script.
3. Fetch and display the pubkeys of users who have the `USER_PUBKEY` in their contact list (i.e., followers).

To run the normalization helper, use:

```bash
npm run example:nip02:pubkey-normalization
```

This script will normalize a sample list, report invalid entries, and show how to merge cleaned data back into a kind 3 event.

## Key Concepts Demonstrated

- **Fetching a User's Follow List (Contacts)**:
  - Subscribing to `kind: 3` events authored by a specific `pubkey`.
  - Using `limit: 1` because `kind: 3` events are replaceable, and only the latest version is needed.
  - Parsing `p` tags from the event to identify followed pubkeys.

- **Finding a User's Followers**:
  - Subscribing to `kind: 3` events that include a specific `pubkey` in a `#p` tag filter.
  - The `author` of such an event is considered a follower.

- **Event Handling**: Setting up handlers for connection, errors, and notices from relays.
- **Subscription Management**: Subscribing to relays and unsubscribing when data is received or on timeout.
- **Asynchronous Operations**: Using Promises to manage fetching data from relays. 
- **Input Sanitization** (normalization example): Enforcing consistent pubkey formats before storing or broadcasting contact events.
