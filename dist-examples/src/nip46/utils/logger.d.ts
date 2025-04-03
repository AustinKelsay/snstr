/**
 * Simple logger with configurable log levels
 */
export declare enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    TRACE = 5
}
export interface LoggerOptions {
    level?: LogLevel;
    prefix?: string;
    includeTimestamp?: boolean;
}
export declare class Logger {
    private level;
    private prefix;
    private includeTimestamp;
    constructor(options?: LoggerOptions);
    private formatMessage;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    trace(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
}
