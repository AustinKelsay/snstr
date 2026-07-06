# snstr v0.3.4

Release date: 2026-07-06

## Highlights

- Centralized NIP-01 event validation so event hashing, signed validation, and relay ingress use the same shape and tag checks.
- Hardened relay ingress by requiring signed events, lowercase relay tag references, and lowercase NIP-46 `p` tags.
- Added configurable inbound timestamp drift settings for relays.

## Reliability fixes

- Rejects non-finite `created_at` values before drift calculations.
- Keeps relay validation defaults unchanged while allowing explicit future and past drift overrides.
- Replaces a fixed relay validation test delay with bounded polling for async validation settlement.

## Notes for release

- Version bump: `0.3.3` -> `0.3.4`
- Changelog entry: `CHANGELOG.md`
- Suggested compare link: `https://github.com/AustinKelsay/snstr/compare/v0.3.3...v0.3.4`
