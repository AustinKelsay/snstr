# Contributing to SNSTR

Thank you for your interest in contributing to SNSTR! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Branch Strategy](#branch-strategy)
- [Release Process](#release-process)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/snstr.git`
3. Install dependencies: `npm install`
4. Build the project: `npm run build`

## Development Workflow

1. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Format your code: `npm run format`
6. Commit your changes with a descriptive message
7. Push your branch to your fork: `git push origin feature/your-feature-name`
8. Create a pull request

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if necessary
3. Link any related issues in your pull request description
4. Wait for review and address any feedback

## Testing

SNSTR has a comprehensive test suite. Make sure to add tests for any new features or bug fixes.

```bash
# Run all tests
npm test

# Run tests for specific NIPs
npm run test:nip01
npm run test:nip44
# etc.

# Run tests with coverage
npm run test:coverage
```

## Coding Standards

- Follow the established code style in the project
- Use TypeScript for all new code
- Add proper JSDoc comments to functions and classes
- Maintain backward compatibility when possible
- Follow the NIP implementation standards in [NIP_STANDARDIZATION.md](src/NIP_STANDARDIZATION.md)

## Branch Strategy

The project uses the following branch strategy:

### Main Branches

- **main**: Production-ready code. All releases are made from this branch.
- **staging**: Integration branch for testing changes before promotion to main.

### Feature Branches

- Create feature branches from `staging` with the format: `feature/your-feature-name`
- Bug fix branches should have the format: `fix/issue-description`

### Workflow

1. Develop features in feature branches
2. Create PRs targeting the `staging` branch
3. After approval, merge to `staging` for integration testing
4. When ready for release, promote `staging` to `main` using:
   ```bash
   npm run promote
   ```
5. Create releases from the `main` branch

The CI pipeline runs tests for both `main` and `staging` branches, but releases are only created from the `main` branch.

## Release Process

SNSTR uses GitHub Actions for automated releases. For detailed release instructions, see [RELEASE.md](RELEASE.md).

### Quick Release Guide

1. Ensure you're on the main branch with all changes merged
2. Update [CHANGELOG.md](CHANGELOG.md) with release notes
3. Go to [Actions](https://github.com/AustinKelsay/snstr/actions) → "Release to NPM"
4. Run workflow with appropriate version bump (patch/minor/major)

The workflow will automatically handle versioning, tagging, npm publishing, and GitHub release creation.

For the complete release process, requirements, and troubleshooting, refer to [RELEASE.md](RELEASE.md). 