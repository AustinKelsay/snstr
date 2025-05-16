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

SNSTR uses a manual release process.

### Manual Release

To perform releases:

1. Make sure you're on the main branch with the latest changes: 
   ```bash
   git checkout main
   git pull
   ```

2. Use one of the release scripts based on the version bump you want:
   ```bash
   # For a patch release (0.1.0 -> 0.1.1)
   npm run release:patch
   
   # For a minor release (0.1.0 -> 0.2.0)
   npm run release:minor
   
   # For a major release (0.1.0 -> 1.0.0)
   npm run release:major
   ```

3. Push the changes and tags:
   ```bash
   npm run release:push
   ```

   Or use the combined command:
   ```bash
   npm run release
   ```

### Release Checklist

Before releasing, ensure:

- All tests pass
- The changelog is updated
- Documentation is up-to-date
- Breaking changes are clearly documented
- The version follows semantic versioning

### Publish to npm

To publish to npm, you need:

1. An npm account with publish access to the package
2. To be logged in (`npm login`) 
3. Run `npm publish` to publish the package 