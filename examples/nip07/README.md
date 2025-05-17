# NIP-07 Browser Extension Examples

These examples demonstrate how to use the SNSTR library with NIP-07 compatible browser extensions like nos2x, Alby, and noStrudel.

## Prerequisites

- A NIP-07 compatible browser extension installed in your browser:
  - [nos2x](https://chrome.google.com/webstore/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp) (Chrome)
  - [Alby](https://getalby.com/) (Chrome/Firefox)
  - [noStrudel](https://addons.mozilla.org/en-US/firefox/addon/nostrudel/) (Firefox)
- Node.js and npm installed

## Important: Security Restrictions

Browser extensions cannot access local files loaded via the `file://` protocol. You **must** serve these examples via HTTP using the included development server.

## Setup and Running

1. Install dependencies for the examples:

```bash
cd examples/nip07
npm install
```

2. Build the browser bundles:

```bash
npm run build
```

3. Start the development server:

```bash
npm run start
```

This will automatically open your browser to view the examples.

## Available Examples

### Basic NIP-07 Example

- **File**: `index.html`
- **Features**: 
  - Detects NIP-07 extension
  - Gets user's public key
  - Publishes text notes
  - Subscribes to user's notes

### Direct Messaging Example

- **File**: `direct-message.html`
- **Features**:
  - Encrypted messaging using NIP-04
  - Send and receive messages
  - Message conversation view

## Troubleshooting

If the examples don't work:

1. **Check the browser console** (F12 → Console tab) for errors
2. **Verify your extension is working** by checking if `window.nostr` is available in the console
3. **Make sure you're using HTTP** not opening the files directly
4. **Check that the extension has permissions** for the local development server

## Development

To modify these examples:

1. Edit the TypeScript files (`browser.ts` or `direct-message.ts`)
2. Rebuild the bundles with `npm run build`
3. Refresh your browser

## How It Works

These examples use the following components from SNSTR:

- `hasNip07Support()` - Detects if a compatible extension is available
- `getNip07PublicKey()` - Gets the public key from the extension
- `Nip07Nostr` - A client adapter that uses the extension for cryptographic operations 