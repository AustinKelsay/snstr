# Agent run artifacts

Durable Feature Dev / cleanup run ledgers live in this directory. Verbose per-issue session dumps, review packets, and CodeRabbit round logs are archived under [`archive/`](./archive/).

## Current ledgers

| File | Run |
| --- | --- |
| [`feature-cleanup-tier-ab-ledger.md`](./feature-cleanup-tier-ab-ledger.md) | Tier A+B API surface cleanup (#154) |
| [`cleanup-1-9-ledger.md`](./cleanup-1-9-ledger.md) | High-impact cleanup 1–9 (#130) |
| [`deep-cleanup-1-8-ledger.md`](./deep-cleanup-1-8-ledger.md) | Deep cleanup 1–8 (#111) |
| [`deep-cleanup-final-audit.md`](./deep-cleanup-final-audit.md) | Final staging audit after deep cleanup |
| [`feature-cleanup-runtime-debt-ledger.md`](./feature-cleanup-runtime-debt-ledger.md) | Runtime debt cleanup (#100) |
| [`feature-cleanup-1-8-ledger.md`](./feature-cleanup-1-8-ledger.md) | Earlier cleanup 1–8 feature ledger |
| [`feature-cleanup-1-3-ledger.md`](./feature-cleanup-1-3-ledger.md) | Earlier cleanup 1–3 feature ledger |
| [`feature-collapse-event-validation-ledger.md`](./feature-collapse-event-validation-ledger.md) | Event validation collapse |

## Policy

- Prefer updating the active run ledger over creating new session dumps at the top level.
- If a full issue session record is required by the Feature Dev loop, store it under `archive/` once the issue is closed, or keep only the ledger row with the commit SHA.
- Do not delete archived evidence; move it.
