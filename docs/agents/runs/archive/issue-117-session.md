# Issue Session: #117 Shared Security Validation Ownership

## Scope

- Fixed point: `94eed4a` (`staging` after PR #125)
- Branch: `feature/security-validation-ownership`
- Issue: #117
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion                           | Implementation / verification seam                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Generic validation rules have canonical owners | `wire-validation.ts`, `key-validation.ts`, and `security-limits.ts`                                                                   |
| NIP-specific policy remains local              | NIP-46 request limits, permissions, timestamp windows, production relay policy, and error sanitization remain in NIP-46               |
| Public compatibility remains stable            | NIP-44 re-exports its existing key validators; `security-validator` re-exports `SECURITY_LIMITS`; public error paths remain unchanged |
| Public behavior plus pure seams are tested     | Nostr Event, Relay, NIP-46, security-limit, and focused canonical-validator suites                                                    |
| Security coverage and full verification pass   | focused coverage and full Jest/Bun release matrix                                                                                     |

## Decisions

- Separate wire representation, cryptographic key validity, and shared resource ceilings rather than moving all policy into one catch-all validator.
- Delegate generic facts from NIP modules while preserving their existing error text and compatibility behavior.
- Keep NIP-46's deliberately different content/tag limits and permission rules local because they are protocol policy, not generic facts.
