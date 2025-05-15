# NIP Implementation Standardization Guide

This document outlines the recommended folder structure and file organization for NIP implementations in the SNSTR library. Following these guidelines will ensure consistency across all NIPs and make the codebase more maintainable.

## Standard Folder Structure

Each NIP implementation should follow this structure:

```
src/nipXX/
├── index.ts       # Main implementation, re-exports
├── types.ts       # Type definitions (if substantial)
├── client.ts      # Client implementation (if applicable)
├── utils.ts       # Helper functions (if applicable)
└── README.md      # Documentation
```

### Special Structure for NIP-01

NIP-01 (core protocol) has a specialized structure due to its foundational nature:

```
src/nip01/
├── event.ts           # Event creation, validation, and utility functions
├── nostr.ts           # Main Nostr client implementation 
├── relay.ts           # Relay connection and subscription management
├── relay-connection.ts # WebSocket connection handling
└── README.md          # Documentation
```

### When to Split Files

- **NIP-01**: Uses its own structure as the foundation of the protocol
- **Small NIPs**: For simple NIPs (like NIP-04, NIP-05), having just `index.ts` and `README.md` is sufficient
- **Medium NIPs**: For NIPs with more functionality, split into `index.ts`, `types.ts`, and `README.md`
- **Complex NIPs**: For complex NIPs (like NIP-46, NIP-47, NIP-57), use the full structure with additional files as needed

## File Contents Guidelines

### index.ts

- Start with a JSDoc comment describing the NIP
- Export types, constants, and functions
- For complex NIPs, re-export from other files

Example:
```typescript
/**
 * NIP-XX: Brief Description
 * 
 * Implementation of the NIP-XX specification which...
 * 
 * @see https://github.com/nostr-protocol/nips/blob/master/XX.md
 */

// Import from other files (for complex NIPs)
import { ... } from './types';
import { ... } from './utils';

// Export constants
export const SOME_CONSTANT = 'value';

// Export types
export interface SomeInterface { ... }

// Export functions
export function someFunction() { ... }

// Re-export from other files
export * from './types';
export { ClientClass } from './client';
```

### types.ts

- Define interfaces, types, and enums
- Group related types together
- Add JSDoc comments for each type

Example:
```typescript
/**
 * Types for NIP-XX implementation
 */

/**
 * Description of what this interface represents
 */
export interface SomeInterface {
  property: string;
  optional?: boolean;
}

/**
 * Enum for different types of...
 */
export enum SomeEnum {
  FirstOption = 'first',
  SecondOption = 'second'
}
```

### client.ts

- Implement client classes for interacting with the NIP
- Keep implementation details in this file
- Export a clean interface

Example:
```typescript
import { ... } from '../types/nostr';
import { ... } from './types';

/**
 * Client implementation for NIP-XX
 */
export class NipXXClient {
  constructor(options: ClientOptions) { ... }
  
  async doSomething(): Promise<Result> { ... }
}

export interface ClientOptions { ... }
```

### utils.ts

- Implement helper functions
- Keep implementation details separate from the main API
- Export utility functions that may be used by other parts of the codebase

## README.md Structure

Every NIP should have a README.md file with the following sections:

1. **Title and NIP Reference**: `# NIP-XX: Title` with link to the NIP
2. **Overview**: Brief description of what the NIP does
3. **Key Features**: Bullet points highlighting main features
4. **Basic Usage**: Code examples showing how to use the implementation
5. **Implementation Details**: Technical details about the implementation
6. **Security Considerations** (if applicable): Security notes
7. **Additional Sections** (if needed): Protocol flow, advanced usage, etc.

## Export Pattern in Main index.ts

The main `src/index.ts` file should have consistent export grouping:

```typescript
// Export NIP-01 core protocol components
export {
  // Classes
  Nostr,
  RelayPool,
  
  // Types
  Event,
  Filter,
  RelayEvent,
  
  // Functions
  createEvent,
  verifyEvent
} from './nip01';

// Export NIP-XX utilities
export {
  // Constants
  CONSTANT_A,
  CONSTANT_B,
  
  // Types
  SomeInterface,
  SomeEnum,
  
  // Functions
  functionA,
  functionB,
  
  // Classes
  NipXXClient
} from './nipXX';
```

## Implementation Checklist

When implementing a NIP, ensure:

- [ ] README.md is complete with all required sections
- [ ] Appropriate file structure based on complexity
- [ ] Consistent export patterns
- [ ] JSDoc comments for all exported items
- [ ] Proper error handling
- [ ] Clear type definitions

## Migration Plan

For existing NIPs:

1. Add missing README.md files
2. Split complex NIPs into multiple files if needed
3. Standardize export patterns
4. Add JSDoc comments where missing
5. Run tests to ensure functionality is maintained

This standardization will make the codebase more maintainable, easier to navigate, and more accessible to new contributors. 