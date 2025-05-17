import { NostrRelay } from '../utils/ephemeral-relay';

declare global {
  // eslint-disable-next-line no-var
  var __NOSTR_RELAY_INSTANCE__: NostrRelay | undefined;
}

export {}; // This line ensures the file is treated as a module. 