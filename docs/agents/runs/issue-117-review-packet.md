# Review Packet: #117 Shared Security Validation Ownership

## Fixed Point

- Base: `staging` at `94eed4a`
- Branch: `feature/security-validation-ownership`
- Issue: #117

## Change Story

- `wire-validation` owns exact-width hexadecimal forms and UTF-8 byte measurement.
- `key-validation` owns secp256k1 public-key format, curve-point, and private-scalar validity.
- `security-limits` owns shared resource ceilings; the former validator export remains compatible.
- NIP-01, NIP-02, NIP-29, NIP-42, NIP-44, NIP-46, NIP-56, Relay, signer/security paths, and the testing Relay delegate generic facts to those owners.
- NIP-specific policy and public error contracts are unchanged.

## Verification

- Focused public/security behavior: 9 suites, 273/273
- Focused coverage after review fix: 7 suites, 231/231; 81.19% aggregate branches; key validation 100% branches; wire/limits 100%
- Local CodeRabbit: 1/1 finding fixed
- Full Jest: 78 suites, 1030/1030
- Full Bun: 1030/1030
- Commands, lint, root/examples typechecks, CJS/ESM build, examples build, and pack verification: pass

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
