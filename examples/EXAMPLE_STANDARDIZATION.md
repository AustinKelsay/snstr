# Example Standardization Guide

This document outlines the recommended structure and organization for example files in the SNSTR library. Following these guidelines will ensure consistency across all examples and make them more accessible to users.

## Example Directory Structure

Each NIP implementation should have a corresponding examples directory following this structure:

```
examples/
├── README.md                  # Main README for all examples
├── basic-usage.ts             # Core functionality demo
├── crypto-demo.ts             # Cryptography examples
├── nip01/                     # NIP-01 specific examples
│   ├── README.md              # Documentation for NIP-01 examples
│   ├── event/                 # Event-related examples
│   │   ├── event-ordering-demo.ts # Event ordering examples
│   │   ├── addressable-events.ts  # Addressable events examples
│   │   └── replaceable-events.ts  # Replaceable events examples
│   └── relay/                 # Relay-related examples
│       ├── relay-connection.ts    # Connection management examples
│       ├── filter-types.ts        # Filter type examples
│       └── relay-reconnect.ts     # Reconnection examples
├── nip02/                     # NIP-02 specific examples
│   ├── README.md              # Documentation for NIP-02 examples
│   └── nip02-follows-followers-example.ts # Example for NIP-02
├── nip04/                     # NIP-04 specific examples
│   ├── README.md              # Documentation for NIP-04 examples
│   └── direct-message.ts      # NIP-04 specific example
├── nip05/                     # NIP-05 specific examples
│   ├── README.md              # Documentation for NIP-05 examples
│   └── nip05-demo.ts          # NIP-05 specific example
└── javascript/                # JavaScript examples for non-TypeScript users
    └── README.md              # Documentation for JavaScript examples
```

### Directory Organization

- **Root Examples**: Core functionality examples should be at the root level
- **NIP-Specific Directories**: Each NIP should have its own directory with README.md
- **Component Subdirectories**: For complex NIPs like NIP-01, use subdirectories for different components (e.g., event, relay)
- **JavaScript Directory**: For JavaScript examples without TypeScript

## README.md Structure

Every NIP example directory should have a README.md with:

1. **Title**: `# NIP-XX Examples`
2. **Overview**: Brief description of what the examples demonstrate
3. **Running Instructions**: How to run each example with npm scripts
4. **Example Descriptions**: Short description of each example file
5. **Key Concepts**: Main concepts demonstrated in the examples
6. **Advanced Usage**: (if applicable) More complex use cases

### Main examples/README.md

The main README.md should:
- Give an overview of all examples
- List all NIP-specific examples
- Provide instructions for running examples
- Show the directory structure

## Example File Guidelines

Each example file should:

1. Start with a comprehensive header comment:
```typescript
/**
 * NIP-XX Example: [Brief title]
 * 
 * This example demonstrates [main purpose]
 * 
 * Key concepts:
 * - Concept 1
 * - Concept 2
 * 
 * How to run:
 * npm run example:nipXX
 */
```

2. Include detailed comments explaining key steps
3. Handle errors appropriately
4. Be self-contained when possible
5. Include both basic and advanced usage patterns

## Standardized File Naming

- `basic-example.ts`: Simple implementation of core functionality
- `[feature]-example.ts`: Example focusing on a specific feature (e.g., `relay-connection.ts`)
- `[feature]-demo.ts`: Interactive demo of a specific feature (e.g., `event-ordering-demo.ts`)
- `advanced-example.ts`: More complex implementation

## NPM Scripts for Examples

Add these to package.json:

```json
{
  "scripts": {
    "example": "ts-node examples/basic-usage.ts",
    "example:verbose": "VERBOSE=1 ts-node examples/basic-usage.ts",
    "example:debug": "DEBUG=1 ts-node examples/basic-usage.ts",
    "example:crypto": "ts-node examples/crypto-demo.ts",
    
    "// NIP-01 Examples": "-------------- NIP-01 Examples --------------",
    "example:nip01:event:ordering": "ts-node examples/nip01/event/event-ordering-demo.ts",
    "example:nip01:event:addressable": "ts-node examples/nip01/event/addressable-events.ts",
    "example:nip01:event:replaceable": "ts-node examples/nip01/event/replaceable-events.ts",
    "example:nip01:relay:connection": "ts-node examples/nip01/relay/relay-connection.ts",
    "example:nip01:relay:filters": "ts-node examples/nip01/relay/filter-types.ts",
    "example:nip01:relay:reconnect": "ts-node examples/nip01/relay/relay-reconnect.ts",
    "example:nip01:validation": "ts-node examples/client/validation-flow.ts",
    
    "// Other NIPs": "-------------- Other NIPs --------------",
    "example:nip02:follows": "ts-node examples/nip02/nip02-follows-followers-example.ts",
    "example:nip04": "ts-node examples/nip04/direct-message.ts",
    "example:nip05": "ts-node examples/nip05/nip05-demo.ts",
    "example:nip19": "ts-node examples/nip19/nip19-demo.ts"
    // Add scripts for each example
  }
}
```

## Implementation Checklist

For each NIP:

- [ ] Create a dedicated directory with README.md
- [ ] Implement basic examples demonstrating core functionality
- [ ] Add advanced examples for complex features
- [ ] Update main README.md with example descriptions
- [ ] Add NPM scripts for running examples
- [ ] Ensure all examples have proper header comments
- [ ] Include JavaScript examples if appropriate

## Example Content Requirements

Each NIP example should demonstrate:

1. **Basic Usage**: Core API usage with minimal setup
2. **Error Handling**: How to handle common errors
3. **Configuration Options**: Common configuration patterns
4. **Integration**: How to integrate with other NIPs if applicable
5. **Best Practices**: Recommended usage patterns

## Migration Plan

To standardize existing examples:

1. Create directories for each NIP
2. Move existing examples to appropriate directories
3. For complex NIPs like NIP-01, organize by component (event, relay)
4. Add README.md files to each directory
5. Standardize file naming
6. Add header comments to example files
7. Create missing examples for NIPs with insufficient coverage
8. Update main README.md with new structure

This standardization will make examples more consistent, easier to navigate, and more helpful for new users of the library. 