/**
 * Shared test configuration for NIP-46 tests
 * Provides consistent timeouts and delays across all NIP-46 test suites
 */

export const NIP46_TEST_CONFIG = {
  // Timeouts
  JEST_TIMEOUT: 60000, // 60 seconds for test suite
  CLIENT_TIMEOUT: 10000, // 10 seconds for client operations
  SHORT_CLIENT_TIMEOUT: 5000, // 5 seconds for tests that expect timeouts

  // Delays for stability when running full test suite
  RELAY_STARTUP_DELAY: 100, // ms to wait after relay starts
  RELAY_CLEANUP_DELAY: 50, // ms to wait after relay cleanup
  BUNKER_STARTUP_DELAY: 50, // ms to wait after bunker starts
  BETWEEN_TEST_DELAY: 25, // ms between individual tests

  // Test suite timeouts
  BEFORE_ALL_TIMEOUT: 15000, // 15 seconds for setup
  AFTER_ALL_TIMEOUT: 15000, // 15 seconds for teardown

  // Performance test thresholds (adjusted for CI/CD)
  ENCRYPTION_PERF_THRESHOLD: 150, // ms for encryption operations
  KEY_DERIVATION_THRESHOLD: 100, // ms for key derivation
};

/**
 * Helper to create delays with proper cleanup
 */
export function testDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Unref to prevent keeping process alive
    if (timer.unref) timer.unref();
  });
}
