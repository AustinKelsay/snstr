# Repository Guidelines

## Project Structure & Module Organization
- `src/` — library code by NIP in `src/nipXX/` (e.g., `src/nip46/`). Shared types in `src/types/`, utilities in `src/utils/`. Export surfaces in `src/index.ts` (update when adding modules). Follow `src/NIP_STANDARDIZATION.md` for NIP changes.
- `tests/` — Jest tests mirror `src/` by NIP (`tests/nipXX/`) plus focused tests like `tests/utils/*.test.ts`.
- `examples/` — runnable TypeScript examples by feature/NIP.
- `dist/` — compiled output; do not edit.
- `scripts/` — helper scripts (e.g., `scripts/promote-to-main.sh`).

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run build` — clean and compile TypeScript to `dist/`.
- `npm test` | `npm run test:watch` | `npm run test:coverage` — run Jest, watch mode, or coverage (reports in `coverage/`).
- `npm run lint` — ESLint (`@typescript-eslint`) over `.ts` sources.
- `npm run format` — Prettier 3 for `src/`, `tests/`, `examples/`.
- `npm run example` (or `example:*`) | `npm start` — run examples; default is the NIP‑07 example.
- `npm run promote` — maintainers: promote `staging` → `main`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer explicit types; avoid `any`.
- Formatting: Prettier, 2‑space indent; run `npm run format` before pushing.
- Linting: `@typescript-eslint`; intentionally unused vars prefixed with `_`.
- Naming: `camelCase` for variables/functions; `PascalCase` for types/classes. New NIP code goes under `src/nipXX/` and is exported via `src/index.ts`.

## Testing Guidelines
- Framework: Jest with `ts-jest`, Node environment.
- Naming: `*.test.ts` or `*.spec.ts`; mirror the `src/` layout.
- Coverage: keep or improve; use `npm run test:coverage`.
- Use test vectors and the ephemeral relay; never include real credentials.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), imperative and concise.
- Branches: create from `staging` using `feature/<name>` or `fix/<name>`; PRs target `staging`.
- PR checklist: clear what/why, linked issues (e.g., `#123`), tests and examples updated if behavior changes. Run `npm run lint && npm test && npm run build` before opening.

## Security & Configuration Tips
- Do not commit private keys, secrets, or real credentials.
- Prefer `.env` files ignored by Git; document required vars in examples or readme.

## Agent‑Specific Notes
- This AGENTS.md applies repo‑wide. A deeper `AGENTS.md` overrides within its folder subtree. Follow the structure and style above when adding files and exports.

