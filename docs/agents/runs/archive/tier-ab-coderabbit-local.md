# CodeRabbit local gate — Tier A+B

- Command: `coderabbit review --agent --type all --base staging`
- Result: unavailable / silent after >4 minutes with no stdout (process terminated)
- Fallback: fresh standards + spec code-review against staging (Feature Dev unavailable-fallback)
- Fallback outcome: worthy findings fixed (NIP-42 README accuracy, NIP-46 README API block, curve-order CHANGELOG Security entry, SimpleNIP46 docblock wording, examples note)
- Ignored: remaining boolean peers not renamed (`validateRequestPayload`, etc.) — judgement call; ADR kill-list covers colliding names; further rename deferred
- Checks after fixes: tsc clean, lint clean, routine Jest 1076 passed, pack/commands/package-manager verify OK
