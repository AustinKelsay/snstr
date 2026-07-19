import {
  Logger,
  LogLevel,
  type DiagnosticLogArgument,
  type DiagnosticLogger,
  type LoggerOptions,
} from "./logger";

type DiagnosticMethod = keyof DiagnosticLogger;

/** Emit an observational diagnostic without allowing the sink to alter behavior. */
export function reportDiagnostic(
  logger: DiagnosticLogger,
  method: DiagnosticMethod,
  message: string,
  ...context: DiagnosticLogArgument[]
): void {
  try {
    logger[method].call(logger, message, ...context);
  } catch {
    // Diagnostics are observational and must not replace public results/errors.
  }
}

/** Wrap an injected logger so every diagnostic method is non-throwing. */
export function protectDiagnosticLogger(
  logger: DiagnosticLogger,
): DiagnosticLogger {
  return {
    error: (message, ...context) =>
      reportDiagnostic(logger, "error", message, ...context),
    warn: (message, ...context) =>
      reportDiagnostic(logger, "warn", message, ...context),
    info: (message, ...context) =>
      reportDiagnostic(logger, "info", message, ...context),
    debug: (message, ...context) =>
      reportDiagnostic(logger, "debug", message, ...context),
    trace: (message, ...context) =>
      reportDiagnostic(logger, "trace", message, ...context),
  };
}

/** Create the WARN-visible console-backed default used by production modules. */
export function createDefaultDiagnosticLogger(
  options: LoggerOptions = {},
): DiagnosticLogger {
  return protectDiagnosticLogger(
    new Logger({ level: LogLevel.WARN, ...options }),
  );
}

/** Return stable failure metadata without forwarding untrusted error messages. */
export function diagnosticFailureType(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error === null) return "null";
  return typeof error;
}

/** Remove credentials, paths, queries, and fragments from relay diagnostics. */
export function safeRelayDiagnostic(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return "<invalid-relay-url>";
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "<invalid-relay-url>";
  }
}
