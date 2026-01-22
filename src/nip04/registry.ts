/**
 * NIP-04 module registry for environment-agnostic crypto.
 *
 * Each environment's entry point (index.ts for Node, web.ts for browser)
 * registers its implementation at import time. This approach:
 * - Maintains synchronous API (no breaking changes)
 * - Works with bundler static analysis (proper tree-shaking)
 * - Node code never bundled in web builds
 */

type NIP04Module = {
  encrypt: (privateKey: string, publicKey: string, message: string) => string;
  decrypt: (
    privateKey: string,
    publicKey: string,
    ciphertext: string,
  ) => string;
  getSharedSecret: (privateKey: string, publicKey: string) => Uint8Array;
};

let registeredModule: NIP04Module | null = null;

/**
 * Register a NIP-04 implementation.
 * Called automatically when importing 'snstr' or 'snstr/nip04'.
 */
export function registerNIP04(module: NIP04Module): void {
  registeredModule = module;
}

/**
 * Get the registered NIP-04 implementation.
 * @throws Error if no module has been registered
 */
export function getRegisteredNIP04(): NIP04Module {
  if (!registeredModule) {
    throw new Error(
      "NIP-04 module not registered. Import 'snstr' or 'snstr/nip04' at app startup.",
    );
  }
  return registeredModule;
}
