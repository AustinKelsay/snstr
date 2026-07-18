# Integrated Bun Compatibility Follow-up

## Scope

- Parent spec: #100 — Eliminate remaining runtime and maintenance debt
- Fixed point before follow-up: `49ac99f`
- Commit: `53090bb`
- Status: implementation, integrated verification, and independent review complete
- Production behavior changed: none; this follow-up keeps the new regression coverage executable under both Jest/Node and Bun

## Trigger

The first branch-wide `npm run test:bun` run exposed compatibility gaps in tests added or expanded by tickets #102–#105. The production paths passed under Jest, but the new tests relied on Jest APIs or mutable globals that Bun's test runner does not provide consistently:

- async fake-timer helpers (`advanceTimersByTimeAsync`)
- isolated module helpers (`isolateModules` and `isolateModulesAsync`)
- assigning Bun's read-only `globalThis.Bun`
- a fake-clock millisecond boundary that differed under Bun
- native `ws` listener cleanup that did not close Bun's underlying HTTP connections

## Implementation

- Replaced the rate-limit fake system clock with a scoped `Date.now` spy at the exact window boundary.
- Added a portable fake-timer advance helper for NIP-57 and NIP-86 Jest coverage.
- Let real Bun use the `NostrRelay` in-memory transport selected for port `0`; Node/Jest retains the existing temporary Bun marker.
- Removed unsupported module-isolation helpers from Relay lifecycle tests while preserving the same observable logging and lifecycle assertions.
- Made NIP-86 abort tests use real 1 ms timers under Bun and fake timers under Jest; both runtimes still assert one abort and terminal cleanup.
- Forced the native `ws` client implementation in foreign-server ownership tests.
- Made the native test transport explicitly own its HTTP listener and track accepted sockets through public events. Cleanup now awaits every WebSocket peer, destroys any remaining tracked socket, closes HTTP connections, and verifies the listener is released on Bun.

## Verification

- Affected Jest matrix with handle detection: 5 suites / 98 tests passed.
- Affected Bun matrix: 5 files / 98 tests passed.
- Full Jest with handle detection: 72 suites / 984 tests passed in 274.009 seconds.
- Full Bun: 72 files / 984 tests passed in 251.71 seconds.
- Full coverage: 72 suites / 984 tests passed in 294.989 seconds; overall 76.08% statements, 63.30% branches, 79.50% functions, and 76.40% lines.
- `src/utils/security-validator.ts`: 86.12% statements, 80.00% branches, 84.37% functions, and 85.99% lines.
- `npm run lint`, root TypeScript, and examples TypeScript passed.
- `npm run commands:verify`, library build, examples build, package verification, `example:basic`, and `example:messaging` passed.
- Package verification covered 16 referenced targets, 304 packed files, 49 web modules, and 3 guarded Node fallbacks.

## Review

- Initial standards review found private `ws` cleanup fields in the first Bun-compatible helper.
- Worthy fix: replaced those fields with an explicitly owned HTTP listener and public socket tracking; Bun verifies listener state because its upgraded-socket close event is unreliable.
- Final standards re-review: pass, zero findings.
- Behavioral/spec/cross-runtime review and re-review: pass, zero findings.
- Final affected matrix after the review fix: Jest 5/5 suites and 98/98 tests with handle detection; Bun 5/5 files and 98/98 tests.

## Risks

- Bun's Node-compatible HTTP server closes the listener synchronously after its connections are closed but does not emit the close event reliably in this test shape. The helper verifies `listening === false` and `address() === null` on Bun; Node/Jest continues to await the public close event.
- Bun uses real timers only for the two 1 ms NIP-86 abort tests because its Jest-compatible fake timer does not reliably drive the AbortController chain. The Jest path retains deterministic timer-count assertions.
