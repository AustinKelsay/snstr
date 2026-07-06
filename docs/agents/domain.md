# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists. It points at one `CONTEXT.md` per context; read each one relevant to the topic.
- **`docs/adr/`** for ADRs that touch the area being changed.

If any of these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

This repo uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is missing from the glossary, either reconsider the term or add it through `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly instead of silently overriding it.
