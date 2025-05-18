# NIP-02 Tests: Contact Lists

This directory contains tests for the NIP-02 (Contact List) implementation in the SNSTR library.

## Components Tested

- **Kind 3 Event Creation**: Verifying the correct creation of `kind: 3` events for contact lists.
- **Event Validation**: Ensuring `kind: 3` events adhere to NIP-02 recommendations (e.g., usage of `p` tags).
- **Fetching Follows**: Testing the logic to retrieve the list of pubkeys a user follows.
- **Finding Followers**: Testing the logic to identify which users follow a given pubkey.
- **Replaceable Event Handling**: Confirming that only the latest `kind: 3` event for a user is considered their current contact list.

## Running the Tests

To run the NIP-02 tests:

```bash
npm run test:nip02
```

## Test Files

- `nip02.test.ts`: Contains tests for creating, validating, and processing NIP-02 contact list events. 