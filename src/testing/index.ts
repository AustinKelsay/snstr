/**
 * Node-only test support for integration suites and runnable examples.
 *
 * This subpath is supported within the 0.x release line but is not intended
 * for production relay hosting. Its API may evolve between minor 0.x releases.
 */
export { NostrRelay } from "../utils/ephemeral-relay";
export type { NostrRelayOptions } from "../utils/ephemeral-relay";
