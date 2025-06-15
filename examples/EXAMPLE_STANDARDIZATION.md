# Example Standardization Guide

This document outlines the recommended structure and organization for example files in the SNSTR library. Following these guidelines will ensure consistency across all examples and make them more accessible to users.

## Example Directory Structure

Each NIP implementation should have a corresponding examples directory following this structure:

```
examples/
├── README.md                  # Main README for all examples
├── basic-usage.ts             # Core functionality demo
├── crypto-demo.ts             # Cryptography examples
├── custom-websocket.ts        # WebSocket customization example
├── nip01/                     # NIP-01 specific examples
│   ├── README.md              # Documentation for NIP-01 examples
│   ├── event/                 # Event-related examples
│   │   ├── event-ordering-demo.ts # Event ordering examples
│   │   ├── addressable-events.ts  # Addressable events examples
│   │   └── replaceable-events.ts  # Replaceable events examples
│   └── relay/                 # Relay-related examples
│       ├── relay-connection.ts    # Connection management examples
│       ├── filter-types.ts        # Filter type examples
│       ├── relay-reconnect.ts     # Reconnection examples
│       └── relay-pool.ts          # Multi-relay pool examples
├── nip02/                     # Contact Lists
│   ├── README.md
│   └── nip02-demo.ts
├── nip04/                     # Encrypted Direct Messages
│   ├── README.md
│   └── direct-message.ts
├── nip05/                     # DNS Identifiers
│   ├── README.md
│   └── nip05-demo.ts
├── nip07/                     # Browser Extension Provider
│   ├── README.md
│   ├── browser.ts
│   ├── direct-message.ts
│   ├── index.html
│   └── direct-message.html
├── nip09/                     # Event Deletion
│   ├── README.md
│   └── deletion-request.ts
├── nip10/                     # Text Notes and Threads
│   ├── README.md
│   └── [thread examples]
├── nip11/                     # Relay Information
│   ├── README.md
│   └── relay-info-example.ts
├── nip17/                     # Gift Wrapped Direct Messages
│   ├── README.md
│   └── nip17-demo.ts
├── nip19/                     # Bech32 Entities
│   ├── README.md
│   ├── nip19-demo.ts
│   ├── bech32-example.ts
│   ├── tlv-example.ts
│   ├── validation-example.ts
│   └── nip19-security.ts
├── nip21/                     # URI Scheme
│   ├── README.md
│   └── nip21-demo.ts
├── nip44/                     # Versioned Encryption
│   ├── README.md
│   ├── nip44-demo.ts
│   ├── nip44-demo.js
│   ├── nip44-version-compatibility.ts
│   └── nip44-test-vector.ts
├── nip46/                     # Remote Signing
│   ├── README.md
│   ├── unified-example.ts
│   ├── minimal.ts
│   ├── basic-example.ts
│   ├── advanced/
│   ├── from-scratch/
│   └── simple/
├── nip47/                     # Wallet Connect
│   ├── README.md
│   ├── basic-example.ts
│   ├── basic-client-service.ts
│   ├── error-handling-example.ts
│   └── request-expiration-example.ts
├── nip50/                     # Search
│   ├── README.md
│   └── search-demo.ts
├── nip57/                     # Lightning Zaps
│   ├── README.md
│   ├── basic-example.ts
│   ├── zap-client-example.ts
│   ├── lnurl-server-simulation.ts
│   └── invoice-validation-example.ts
├── nip65/                     # Relay List Metadata
│   ├── README.md
│   └── nip65-demo.ts
├── nip66/                     # Relay Discovery
│   ├── README.md
│   └── nip66-demo.ts
└── client/                    # General client examples
    ├── README.md
    └── validation-flow.ts
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

The current package.json includes comprehensive scripts for all examples:

```json
{
  "scripts": {
    "example": "ts-node examples/basic-usage.ts",
    "example:verbose": "VERBOSE=true ts-node examples/basic-usage.ts",
    "example:debug": "DEBUG=true ts-node examples/basic-usage.ts",
    "example:custom-websocket": "ts-node examples/custom-websocket.ts",
    "example:crypto": "ts-node examples/crypto-demo.ts",
    
    "// NIP-01 Examples": "-------------- NIP-01 Examples --------------",
    "example:nip01:event:ordering": "ts-node examples/nip01/event/event-ordering-demo.ts",
    "example:nip01:event:addressable": "ts-node examples/nip01/event/addressable-events.ts",
    "example:nip01:event:replaceable": "ts-node examples/nip01/event/replaceable-events.ts",
    "example:nip01:relay:connection": "ts-node examples/nip01/relay/relay-connection.ts",
    "example:nip01:relay:filters": "ts-node examples/nip01/relay/filter-types.ts",
    "example:nip01:relay:auto-close": "ts-node examples/nip01/relay/auto-unsubscribe-example.ts",
    "example:nip01:relay:query": "ts-node examples/nip01/relay/relay-query.ts",
    "example:nip01:relay:reconnect": "ts-node examples/nip01/relay/relay-reconnect.ts",
    "example:nip01:relay:pool": "ts-node examples/nip01/relay/relay-pool.ts",
    "example:nip01:validation": "ts-node examples/client/validation-flow.ts",
    
    "// All NIPs": "-------------- All NIP Examples --------------",
    "example:nip02": "ts-node examples/nip02/nip02-demo.ts",
    "example:nip04": "ts-node examples/nip04/direct-message.ts",
    "example:nip05": "ts-node examples/nip05/nip05-demo.ts",
    "example:nip07": "cd examples/nip07 && npm install && npm run build && npm start",
    "example:nip09": "ts-node examples/nip09/deletion-request.ts",
    "example:nip10": "echo '🧵 NIP-10: Text Notes and Threads - See examples/nip10/README.md'",
    "example:nip11": "ts-node examples/nip11/relay-info-example.ts",
    "example:nip17": "ts-node examples/nip17/nip17-demo.ts",
    "example:nip19": "ts-node examples/nip19/nip19-demo.ts",
    "example:nip21": "ts-node examples/nip21/nip21-demo.ts",
    "example:nip44": "ts-node examples/nip44/nip44-demo.ts",
    "example:nip46": "ts-node examples/nip46/unified-example.ts",
    "example:nip47": "ts-node examples/nip47/basic-example.ts",
    "example:nip50": "ts-node examples/nip50/search-demo.ts",
    "example:nip57": "ts-node examples/nip57/basic-example.ts",
    "example:nip65": "ts-node examples/nip65/nip65-demo.ts",
    "example:nip66": "ts-node examples/nip66/nip66-demo.ts",
    
    "// Example Groups": "-------------- Example Groups --------------",
    "example:basic": "npm run example && npm run example:crypto && npm run example:dm",
    "example:messaging": "npm run example:dm && npm run example:nip04 && npm run example:nip44 && npm run example:nip17",
    "example:identity": "npm run example:nip05 && npm run example:nip07 && npm run example:nip19",
    "example:payments": "npm run example:nip47 && npm run example:nip57",
    "example:advanced": "npm run example:nip46 && npm run example:nip47:error-handling"
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

The SNSTR project already has a well-organized example structure. Current status:

1. ✅ **Directories created** - All major NIPs have dedicated directories
2. ✅ **README files added** - All NIP directories now have documentation
3. ✅ **Examples organized** - Complex NIPs like NIP-01 are properly organized by component
4. ✅ **File naming standardized** - Examples follow consistent naming patterns
5. ✅ **Header comments** - Most examples have proper documentation headers
6. ✅ **NPM scripts** - Comprehensive script coverage in package.json
7. ✅ **Main README updated** - Current structure is documented

### Ongoing Maintenance

To maintain consistency:

1. Add README.md files for any new NIPs
2. Follow the established naming conventions for new examples
3. Update script patterns in package.json for new examples
4. Ensure all new examples have proper header comments
5. Keep the main examples README.md updated with new additions

This standardization will make examples more consistent, easier to navigate, and more helpful for new users of the library. 