# NIP-17: Direct Messaging

This module implements a basic version of [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) using NIP-44 encryption and NIP-59 wrapping. It allows you to create encrypted direct messages that are wrapped in a kind `1059` event for delivery to a single recipient.

## Overview

- Creates unsigned `kind 14` rumors for the message content
- Wraps the rumor in a signed `kind 13` seal encrypted with the receiver's key
- Finally wraps the seal in a signed `kind 1059` gift wrap using a random ephemeral key
- Timestamps are randomized up to two days in the past
- Decryption verifies the seal signature and sender pubkey to prevent impersonation

## Basic Usage

```typescript
import { createDirectMessage, decryptDirectMessage } from 'snstr/nip17';
import { generateKeypair } from 'snstr';

const alice = await generateKeypair();
const bob = await generateKeypair();

const wrapped = await createDirectMessage('hello', alice.privateKey, bob.publicKey);
const message = decryptDirectMessage(wrapped, bob.privateKey);
console.log(message.content); // "hello"
```

See the example in `examples/nip17` for a more complete demonstration.
