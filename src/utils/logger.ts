/**
 * Simple logger with configurable log levels
 */

/** Supported logger verbosity levels, ordered from silent to most verbose. */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

/** Configuration for a {@link Logger} instance. */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  includeTimestamp?: boolean;
  silent?: boolean; // For testing - suppress all output
}

/** Values accepted as structured context by the shared diagnostic contract. */
export type DiagnosticLogArgument =
  | string
  | number
  | boolean
  | object
  | null
  | undefined;

/** Platform-safe five-level diagnostic seam used throughout SNSTR. */
export interface DiagnosticLogger {
  error(message: string, ...args: DiagnosticLogArgument[]): void;
  warn(message: string, ...args: DiagnosticLogArgument[]): void;
  info(message: string, ...args: DiagnosticLogArgument[]): void;
  debug(message: string, ...args: DiagnosticLogArgument[]): void;
  trace(message: string, ...args: DiagnosticLogArgument[]): void;
}

/** Lightweight console-backed logger with level filtering and optional prefixes. */
export class Logger implements DiagnosticLogger {
  private level: LogLevel;
  private prefix: string;
  private includeTimestamp: boolean;
  private silent: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.includeTimestamp = options.includeTimestamp ?? false;
    this.silent = options.silent ?? false;
  }

  private formatMessage(message: string): string {
    let formattedMessage = "";

    if (this.includeTimestamp) {
      formattedMessage += `[${new Date().toISOString()}] `;
    }

    if (this.prefix) {
      formattedMessage += `[${this.prefix}] `;
    }

    return formattedMessage + message;
  }

  error(message: string, ...args: DiagnosticLogArgument[]): void {
    if (!this.silent && this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: DiagnosticLogArgument[]): void {
    if (!this.silent && this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: DiagnosticLogArgument[]): void {
    if (!this.silent && this.level >= LogLevel.INFO) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  debug(message: string, ...args: DiagnosticLogArgument[]): void {
    if (!this.silent && this.level >= LogLevel.DEBUG) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  trace(message: string, ...args: DiagnosticLogArgument[]): void {
    if (!this.silent && this.level >= LogLevel.TRACE) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
