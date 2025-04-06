# NIP-57: Lightning Zaps Examples

This directory contains examples demonstrating the usage of SNSTR's implementation of [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md), which defines a protocol for recording Lightning Network payments (zaps) on Nostr.

## Examples

### Basic Example

The [basic-example.ts](./basic-example.ts) demonstrates:
- Creating and signing zap requests
- Creating and validating zap receipts
- Working with zap splits

Run it with:

```bash
npm run example:nip57
```

### ZapClient Example with Real Signet Lightning Address

The [zap-client-example.ts](./zap-client-example.ts) demonstrates:
- Using the `NostrZapClient` class for a more intuitive API
- Fetching real bolt11 invoices from a signet Lightning address
- Calculating statistics on zaps
- Working with zap splits
- Lightning address support (`user@domain.com` format)

Run it with:

```bash
npm run example:nip57:client
```

### Invoice Validation Example

The [invoice-validation-example.ts](./invoice-validation-example.ts) demonstrates:
- The security features of NIP-57
- How description hash validation works
- How to prevent tampering in zap receipts

Run it with:

```bash
npm run example:nip57:validation
```

### LNURL Server Simulation

The [lnurl-server-simulation.ts](./lnurl-server-simulation.ts) demonstrates:
- How a LNURL server processes zap requests
- How to generate and validate zap receipts
- The complete protocol flow

Run it with:

```bash
npm run example:nip57:lnurl
```

## What is NIP-57?

NIP-57 defines a standardized way to record Lightning Network payments (zaps) between Nostr users. It uses two event types:

1. **Zap Request (kind 9734)**: Created by a sender to request a Lightning invoice from a recipient's LNURL server
2. **Zap Receipt (kind 9735)**: Created by a recipient's LNURL server after a successful payment

Zaps can be directed to:
- Specific users (via their profile)
- Specific posts/events
- Special events (like parameterized replaceable events)

Zaps can also be split between multiple recipients using the `zap` tag.

## Protocol Flow

1. Sender finds recipient's LNURL from their profile or post
2. Sender creates a zap request
3. Sender sends the zap request to the recipient's LNURL server
4. LNURL server returns a Lightning invoice
5. Sender pays the invoice
6. LNURL server creates and publishes a zap receipt
7. Clients can validate and display the zap receipt

## Lightning Address Support

This implementation supports standard Lightning addresses in the format `user@domain.com`, which are automatically converted to the required `https://domain.com/.well-known/lnurlp/user` LNURL endpoint. The examples demonstrate this using a signet Lightning address (`snstrtest@vlt.ge`) which allows testing with real bolt11 invoices but without spending real money.

## Anonymous Zaps

NIP-57 supports anonymous zaps by using a dummy public key for the zap request and including the real sender's public key in a `P` tag. This allows the recipient to know who sent the zap while not revealing this information to relays or other users.

## Zap Splits

Events can include multiple `zap` tags to indicate that zap amounts should be split between multiple recipients. Each recipient can have a weight specified, determining what percentage of the total amount they receive.

Example:

```typescript
const event = {
  // ...other event properties
  tags: [
    ['zap', 'pubkey1', 'wss://relay1.com', '1'],  // 1/6 of zap amount
    ['zap', 'pubkey2', 'wss://relay2.com', '2'],  // 2/6 of zap amount
    ['zap', 'pubkey3', 'wss://relay3.com', '3']   // 3/6 of zap amount
  ],
};
```

## Advanced Usage

For more complex scenarios:

- To implement a complete LNURL server that can receive zaps, see the NIP-57 specification for server-side requirements
- For integrating with real Lightning Network wallets, you would need to integrate with Lightning APIs (e.g., LND, c-lightning)
- For bolt11 invoice creation and parsing, additional libraries like bolt11 would be needed 