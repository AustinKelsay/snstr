# NIP-01 Examples

This directory contains examples for the NIP-01 implementation, which covers the core protocol functionality of Nostr.

## Overview

NIP-01 is the foundational specification for Nostr, defining the basic protocol flow, event format, and relay communication. These examples demonstrate different aspects of the core protocol functionality.

## Running Examples

### Event-related Examples

```bash
# Event ordering demonstration
npm run example:nip01:event:ordering

# Addressable events (kinds 30000-39999)
npm run example:nip01:event:addressable

# Replaceable events (kinds 0, 3, 10000-19999)
npm run example:nip01:event:replaceable
```

### Relay-related Examples

```bash
# Relay connection with timeout handling
npm run example:nip01:relay:connection

# RelayPool multi-relay demo
npm run example:nip01:relay:pool

# Filter types and subscription handling
npm run example:nip01:relay:filters

# Automatically close subscriptions
npm run example:nip01:relay:auto-close

# Relay reconnection with exponential backoff
npm run example:nip01:relay:reconnect
```

### Validation Examples

```bash
# Event validation flow
npm run example:nip01:validation  # Located in examples/client/validation-flow.ts
```

## Directory Structure

- `/event` - Event-related examples

  - `event-ordering-demo.ts` - Demonstrates event ordering with timestamp and lexicographic ordering
  - `addressable-events.ts` - Shows how to work with addressable events (kinds 30000-39999)
  - `replaceable-events.ts` - Demonstrates replaceable events (kinds 0, 3, 10000-19999)

- `/relay` - Relay-related examples

  - `relay-connection.ts` - Connection management with error handling and timeout configuration
  - `filter-types.ts` - Different filter types for subscription and event retrieval
  - `auto-unsubscribe-example.ts` - Automatic subscription cleanup on EOSE or timeout
  - `relay-reconnect.ts` - Relay reconnection with exponential backoff strategies
  - `relay-pool.ts` - Manage multiple relays with RelayPool

- Related examples in other directories:
  - `examples/client/validation-flow.ts` - NIP-01 event validation process

## Key Concepts

### Event Concepts

- **Event Creation** - How to create and sign events
- **Event Ordering** - How to sort events by timestamp and ID
- **Addressable Events** - Content-addressed events for structured data (kinds 30000-39999)
- **Replaceable Events** - Events that can be updated/replaced (kinds 0, 3, 10000-19999)

### Relay Concepts

- **Connection Management** - How to establish and manage relay connections
- **Subscription Filters** - How to create effective subscription filters
- **Reconnection Strategies** - How to handle disconnections and implement reconnection logic
- **Error Handling** - How to handle various relay error conditions

## Advanced Usage

The examples in this directory demonstrate both basic and advanced usage patterns, including:

- Working with multiple relays simultaneously
- Creating complex filter combinations
- Handling event ordering with non-monotonic timestamps
- Implementing proper reconnection backoff strategies
- Managing subscription lifecycles
