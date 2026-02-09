export function maybeUnref(handle: unknown): void {
  if (!handle || typeof handle !== "object") return;
  const unref = (handle as { unref?: unknown }).unref;
  if (typeof unref !== "function") return;

  // Timer#unref relies on `this` (it reads internal symbols), so it must be called as a method.
  (unref as (this: unknown) => void).call(handle);
}
