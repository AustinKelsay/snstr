## Issue

- Issue: #107 — Remove broken or unreachable package surfaces
- Fixed point before session: `b541f06dac9de7d050c3c3e31fa6320f6b56232a`
- Worker session: `/root/issue_107_worker`
- Commit: `b6bb3be`
- Status: complete; issue closed with verification evidence

## Inputs

- Spec issue: #100 — Eliminate remaining runtime and maintenance debt
- Ticket: #107 — Remove broken or unreachable package surfaces
- Relevant glossary terms: package export, runnable example, maintained TypeScript example
- Relevant ADRs: none; ADR 0002 concerns diagnostics and does not govern this slice
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: repository package exports and runnable npm example commands
- Behaviors covered: remove the unreachable NIP-04 shim; remove the broken redundant NIP-44 JavaScript demo and every advertised command/reference; preserve the maintained TypeScript NIP-44 example; keep generated build and packed package contents free of removed artifacts
- `tdd` used: yes, at the pre-agreed runnable-command seam; the failing retired JavaScript command is the red baseline and the maintained TypeScript command is the compatibility baseline
- Commands run during implementation:
  - Red baseline: the advertised plain-JavaScript NIP-44 example command failed with `MODULE_NOT_FOUND` for its nonexistent compiled-library entry (exit 1)
  - Compatibility baseline: `npm run example:nip44` passed (exit 0)
  - Reference baseline: `git grep` found the JavaScript demo command/file in `package.json`, `README.md`, `examples/README.md`, and `examples/EXAMPLE_STANDARDIZATION.md`; the NIP-04 shim was tracked but had no source/export reference
  - Comprehensive post-removal `rg`, tracked-file, and filesystem searches found no live source, export, script, or advertised-documentation reference to either retired surface; durable cleanup records are evidence, not advertised package surfaces
  - `npm run build:examples` (passed)
  - `npm run example:nip44` (passed after removal)
  - `npm run lint` (passed)
  - `npx tsc --noEmit -p tsconfig.json` (passed)
  - `npm run build` (passed; CJS and ESM)
  - Generated-output searches confirmed the library `dist` contains no stale NIP-04 shim and the real examples output tree, `dist-examples`, contains no retired command or broken `../../dist/snstr` import; `dist-examples/examples/nip44/nip44-demo.js` is the intended compiler output of the maintained TypeScript demo
  - `npm run pack:verify` (passed: 16 referenced targets, 304 packed files, 49 web modules, 3 guarded Node fallbacks)
  - `npm pack --dry-run --json` inventory check (passed: 304 intended files and no removed artifacts)
- Full suite command: deferred to the integrated feature run; this removal-only slice uses build, example, export/package, lint, and typecheck verification

## Review

- Review fixed point: `b541f06dac9de7d050c3c3e31fa6320f6b56232a`
- Standards findings: initial review requested correcting the examples output path in the durable evidence and restoring unrelated EOF bytes in `examples/EXAMPLE_STANDARDIZATION.md`; final exact-staged re-review passed with no hard violations or actionable Fowler smells
- Spec findings: initial review requested inspecting the real `dist-examples` tree and qualifying the no-reference claim to distinguish durable evidence from live advertised surfaces; final exact-staged re-review passed with no missing, partial, incorrect, or out-of-scope behavior
- Worthy fixes applied: verified and recorded the real examples output tree and intended compiler-produced demo; limited the reference claim to live source/export/script/advertised-documentation surfaces; restored the standardization document's preexisting EOF bytes
- Findings ignored with reasons: none; both review axes passed after all worthy findings were applied

## Risks

- None identified; both removed files are unreachable or broken, and the maintained TypeScript example is the compatibility seam.
