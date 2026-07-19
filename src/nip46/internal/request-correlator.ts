import { NIP46Response } from "../types";

export interface PendingNIP46Request {
  resolve: (response: NIP46Response) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Owns request registration, timeout, response correlation, and cancellation. */
export class NIP46RequestCorrelator {
  readonly pending = new Map<string, PendingNIP46Request>();

  register(
    requestId: string,
    timeoutMs: number,
    timeoutError: () => Error,
  ): Promise<NIP46Response> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(timeoutError());
      }, timeoutMs);

      if (typeof timeout === "object" && "unref" in timeout) {
        timeout.unref();
      }

      this.pending.set(requestId, { resolve, reject, timeout });
    });
  }

  settle(response: NIP46Response): boolean {
    const pending = this.pending.get(response.id);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    pending.resolve(response);
    return true;
  }

  reject(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    pending.reject(error);
  }

  cancelAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
