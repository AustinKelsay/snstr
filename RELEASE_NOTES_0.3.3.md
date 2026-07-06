# snstr v0.3.3

Release date: 2026-03-07

## Highlights

- Added first-class Flotilla-oriented building blocks: NIP-42 relay auth, NIP-29 relay-group helpers, NIP-56 reports, NIP-70 protected tags, NIP-86 relay management, and a shared signer layer.
- Added relay-scoped query APIs and stronger export surfaces for browser and package-root consumers.
- Hardened relay auth, publish, timeout, and reducer behavior based on stacked review feedback before release.

## Added

- `src/nip42`: auth event helpers plus signed relay authentication flows.
- `src/nip29`: group metadata, membership, admin, and role builders/parsers/reducers.
- `src/nip56` and `src/nip70`: moderation and protected-content helpers.
- `src/nip86`: relay management HTTP client and example usage.
- `src/signer`: shared signer abstractions for local-key, NIP-07, and remote signer integrations.

## Reliability fixes

- Relay auth now signs against canonical relay URLs and uses the same publish throttling path as normal event publishing.
- Relay send/ACK handling now registers listeners before send, preserves timeout coverage through response parsing, and reports aborts/timeouts more clearly.
- Group reducers now reject mixed-group inputs without an explicit `groupId`, validate snapshot IDs and pubkeys, and ignore malformed later snapshots instead of corrupting state.
- Browser capability helpers now require callable NIP-04/NIP-44 methods before advertising support.

## Notes for release

- Version bump: `0.3.2` -> `0.3.3`
- Changelog entry: [CHANGELOG.md](/Users/plebdev/Desktop/code/snstr/CHANGELOG.md)
- Suggested compare link: `https://github.com/AustinKelsay/snstr/compare/v0.3.2...v0.3.3`
