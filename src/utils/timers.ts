export function maybeUnref(handle: unknown): void {
  if (!handle || typeof handle !== "object") return;
  const unref = (handle as { unref?: unknown }).unref;
  if (typeof unref === "function") {
    (unref as () => void)();
  }
}

