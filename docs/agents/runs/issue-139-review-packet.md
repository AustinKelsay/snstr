# Review Packet: Issue #139 Split Ephemeral Relay Internals

## Fixed Point and Spec

- Fixed point: `3c1e905`
- Diff: `git diff 3c1e905...HEAD`
- Spec: GitHub issue #139, child of cleanup run #130
- Standards: `AGENTS.md`, `CONTRIBUTING.md`, and the code-review smell baseline

## Delivered Shape

- `src/utils/ephemeral-relay.ts` remains the stable public facade and composition root.
- `transport.ts` owns native/in-memory selection, connection acceptance, fallback, runtime errors, and ordered shutdown.
- `client-session.ts` owns per-client wire protocol, subscriptions, NIP-46 routing, and socket cleanup through a narrow host interface.
- `filter-match.ts` owns pure Subscription Filter matching.
- Cache/replacement behavior stays in the facade; no new package entrypoint or production root export was added.

## Review Decisions

- Added missing JSDoc and camelCase names for the new private interfaces.
- Reused the shared diagnostics owner and moved server-client traversal behind transport.
- Added happy/error session messaging, filter semantics, transport-failure cleanup, late-error, lifecycle, and package-surface coverage.
- Retained the private transport factory: it keeps the implementation class hidden and is not accidental middle-man surface.
- Retained the cohesive client-session owner despite its size: splitting NIP-46 or wire-protocol behavior again is outside this ticket.
- Rejected a new connection cap and a legacy multi-filter delivery change because neither belongs to the compatibility-preserving structural scope.

## Verification

- Focused public/internal contracts: Jest and Bun 50/50 after CodeRabbit production fixes; final polling-only check 2/2 in both.
- Routine lanes: Jest/Bun 1,067 tests each.
- Slow lanes: Jest/Bun 35 tests each.
- Complete Jest coverage inventory: 1,102 tests.
- Green: command policy, package-manager policy, ESLint, strict TypeScript, CJS/ESM build, web entry checks, examples, and packed-consumer verification.
- Pack result: 19 referenced targets, 376 packed files, 55 web modules, 3 guarded Node fallbacks.
- CodeRabbit: all actionable in-scope findings fixed; final incremental review clean.
