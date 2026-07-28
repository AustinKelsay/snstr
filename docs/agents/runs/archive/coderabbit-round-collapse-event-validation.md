# CodeRabbit Round: Collapse Event Validation

## Round

- Scope: local
- Round number: 1
- Command or trigger: `coderabbit review --agent --type all --base staging`
- Started: 2026-07-06
- Completed: 2026-07-06
- Availability: timed out after emitting actionable findings; rerun emitted no findings before hanging in `reviewing` heartbeats
- Fallback review thread: Composer 2.5 via `agent`; broad prompt produced no output before interruption, narrowed prompt completed with no blocking findings

## Findings To Address

| Finding | Severity | Decision | Notes |
| --- | --- | --- | --- |
| `src/nip01/validation.ts` allowed non-hex `id`/`sig` values through shape validation when hash/signature checks were skipped. | minor | addressed | `sanitizeNostrEvent` now uses `isHexString` for `id` and `sig` shape checks before optional hash/signature checks. |
| Relay ingress skipped id/signature validation for NIP-46 kind `24133` by default. | major | addressed | `validateRelayIngressEvent` defaults to no skip, `Relay.validateInboundEvent` no longer passes a skip, and Relay NIP-46 tests now use signed events. |
| `docs/agents/issue-tracker.md` resolved ambiguous references PR-first. | minor | addressed | Triage guidance now treats GitHub Issues as source of truth and resolves issue-first. |
| `docs/agents/domain.md` referenced `CONTEXT-MAP.md` despite this repo's single-context layout. | minor | addressed | Domain guidance now points only at root `CONTEXT.md` and relevant ADRs. |

## Findings Not Addressed

| Finding | Reason |
| --- | --- |
| None | All emitted findings were valid and addressed. |

## Result

- Continue: yes
- Escalate: no
- Notes: Initial CodeRabbit run was interrupted after several minutes of repeated `reviewing` heartbeats once findings had been captured. The post-fix rerun reached `tools_completed` and emitted no findings before repeating heartbeats; it was interrupted cleanly. Composer 2.5 fallback review found no blocking findings. Non-blocking follow-ups were addressed with a Relay-level tampered NIP-46 ingress test and valid pubkeys in relay example fixtures.
