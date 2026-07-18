# Release Process

This document describes how to release new versions of SNSTR.

## Quick Start

Releases are currently performed manually from `main`; the repository does not
have an npm publishing workflow. Promote the verified `staging` branch first,
then run the release from a clean, up-to-date `main` checkout.

npm 9.8.1 is the canonical release package manager. Bun is tested as a
compatibility runner, but it is not used to version or publish releases.

```bash
git checkout main
git pull --ff-only origin main
npm ci
npm run package-manager:verify
npm run release:prepare
npm publish --dry-run
npm version minor # or patch/major
git push origin main --follow-tags
npm publish --access public
gh release create "v$(node -p 'require("./package.json").version')" --generate-notes
```

The cleanup release is backward-compatible and adds browser/React Native
exports, so its expected version bump is **minor** (`0.3.4` → `0.4.0`).

## Pre-release Checklist

Before releasing:

- [ ] All tests pass (`npm test`)
- [ ] Code is formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] Update CHANGELOG.md with changes
- [ ] Merge all release changes to main branch

## Dry Run

Run `npm publish --dry-run` from the clean release candidate and inspect the
package contents before creating the version commit and tag.

## Requirements

- **npm authentication**: The releasing maintainer must be logged in with
  publish access to the `snstr` package.
- **Branch**: Releases can only be made from the main branch
- **Node**: The release uses Node.js 20.x

## Version Guidelines

- **Patch** (0.1.0 → 0.1.1): Bug fixes, documentation updates
- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes, API changes

## After Release

- Verify the published version on [npm](https://www.npmjs.com/package/snstr).
- Verify the tag and GitHub release point to the same commit on `main`.
- Install the published package in a clean consumer project and exercise both
  Node and browser conditional exports.

## Troubleshooting

If the release fails:

1. Verify `npm whoami` and package publish permissions.
2. Verify you're on the main branch and the working tree is clean.
3. Re-run `npm run release:prepare` and `npm publish --dry-run`.
4. If a tag was pushed but publishing failed, fix the publishing issue without
   reusing or moving an already published version tag.
