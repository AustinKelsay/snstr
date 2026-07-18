import {
  DiagnosticLogArgument,
  DiagnosticLogger,
  LogLevel,
  Logger,
  LoggerOptions,
} from "../../utils/logger";

const REDACTED = "[REDACTED]";
const SENSITIVE_FIELD_NAMES = new Set([
  "authurl",
  "ciphertext",
  "connectionstring",
  "connectresult",
  "content",
  "data",
  "decrypted",
  "decrypteddata",
  "eventdata",
  "params",
  "plaintext",
  "result",
  "secret",
]);
const LEGACY_PAYLOAD_MESSAGE = /^(.*(?:decrypted content|json payload):).*/i;
const LEGACY_RESPONSE_ENVELOPE_MESSAGE = /sending response for request/i;
const CONNECTION_URI = /\b(bunker|nostrconnect):\/\/[^\s"']+/gi;

function normalizedFieldName(fieldName: string): string {
  return fieldName.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function redactDiagnosticText(value: string): string {
  const withoutConnectionUris = value.replace(
    CONNECTION_URI,
    (_match, scheme: string) => `${scheme}://${REDACTED}`,
  );

  return withoutConnectionUris.replace(
    LEGACY_PAYLOAD_MESSAGE,
    (_match, prefix: string) => `${prefix} ${REDACTED}`,
  );
}

function redactDiagnosticValue(
  value: DiagnosticLogArgument,
  seen: WeakSet<object>,
): DiagnosticLogArgument {
  if (typeof value === "string") {
    return redactDiagnosticText(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  try {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactDiagnosticText(value.message),
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        redactDiagnosticValue(item as DiagnosticLogArgument, seen),
      );
    }

    const sanitized: Record<string, DiagnosticLogArgument> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_FIELD_NAMES.has(normalizedFieldName(key))) {
        sanitized[key] = REDACTED;
        continue;
      }

      sanitized[key] = redactDiagnosticValue(
        nestedValue as DiagnosticLogArgument,
        seen,
      );
    }

    return sanitized;
  } finally {
    seen.delete(value);
  }
}

/**
 * NIP-46 diagnostic boundary that strips protocol payloads and connection
 * secrets before forwarding safe operation metadata to the configured logger.
 */
export class NIP46DiagnosticLogger implements DiagnosticLogger {
  private readonly delegate: DiagnosticLogger;

  constructor(delegate: DiagnosticLogger) {
    this.delegate = delegate;
  }

  static create(
    logger: DiagnosticLogger | undefined,
    defaultOptions: LoggerOptions,
  ): NIP46DiagnosticLogger {
    return new NIP46DiagnosticLogger(logger ?? new Logger(defaultOptions));
  }

  private write(
    level: keyof DiagnosticLogger,
    message: string,
    args: DiagnosticLogArgument[],
  ): void {
    try {
      const sanitizedArguments = LEGACY_RESPONSE_ENVELOPE_MESSAGE.test(message)
        ? args.map(() => REDACTED)
        : args.map((argument) =>
            redactDiagnosticValue(argument, new WeakSet<object>()),
          );
      this.delegate[level](
        redactDiagnosticText(message),
        ...sanitizedArguments,
      );
    } catch {
      // Diagnostics are observational and must not alter NIP-46 behavior.
    }
  }

  error(message: string, ...args: DiagnosticLogArgument[]): void {
    this.write("error", message, args);
  }

  warn(message: string, ...args: DiagnosticLogArgument[]): void {
    this.write("warn", message, args);
  }

  info(message: string, ...args: DiagnosticLogArgument[]): void {
    this.write("info", message, args);
  }

  debug(message: string, ...args: DiagnosticLogArgument[]): void {
    this.write("debug", message, args);
  }

  trace(message: string, ...args: DiagnosticLogArgument[]): void {
    this.write("trace", message, args);
  }

  setLevel(level: LogLevel): void {
    try {
      const levelAwareLogger = this.delegate as DiagnosticLogger & {
        setLevel?: (nextLevel: LogLevel) => void;
      };
      levelAwareLogger.setLevel?.(level);
    } catch {
      // A custom logger controls its own filtering and cannot alter behavior.
    }
  }
}
