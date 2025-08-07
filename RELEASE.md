# Release Process

This document describes how to release new versions of SNSTR.

## Quick Start

### Option 1: GitHub Actions (Recommended)

1. Go to [Actions](https://github.com/AustinKelsay/snstr/actions) → "Release to NPM"
2. Click "Run workflow"
3. Select version type:
   - **patch**: Bug fixes (0.1.0 → 0.1.1)
   - **minor**: New features (0.1.0 → 0.2.0)
   - **major**: Breaking changes (0.1.0 → 1.0.0)
4. Click "Run workflow"

The workflow will automatically:
- ✅ Run tests and linting
- ✅ Bump version in package.json
- ✅ Create git tag
- ✅ Publish to npm
- ✅ Create GitHub release

### Option 2: Manual Tag

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Push changes and tag
git push origin main
git push origin --tags
```

## Pre-release Checklist

Before releasing:

- [ ] All tests pass (`npm test`)
- [ ] Code is formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] Update CHANGELOG.md with changes
- [ ] Merge all release changes to main branch

## Dry Run

To test the release process without publishing:

1. Run workflow with "Dry run" checked
2. Review the output to ensure everything looks correct

## Requirements

- **NPM_TOKEN**: Must be set in repository secrets for npm publishing
- **Branch**: Releases can only be made from the main branch
- **Node**: The release uses Node.js 20.x

## Version Guidelines

- **Patch** (0.1.0 → 0.1.1): Bug fixes, documentation updates
- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes, API changes

## After Release

The workflow will provide links to:
- 📦 [npm package](https://www.npmjs.com/package/snstr)
- 🏷️ GitHub release page
- 📊 Bundle size info

## Troubleshooting

If the release fails:

1. Check the [Actions log](https://github.com/AustinKelsay/snstr/actions) for errors
2. Ensure NPM_TOKEN is correctly set in repository secrets
3. Verify you're on the main branch
4. Make sure all tests pass locally

For manual releases, ensure you have npm publish permissions for the snstr package.