# Issue 102 Loaded-Suite Follow-up Session

## Issue

- Issue: #102 — Quiet and harden the ephemeral Relay lifecycle
- Fixed point before session: `163a2f0`
- Worker session: `/root/issue_102_loaded_suite_followup`
- Commit: `e122d90`
- Status: complete; issue re-closed with follow-up evidence

## Inputs

- Spec issue: #100 — https://github.com/AustinKelsay/snstr/issues/100
- Ticket: #102 — https://github.com/AustinKelsay/snstr/issues/102
- Relevant glossary terms: Relay
- Relevant ADR: `docs/adr/0002-unify-diagnostics-compatibly.md`
- Regression source: integrated plain and coverage suites both fail `close disconnects an active Relay before it resolves`, while the assertion passes alone

## Diagnosis

- Public interface under test: `NostrRelay.start()`, `Relay.connect()`, `RelayEvent.Disconnect`, and `NostrRelay.close()`
- Required behavior: `NostrRelay.close()` must not resolve before every active public `Relay` has observed disconnect
- Tight feedback loop: `RELAY_CLOSE_CONCURRENCY=512 npx jest tests/utils/ephemeral-relay-close-stress.test.ts --runInBand --silent`
- Feedback-loop result: exact assertion red 6/6 in approximately 2.5–3 seconds; every connection succeeded and only post-close disconnect observation failed
- Minimized load-bearing scenario: 512 independent native-WebSocket Relay lifecycles in one process; one shared NostrRelay with up to 512 clients stays green, and lower isolated counts are inconsistent
- Ranked hypotheses:
  1. shutdown resolves before the peer `Relay` close callback receives a later event-loop turn
  2. starting transport close before session drain changes callback ordering under concurrent listeners
  3. server-side `ClientSession.closed` is not a remote-observability barrier
  4. public `Relay` invalidates or detaches a late close callback
  5. dynamic-port fallback or resource topology, rather than shutdown ordering, correlates with misses
- One-variable probes:
  - no post-close drain and a microtask drain stayed red 3/3; one immediate or zero-delay timer remained flaky; two immediate turns made the isolated stress green but did not survive the loaded suite
  - moving only `WebSocketServer.close()` initiation until after session drain stayed red 3/3, falsifying transport-initiation order
  - the missing public callbacks arrived later rather than being detached, falsifying callback loss
  - every connection succeeded, the misses used native WebSockets, and a shared Relay topology stayed green, weakening resource/fallback explanations
- Confirmed cause: server-side `ClientSession` and transport promises prove the connection is closed but do not synchronize the same-process public `Relay` callback that makes disconnect observable; a fixed count of event-loop turns is not a truthful completion condition under load

## Implementation

- Permanent regression seam: public `NostrRelay` and `Relay`, with a native WebSocket adapter injected through public `useWebSocketImplementation`; the adapter delivers its real close notification on the next event-loop turn
- `tdd` used: yes; the deterministic single-client seam failed the exact post-`await close()` disconnect assertion 3/3 before production changes
- Green behavior:
  - the WebSocket transport boundary tracks process-local public Relay observers by normalized exact URL only after successful open
  - natural close, coordinated close, manual disconnect, and late native callbacks share one idempotent finalizer
  - `NostrRelay.close()` synchronously finalizes matching observers only after authoritative sessions and transport have shut down, and only when that instance captured an owned transport
  - no public export or constructor/method signature changed
- Commands run during implementation:
  - deterministic regression seam before the fix: red 3/3 at the exact `disconnected === true` assertion
  - `npx jest tests/utils/ephemeral-relay-close-ordering.test.ts --runInBand --detectOpenHandles` — 6/6 passed for delayed natural close, exact-URL isolation, manual unregister/idempotency, dormant-close ownership, repeated close after foreign port reuse, and fixed-port restart registration
  - focused ordering, lifecycle, WebSocket injection, and reconnect suites — 4 suites / 32 tests passed with open-handle detection
  - temporary native stress harness at 512 and 768 independent Relay lifecycles — green 5/5 at each load; harness deleted afterward
  - `npm run lint` — passed
  - `npx tsc --noEmit -p tsconfig.json` — passed
  - `npm run build` — CJS and ESM builds passed
- Discarded attempt: two chained `setImmediate` phases made focused stress green but the loaded suite still failed 1/969; the duration-free phase barrier was removed rather than expanded into an arbitrary wait
- Full suite commands:
  - final post-review-fix `npm test -- --runInBand` — 71/71 suites and 974/974 tests passed in 263.975 seconds
  - `npm run test:coverage -- --runInBand --coverageReporters=json-summary --coverageReporters=text` — 71/71 suites and 972/972 tests passed in 268.463 seconds before the two additional ownership regressions were added

## Review

- Review fixed point: `163a2f0`
- Standards findings: initial review found that close without an owned transport could notify a foreign Relay at the same URL, and that an asynchronous observer contract was broader than the synchronous finalizer requires; final re-review passed with no findings
- Spec findings: initial review found the restart test used port 0 and therefore did not prove same-URL reuse or stale observer isolation; final re-review passed with no findings
- Worthy fixes applied: gate notification on captured instance transport ownership; narrow observer finalization to synchronous callbacks; add close-before-start and repeated-close foreign-server isolation; restart on a dynamically reserved fixed port and assert exact URL reuse
- Findings ignored with reasons: none

## Risks

- Do not replace the lifecycle contract with an arbitrary sleep or weaken the immediate post-`close()` assertion.
- Process-local coordination must remain exact-URL scoped and must never replace the real transport shutdown for external clients.
