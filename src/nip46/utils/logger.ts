/**
 * Simple logger with configurable log levels
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  includeTimestamp?: boolean;
}

// Type for log arguments that covers most common use cases
type LogArg = string | number | boolean | object | null | undefined;

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private includeTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.includeTimestamp = options.includeTimestamp ?? false;
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

  error(message: string, ...args: LogArg[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: LogArg[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: LogArg[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  debug(message: string, ...args: LogArg[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  trace(message: string, ...args: LogArg[]): void {
    if (this.level >= LogLevel.TRACE) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
