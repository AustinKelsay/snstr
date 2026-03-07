# Signer Helpers

Unified signing helpers for local keys, browser extensions, and remote signers.

Primary exports:

- `LocalKeySigner`
- `Nip07Signer`
- `Nip46Signer`
- `getSignerCapabilities`

The shared `Signer` interface exposes:

- `getPublicKey()`
- `signEvent(eventTemplate)`
- optional `nip04`
- optional `nip44`

This lets higher-level modules such as relay management reuse one signer surface
regardless of whether keys live in-process, in a browser extension, or behind a
NIP-46 bunker.
