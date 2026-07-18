import type { DiagnosticLogArgument, DiagnosticLogger } from "../utils/logger";

type NIP57DiagnosticLevel = "error" | "warn";

/** Emit optional NIP-57 diagnostics without changing public control flow. */
export function reportNIP57Diagnostic(
  logger: DiagnosticLogger | undefined,
  level: NIP57DiagnosticLevel,
  message: string,
  ...context: DiagnosticLogArgument[]
): void {
  try {
    logger?.[level](message, ...context);
  } catch {
    // Diagnostics are observational and must not replace client results.
  }
}
