const DEFAULT_REPLAY_WINDOW_MS = 120_000;

export interface NIP46ReplayGuardOptions {
  windowMs?: number;
  now?: () => number;
}

/** Owns the bounded replay window for NIP-46 request identifiers. */
export class NIP46ReplayGuard {
  private readonly seenAt = new Map<string, number>();
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: NIP46ReplayGuardOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_REPLAY_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  /** Return true for an already-seen ID, otherwise record it. */
  isReplay(requestId: string): boolean {
    if (this.seenAt.has(requestId)) return true;
    this.seenAt.set(requestId, this.now());
    return false;
  }

  /** Remove IDs older than the configured replay window. */
  cleanup(): number {
    const now = this.now();
    let cleaned = 0;
    for (const [requestId, timestamp] of this.seenAt) {
      if (now - timestamp > this.windowMs) {
        this.seenAt.delete(requestId);
        cleaned += 1;
      }
    }
    return cleaned;
  }

  clear(): void {
    this.seenAt.clear();
  }

  get size(): number {
    return this.seenAt.size;
  }
}
