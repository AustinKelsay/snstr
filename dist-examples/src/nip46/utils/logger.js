"use strict";
/**
 * Simple logger with configurable log levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["NONE"] = 0] = "NONE";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["INFO"] = 3] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 5] = "TRACE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.prefix = options.prefix ?? '';
        this.includeTimestamp = options.includeTimestamp ?? false;
    }
    formatMessage(message) {
        let formattedMessage = '';
        if (this.includeTimestamp) {
            formattedMessage += `[${new Date().toISOString()}] `;
        }
        if (this.prefix) {
            formattedMessage += `[${this.prefix}] `;
        }
        return formattedMessage + message;
    }
    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(this.formatMessage(message), ...args);
        }
    }
    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.formatMessage(message), ...args);
        }
    }
    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.log(this.formatMessage(message), ...args);
        }
    }
    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(this.formatMessage(message), ...args);
        }
    }
    trace(message, ...args) {
        if (this.level >= LogLevel.TRACE) {
            console.log(this.formatMessage(message), ...args);
        }
    }
    setLevel(level) {
        this.level = level;
    }
}
exports.Logger = Logger;
