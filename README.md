# SNSTR - Secure Nostr Software Toolkit for Renegades

![SNSTR Logo](https://raw.githubusercontent.com/AustinKelsay/snstr/main/.github/images/snstr.jpg)

[![npm version](https://badge.fury.io/js/snstr.svg)](https://www.npmjs.com/package/snstr)

### Beta Release 🚧

SNSTR is a secure, lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

*SNSTR is fierce. Fierce in its speed, in its flexibility, and most of all its security.*

*SNSTR is steadfast, ever persistent, watching, waiting.*

*SNSTR has vengeance on its mind.*

*SNSTR is a Nostr Development Kit for people that go swimming in jeans*

**⚠️ Important**: This library is in beta testing. While mostly stable, some features may still undergo changes. We encourage users to test thoroughly and report any issues or unexpected behavior.

## Table of Contents

- [Features](#features)
- [Supported NIPs](#supported-nips)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuring Rate Limits](#configuring-rate-limits)
- [Documentation](#documentation)
- [Examples](#examples)
- [Testing](#testing)
- [Command Reference](#command-reference)
- [Development](#development)
- [Security](#security)
- [Next.js / Turbopack Guidance](#nextjs--turbopack-guidance)

## Features

![SNSTR Starter Pack](https://raw.githubusercontent.com/AustinKelsay/snstr/main/.github/images/snstr-starter-pack.png)

### Core Functionality

- Event creation and signing with comprehensive validation
- Relay connections with automatic reconnect
- **RelayPool for multi-relay management** - Efficient connection pooling, automatic failover, and batch operations
- **Cross-relay event querying** - `fetchMany()` and `fetchOne()` methods for aggregated event retrieval
- Filter-based subscriptions
- Support for replaceable events (kinds 0, 3, 10000-19999)
- Support for addressable events (kinds 30000-39999)

### Advanced Features

- Encrypted messaging with both NIP-04 (AES-CBC) and NIP-44 (ChaCha20+HMAC)
- Identity verification with NIP-05 DNS-based identifiers
- Browser extension integration via NIP-07
- Remote signing capability via NIP-46
- Automatic subscription cleanup with `autoClose` option
- Lightning Zaps integration via NIP-57
- Threaded conversations via NIP-10
- Wallet connection via NIP-47
- Relay list metadata via NIP-65
- Built-in ephemeral relay for testing and development

## Supported NIPs

SNSTR currently implements the following Nostr Implementation Possibilities (NIPs):

- **NIP-01**: Basic protocol functionality with comprehensive event validation
- **NIP-02**: Contact List events and interactions (Kind 3)
- **NIP-04**: Encrypted direct messages using AES-CBC
- **NIP-05**: DNS identifier verification and relay discovery
- **NIP-07**: Browser extension integration for key management
- **NIP-09**: Event deletion requests for removing published events
- **NIP-10**: Text notes and threading metadata
- **NIP-11**: Relay Information Document for discovering relay capabilities
- **NIP-17**: Gift wrapped direct messages using NIP-44 encryption
- **NIP-19**: Bech32-encoded entities for human-readable identifiers
- **NIP-21**: URI scheme for nostr links
- **NIP-29**: Relay-based groups, membership, roles, and group metadata
- **NIP-42**: Client authentication to relays
- **NIP-44**: Improved encryption with ChaCha20 and HMAC-SHA256 authentication
- **NIP-46**: Remote signing (bunker) support for secure key management
- **NIP-47**: Nostr Wallet Connect for secure wallet communication
- **NIP-50**: Search capability via `search` subscription filters
- **NIP-56**: Reporting Nostr Events, users, and other entities
- **NIP-57**: Lightning Zaps protocol for Bitcoin payments via Lightning
- **NIP-65**: Relay List metadata for read/write relay preferences
- **NIP-66**: Relay discovery and liveness monitoring
- **NIP-70**: Protected-event tag helpers for authenticated-author publishing
- **NIP-86**: Relay management requests with authenticated HTTP calls

For detailed information on each implementation, see the corresponding directories in the `src/` directory (e.g., `src/nip01/`, `src/nip04/`, etc.).

## Installation

```bash
# Install from npm (beta release)
npm install snstr

# Or clone and build locally for development:
git clone https://github.com/AustinKelsay/snstr.git
cd snstr
npm install
npm run build
```

### React Native / Expo

- Works out of the box — no Node polyfills are required.
- Add secure RNG once at app startup (required by various features):
  ```ts
  import 'react-native-get-random-values';
  ```
- NIP-04 now works on Web and React Native with the exact same API as Node:
  ```ts
  import { encryptNIP04, decryptNIP04 } from 'snstr';
  const c = encryptNIP04(alicePriv, bobPub, 'hello');
  const p = decryptNIP04(bobPriv, alicePub, c);
  ```
- Prefer NIP-44 for new apps; keep NIP-04 for legacy compatibility.

## Next.js / Turbopack Guidance

snstr ships both CommonJS and ESM builds and provides a dedicated web entry that avoids Node-only modules.

- Prefer the default import in Next.js; do not add `snstr` to `transpilePackages` unless necessary.
- If you must transpile third-party packages, rely on the ESM import condition we publish and avoid forcing CJS transforms of `snstr`.
- At client-only boundaries, dynamic `import('snstr')` is a safe workaround for older setups.

Resolution summary:

- Node (CJS): `require('snstr')` → `./dist/src/index.js`.
- Node/ESM & modern bundlers: `import 'snstr'` → `./dist/esm/src/index.js`.
- Browsers/React Native: `import 'snstr'` under `browser`/`react-native` conditions → `./dist/esm/src/entries/index.web.js`.

This dual build removes getter-based CJS re-exports from browser bundles and avoids interop issues observed with Turbopack.

## Testing utilities

`NostrRelay` is a Node-only, in-memory relay for integration tests and runnable
examples. Import it from the supported testing subpath:

```typescript
import { NostrRelay } from "snstr/testing";

const relay = new NostrRelay(0);
await relay.start();
try {
  // Exercise a client against relay.url.
} finally {
  await relay.close();
}
```

The testing subpath is supported during the 0.x release line, but it is not a
production relay server and may evolve between minor 0.x releases. The legacy
`snstr/utils/ephemeral-relay` subpath remains available for 0.x compatibility.
`close()` resolves only after owned transports and observable client disconnect
coordination complete; callers should not add fixed teardown delays.

## Basic client usage

```typescript
import { Nostr, RelayEvent } from "snstr";

async function main() {
  // Initialize with relays and connection timeout
  const client = new Nostr(["wss://relay.nostr.band"]);

  // Generate keypair
  const keys = await client.generateKeys();

  // Connect to relays
  await client.connectToRelays();

  // Set up event handlers
  client.on(RelayEvent.Connect, (relay) => {
    console.log(`Connected to ${relay}`);
  });

  // Publish a note
  const note = await client.publishTextNote("Hello, Nostr!");
  console.log(`Published note with ID: ${note?.id}`);

  // Subscribe to events
  const subIds = client.subscribe(
    [{ kinds: [1], limit: 10 }], // Filter for text notes
    (event, relay) => {
      console.log(`Received event from ${relay}:`, event);
    },
    undefined,
    { autoClose: true, eoseTimeout: 5000 },
  );

  // Query events from all relays
  const manyEvents = await client.fetchMany(
    [{ kinds: [1], authors: ["pubkey"], limit: 10 }],
    { maxWait: 5000 }
  );
  console.log(`Found ${manyEvents.length} events`);

  // Get the most recent event from all relays
  const latestEvent = await client.fetchOne(
    [{ kinds: [1], authors: ["pubkey"] }],
    { maxWait: 3000 }
  );
  if (latestEvent) {
    console.log("Latest event:", latestEvent.content);
  }

  // Cleanup
  setTimeout(() => {
    client.unsubscribe(subIds);
    client.disconnectFromRelays();
  }, 10000);
}

main().catch(console.error);
```

### Configuring Rate Limits

SNSTR includes built-in rate limiting to prevent abuse. Configure custom limits when creating a client:

```typescript
import { Nostr } from "snstr";

const client = new Nostr(["wss://relay.nostr.band"], {
  rateLimits: {
    subscribe: { limit: 100, windowMs: 60000 }, // 100 per minute (default: 50)
    publish: { limit: 200, windowMs: 60000 },   // 200 per minute (default: 100)
    fetch: { limit: 500, windowMs: 60000 }      // 500 per minute (default: 200)
  }
});

// Update limits dynamically
client.updateRateLimits({ subscribe: { limit: 150, windowMs: 30000 } });
```

See [NIP-01 documentation](src/nip01/README.md#rate-limiting) for detailed configuration options.

### Using RelayPool for Multi-Relay Management

```typescript
import { RelayPool, generateKeypair, createEvent } from "snstr";

async function relayPoolExample() {
  // Initialize RelayPool with multiple relays
  const pool = new RelayPool([
    "wss://relay.nostr.band",
    "wss://nos.lol", 
    "wss://relay.damus.io"
  ]);

  // Generate keypair
  const keys = await generateKeypair();

  // Publish to multiple relays simultaneously
  const event = createEvent({
    kind: 1,
    content: "Hello from RelayPool!",
    tags: [],
    privateKey: keys.privateKey
  });

  const publishPromises = pool.publish(
    ["wss://relay.nostr.band", "wss://nos.lol"], 
    event
  );
  const results = await Promise.all(publishPromises);

  // Subscribe across multiple relays with automatic failover
  const subscription = await pool.subscribe(
    ["wss://relay.nostr.band", "wss://nos.lol", "wss://relay.damus.io"],
    [{ kinds: [1], limit: 10 }],
    (event, relayUrl) => {
      console.log(`Event from ${relayUrl}:`, event.content);
    },
    () => {
      console.log("All relays finished sending stored events");
    }
  );

  // Query events synchronously from multiple relays
  const events = await pool.querySync(
    ["wss://relay.nostr.band", "wss://nos.lol"],
    { kinds: [1], limit: 5 },
    { timeout: 10000 }
  );
  console.log(`Retrieved ${events.length} events`);

  // Cleanup
  subscription.close();
  await pool.close();
}

relayPoolExample().catch(console.error);
```

### Event Querying with fetchMany and fetchOne

```typescript
import { Nostr } from "snstr";

async function queryExample() {
  const client = new Nostr(["wss://relay.nostr.band", "wss://nos.lol"]);
  await client.connectToRelays();

  // Fetch multiple events from all connected relays
  const events = await client.fetchMany(
    [
      { kinds: [1], authors: ["pubkey1", "pubkey2"], limit: 20 },
      { kinds: [0], authors: ["pubkey1"] } // Profile metadata
    ],
    { maxWait: 5000 } // Wait up to 5 seconds
  );
  
  console.log(`Retrieved ${events.length} events from all relays`);
  
  // Fetch the most recent single event
  const latestNote = await client.fetchOne(
    [{ kinds: [1], authors: ["pubkey1"] }],
    { maxWait: 3000 }
  );
  
  if (latestNote) {
    console.log("Latest note:", latestNote.content);
  }

  client.disconnectFromRelays();
}

queryExample().catch(console.error);
```

For more examples including encryption, relay management, and NIP-specific features, see the [examples directory](./examples/README.md).

### Custom WebSocket Implementation

SNSTR relies on `websocket-polyfill` when running in Node.js. If you want to provide your own `WebSocket` class (for example when using a different runtime), you can set it with `useWebSocketImplementation`:

```typescript
import { useWebSocketImplementation } from "snstr";
import WS from "isomorphic-ws";

useWebSocketImplementation(WS);
```

You can also reset back to the default implementation:

```typescript
import { resetWebSocketImplementation } from "snstr";

resetWebSocketImplementation();
```

**Note**: To run the custom WebSocket example (`npm run example:custom-websocket`), you need to install a WebSocket package first:

```bash
# Install the ws package (used in the example)
npm install ws
npm install --save-dev @types/ws

# Or use isomorphic-ws for cross-platform compatibility
npm install isomorphic-ws
```

## Documentation

The project is organized with detailed documentation for different components:

#### Core Documentation

- **[Test Documentation](tests/README.md)**: Overview of test organization and execution
- **[Examples Documentation](examples/README.md)**: Complete guide to examples for all features

#### NIP Documentation

- **[NIP-01](src/nip01/README.md)**: Basic protocol functionality
- **[NIP-02](src/nip02/README.md)**: Contact List recommendation
- **[NIP-04](src/nip04/README.md)**: Encrypted direct messages
- **[NIP-05](src/nip05/README.md)**: DNS identifier verification
- **[NIP-07](src/nip07/README.md)**: Browser extension integration
- **[NIP-09](src/nip09/README.md)**: Event deletion requests
- **[NIP-10](src/nip10/README.md)**: Text notes and threads
- **[NIP-11](src/nip11/README.md)**: Relay information document
- **[NIP-17](src/nip17/README.md)**: Gift wrapped direct messages
- **[NIP-19](src/nip19/README.md)**: Bech32-encoded entities
- **[NIP-21](src/nip21/README.md)**: URI scheme for nostr links
- **[NIP-44](src/nip44/README.md)**: Versioned encryption
- **[NIP-46](src/nip46/README.md)**: Remote signing protocol
- **[NIP-47](src/nip47/README.md)**: Nostr Wallet Connect
- **[NIP-50](src/nip50/README.md)**: Search capability
- **[NIP-57](src/nip57/README.md)**: Lightning Zaps
- **[NIP-65](src/nip65/README.md)**: Relay List metadata
- **[NIP-66](src/nip66/README.md)**: Relay discovery and liveness monitoring

#### Standardization Guidelines

- **[NIP Implementation Guide](src/NIP_STANDARDIZATION.md)**: Standards for implementing NIPs
- **[Test Standardization](tests/TEST_STANDARDIZATION.md)**: Guide for writing standardized tests
- **[Example Standardization](examples/EXAMPLE_STANDARDIZATION.md)**: Guide for creating standardized examples

## Examples

Runnable examples cover core usage, NIP-specific flows, and curated groups. See the [examples guide](./examples/README.md) for walkthroughs and the [Command Reference](#command-reference) for the canonical root command inventory.

## Testing

The Jest suite uses an ephemeral relay where possible so normal test runs avoid external services. See the [testing guide](./tests/README.md) for organization and methodology, and use the [Command Reference](#command-reference) for every supported test command.

## Command Reference

The `scripts` object in [package.json](./package.json) is the executable source of truth. This section is its single authoritative human-facing inventory; run these commands from the repository root. `npm run commands:verify` guards exact command duplication, recursively duplicated grouped work, missing group targets, cycles, stale literal Markdown references, and command-definition drift in this table.

### Build

| Command | Definition |
| --- | --- |
| `npm run build` | `npx rimraf dist && npm run build:cjs && npm run build:esm` |
| `npm run build:cjs` | `tsc -p tsconfig.build.json` |
| `npm run build:esm` | `tsc -p tsconfig.esm.json && node scripts/postbuild-esm.js` |
| `npm run pack:verify` | `node scripts/verify-pack.js` |
| `npm run package-manager:verify` | `node scripts/verify-package-manager.js` |
| `npm run commands:verify` | `node scripts/verify-commands.js` |
| `npm run prepack` | `npm run build && npm run pack:verify` |
| `npm run build:examples` | `tsc -p examples/tsconfig.json` |

### Code Quality

| Command | Definition |
| --- | --- |
| `npm run lint` | `eslint . --ext .ts` |
| `npm run format` | `prettier --write "src/**/*.ts" "tests/**/*.ts" "examples/**/*.ts"` |

### Primary Tests

| Command | Definition |
| --- | --- |
| `npm run test` | `jest` |
| `npm run test:watch` | `jest --watch` |
| `npm run test:coverage` | `jest --coverage` |
| `npm run test:integration` | `jest tests/integration.test.ts` |

### Bun Tests

| Command | Definition |
| --- | --- |
| `npm run test:bun` | `bun test ./tests --max-concurrency 1 --timeout 30000` |
| `npm run test:bun:watch` | `bun test ./tests --watch --max-concurrency 1 --timeout 30000` |

### NIP-01 and Core Tests

| Command | Definition |
| --- | --- |
| `npm run test:nip01` | `jest tests/nip01` |
| `npm run test:nip01:event` | `jest tests/nip01/event` |
| `npm run test:nip01:relay` | `jest tests/nip01/relay` |
| `npm run test:event` | `jest tests/nip01/event/event.test.ts` |
| `npm run test:event:ordering` | `jest tests/nip01/event/event-ordering.test.ts` |
| `npm run test:event:addressable` | `jest tests/nip01/event/addressable-events.test.ts` |
| `npm run test:nostr` | `jest tests/nip01/nostr.test.ts` |
| `npm run test:nip01:relay:connection` | `jest tests/nip01/relay/relay.test.ts` |
| `npm run test:nip01:relay:filter` | `jest tests/nip01/relay/filters.test.ts` |
| `npm run test:nip01:relay:reconnect` | `jest tests/nip01/relay/relay-reconnect.test.ts` |
| `npm run test:nip01:relay:pool` | `jest tests/nip01/relay/relayPool.test.ts` |
| `npm run test:nip01:relay:websocket` | `jest tests/nip01/relay/websocket-implementation.test.ts` |
| `npm run test:crypto:core` | `jest tests/utils/crypto.test.ts` |
| `npm run test:utils:relayUrl` | `jest tests/utils/relayUrl.test.ts` |

### NIP-Specific Tests

| Command | Definition |
| --- | --- |
| `npm run test:nip02` | `jest tests/nip02` |
| `npm run test:nip04` | `jest tests/nip04` |
| `npm run test:nip05` | `jest tests/nip05` |
| `npm run test:nip07` | `jest tests/nip07` |
| `npm run test:nip09` | `jest tests/nip09` |
| `npm run test:nip10` | `jest tests/nip10` |
| `npm run test:nip11` | `jest tests/nip11` |
| `npm run test:nip17` | `jest tests/nip17` |
| `npm run test:nip19` | `jest tests/nip19` |
| `npm run test:nip21` | `jest tests/nip21` |
| `npm run test:nip29` | `jest tests/nip29` |
| `npm run test:nip42` | `jest tests/nip42` |
| `npm run test:nip44` | `jest tests/nip44` |
| `npm run test:nip46` | `jest tests/nip46` |
| `npm run test:nip47` | `jest tests/nip47` |
| `npm run test:nip50` | `jest tests/nip50` |
| `npm run test:nip56` | `jest tests/nip56` |
| `npm run test:nip57` | `jest tests/nip57` |
| `npm run test:nip65` | `jest tests/nip65` |
| `npm run test:nip66` | `jest tests/nip66` |
| `npm run test:nip70` | `jest tests/nip70` |
| `npm run test:nip86` | `jest tests/nip86` |

### Test Groups

| Command | Definition |
| --- | --- |
| `npm run test:all` | `npm test` |
| `npm run test:crypto` | `jest tests/utils/crypto.test.ts tests/nip04 tests/nip44` |
| `npm run test:identity` | `jest tests/nip05 tests/nip07 tests/nip19` |
| `npm run test:protocols` | `jest tests/nip46 tests/nip47 tests/nip57` |

### Core Examples

| Command | Definition |
| --- | --- |
| `npm run example` | `ts-node examples/basic-example.ts` |
| `npm run example:verbose` | `VERBOSE=true ts-node examples/basic-example.ts` |
| `npm run example:debug` | `DEBUG=true ts-node examples/basic-example.ts` |
| `npm run example:custom-websocket` | `ts-node examples/custom-websocket-example.ts` |
| `npm run example:crypto` | `ts-node examples/crypto-demo.ts` |
| `npm run example:rate-limits` | `ts-node examples/rate-limit-configuration-example.ts` |

### NIP-01 Examples

| Command | Definition |
| --- | --- |
| `npm run example:nip01:event:ordering` | `ts-node examples/nip01/event/event-ordering-demo.ts` |
| `npm run example:nip01:event:addressable` | `ts-node examples/nip01/event/addressable-events.ts` |
| `npm run example:nip01:event:replaceable` | `ts-node examples/nip01/event/replaceable-events.ts` |
| `npm run example:nip01:relay:connection` | `ts-node examples/nip01/relay/relay-connection-example.ts` |
| `npm run example:nip01:relay:filters` | `ts-node examples/nip01/relay/filter-types-example.ts` |
| `npm run example:nip01:relay:auto-close` | `ts-node examples/nip01/relay/auto-unsubscribe-example.ts` |
| `npm run example:nip01:relay:query` | `ts-node examples/nip01/relay/relay-query-example.ts` |
| `npm run example:nip01:relay:reconnect` | `ts-node examples/nip01/relay/relay-reconnect-example.ts` |
| `npm run example:nip01:relay:pool` | `ts-node examples/nip01/relay/relay-pool-example.ts` |
| `npm run example:nip01:url-preprocessing` | `ts-node examples/nip01/url-preprocessing-example.ts` |
| `npm run example:nip01:relay:pool-url-normalization` | `ts-node examples/nip01/relay-pool-url-normalization-example.ts` |
| `npm run example:nip01:validation` | `ts-node examples/client/validation-flow.ts` |

### NIP-Specific Examples

| Command | Definition |
| --- | --- |
| `npm run example:nip02` | `ts-node examples/nip02/nip02-demo.ts` |
| `npm run example:nip02:pubkey-normalization` | `ts-node examples/nip02/pubkey-normalization-example.ts` |
| `npm run example:nip04` | `ts-node examples/nip04/direct-message.ts` |
| `npm run example:nip05` | `ts-node examples/nip05/nip05-demo.ts` |
| `npm run example:nip09` | `ts-node examples/nip09/deletion-request.ts` |
| `npm run example:nip10` | `ts-node examples/nip10/nip10-demo.ts` |
| `npm run example:nip07` | `cd examples/nip07 && npm install && npm run build && npm start` |
| `npm run example:nip07:build` | `cd examples/nip07 && npm install && npm run build` |
| `npm run example:nip07:dm` | `ts-node examples/nip07/direct-message.ts` |
| `npm run example:nip11` | `ts-node examples/nip11/relay-info-example.ts` |
| `npm run example:nip19` | `ts-node examples/nip19/nip19-demo.ts` |
| `npm run example:nip19:bech32` | `ts-node examples/nip19/bech32-example.ts` |
| `npm run example:nip19:tlv` | `ts-node examples/nip19/tlv-example.ts` |
| `npm run example:nip19:validation` | `ts-node examples/nip19/validation-example.ts` |
| `npm run example:nip19:security` | `ts-node examples/nip19/nip19-security.ts` |
| `npm run example:nip19:security-example` | `ts-node examples/nip19/security-example.ts` |
| `npm run example:nip21` | `ts-node examples/nip21/nip21-demo.ts` |
| `npm run example:nip44` | `ts-node examples/nip44/nip44-demo.ts` |
| `npm run example:nip44:version-compat` | `ts-node examples/nip44/nip44-version-compatibility.ts` |
| `npm run example:nip44:test-vector` | `ts-node examples/nip44/nip44-test-vector.ts` |
| `npm run example:nip44:compliance` | `ts-node examples/nip44/nip44-compliance-demo.ts` |
| `npm run example:nip17` | `ts-node examples/nip17/nip17-demo.ts` |
| `npm run example:nip46` | `ts-node examples/nip46/unified-example.ts` |
| `npm run example:nip46:minimal` | `ts-node examples/nip46/minimal.ts` |
| `npm run example:nip46:basic` | `ts-node examples/nip46/basic-example.ts` |
| `npm run example:nip46:advanced` | `ts-node examples/nip46/advanced/remote-signing-demo.ts` |
| `npm run example:nip46:from-scratch` | `ts-node examples/nip46/from-scratch/implementation-from-scratch.ts` |
| `npm run example:nip46:simple` | `ts-node examples/nip46/simple/simple-example.ts` |
| `npm run example:nip46:simple-client` | `ts-node examples/nip46/simple/simple-client-test.ts` |
| `npm run example:nip46:test-all` | `ts-node examples/nip46/test-all-examples.ts` |
| `npm run example:nip46:connection-string-validation` | `ts-node examples/nip46/connection-string-validation-example.ts` |
| `npm run example:nip47` | `ts-node examples/nip47/basic-example.ts` |
| `npm run example:nip47:verbose` | `VERBOSE=true ts-node examples/nip47/basic-example.ts` |
| `npm run example:nip47:client-service` | `ts-node examples/nip47/basic-client-service.ts` |
| `npm run example:nip47:error-handling` | `ts-node examples/nip47/error-handling-example.ts` |
| `npm run example:nip47:expiration` | `ts-node examples/nip47/request-expiration-example.ts` |
| `npm run example:nip47:nip44` | `ts-node examples/nip47/nip44-encryption.ts` |
| `npm run example:nip47:encryption-negotiation` | `ts-node examples/nip47/encryption-negotiation.ts` |
| `npm run example:nip50` | `ts-node examples/nip50/search-demo.ts` |
| `npm run example:nip57` | `ts-node examples/nip57/basic-example.ts` |
| `npm run example:nip57:client` | `ts-node examples/nip57/zap-client-example.ts` |
| `npm run example:nip57:lnurl` | `ts-node examples/nip57/lnurl-server-simulation.ts` |
| `npm run example:nip57:validation` | `ts-node examples/nip57/invoice-validation-example.ts` |
| `npm run example:nip65` | `ts-node examples/nip65/nip65-demo.ts` |
| `npm run example:nip66` | `ts-node examples/nip66/nip66-demo.ts` |

### Example Groups

| Command | Definition |
| --- | --- |
| `npm run example:all` | `npm run example` |
| `npm run example:basic` | `npm run example && npm run example:crypto && npm run example:nip04` |
| `npm run example:nip01` | `npm run example:nip01:event:ordering && npm run example:nip01:relay:connection && npm run example:nip01:relay:query && npm run example:nip01:validation` |
| `npm run example:messaging` | `npm run example:nip04 && npm run example:nip44 && npm run example:nip17` |
| `npm run example:identity` | `npm run example:nip05 && npm run example:nip07 && npm run example:nip19` |
| `npm run example:payments` | `npm run example:nip47 && npm run example:nip57` |
| `npm run example:advanced` | `npm run example:nip46 && npm run example:nip47:error-handling` |
| `npm run example:validation` | `npm run example:nip01:validation` |

### Release

| Command | Definition |
| --- | --- |
| `npm run release:prepare` | `npm run lint && npm test && npm run build && npm run pack:verify` |
| `npm run release:patch` | `npm run release:prepare && npm version patch` |
| `npm run release:minor` | `npm run release:prepare && npm version minor` |
| `npm run release:major` | `npm run release:prepare && npm version major` |
| `npm run release:push` | `git push && git push --tags` |
| `npm run release` | `npm run release:patch && npm run release:push` |

### Branch Management

| Command | Definition |
| --- | --- |
| `npm run promote` | `scripts/promote-to-main.sh` |

### Application Shortcuts

| Command | Definition |
| --- | --- |
| `npm run start` | `npm run example:nip07` |

## Development

Install dependencies reproducibly with `npm ci`, then use the build, test, quality, and verification workflows in the [Command Reference](#command-reference). npm 9.8.1 is the canonical package manager; Bun 1.3.9 is a frozen-lockfile compatibility runner. See [CONTRIBUTING.md](CONTRIBUTING.md#package-manager-policy) for the lockfile policy. Keep source, tests, and examples aligned when changing a NIP.

### Directory Structure Notes

- **Source Code**: All NIP implementations follow the `src/nipXX` naming pattern (lowercase)
- **Core Protocol**: NIP-01 is implemented in the `src/nip01/` directory with specialized files:
  - `event.ts`: Event creation, validation, and utilities
  - `nostr.ts`: Main Nostr client implementation
  - `relay.ts`: Relay connection and subscription management
  - `relayPool.ts`: Multi-relay pool management
- **Examples**: Organized by NIP in `examples/nipXX` directories
  - NIP-01 examples further divided into `event/` and `relay/` subdirectories
  - Client-specific examples in `examples/client`
- **Tests**: Organized by NIP in `tests/nipXX` directories
- For more details on code organization standards, see the [NIP Implementation Guide](src/NIP_STANDARDIZATION.md)

## Security

SNSTR implements robust security features throughout the codebase:

- **Comprehensive Event Validation**: Full verification of event signatures and structure
- **Secure Key Generation**: Safe private key generation within the secp256k1 curve limits
- **NIP-19 Security**: Relay URL validation and filtering to prevent injection attacks
- **NIP-44 Encryption**: Authenticated encryption with ChaCha20 and HMAC-SHA256
- **Input Validation**: Thorough validation and error checking across all components

For details on security considerations for specific NIPs, see the documentation in each implementation folder.
