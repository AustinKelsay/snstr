import { ConsoleLogger } from "../../src";
import type {
  DiagnosticLogArgument,
  DiagnosticLogger,
  Logger as NIP02Logger,
  LoggerOptions,
  NIP47LogArgument,
  NIP47Logger,
  WarningLogger,
} from "../../src";
import type {
  DiagnosticLogArgument as WebDiagnosticLogArgument,
  DiagnosticLogger as WebDiagnosticLogger,
  Logger as WebNIP02Logger,
  LoggerOptions as WebLoggerOptions,
  NIP47LogArgument as WebNIP47LogArgument,
  NIP47Logger as WebNIP47Logger,
  WarningLogger as WebWarningLogger,
} from "../../src/entries/index.web";
import type { LogData } from "../../src/nip02";

const diagnostic: DiagnosticLogger = {
  error: (_message, ..._args) => undefined,
  warn: (_message, ..._args) => undefined,
  info: (_message, ..._args) => undefined,
  debug: (_message, ..._args) => undefined,
  trace: (_message, ..._args) => undefined,
};

const webDiagnostic: WebDiagnosticLogger = diagnostic;
const diagnosticArgument: DiagnosticLogArgument = { relay: "wss://relay.test" };
const webDiagnosticArgument: WebDiagnosticLogArgument = diagnosticArgument;
const loggerOptions: LoggerOptions = { silent: true };
const webLoggerOptions: WebLoggerOptions = loggerOptions;
const implementation: DiagnosticLogger = new ConsoleLogger(webLoggerOptions);
const warnOnly = {
  warn: (_message: string, _data?: LogData): void => undefined,
};
const warningLogger: WarningLogger = warnOnly;
const legacyNIP02Logger: NIP02Logger = warnOnly;
const webWarningLogger: WebWarningLogger = warnOnly;
const webLegacyNIP02Logger: WebNIP02Logger = warnOnly;
const contextualLegacyNIP02Logger: NIP02Logger = {
  warn: (_message, data) => {
    const value: string | undefined = data?.value;
    const tagIndex: number | undefined = data?.context?.tagIndex;
    void value;
    void tagIndex;
  },
};
const consoleWarningLogger: WarningLogger = new ConsoleLogger({ silent: true });
const legacyNIP47Logger: NIP47Logger = diagnostic;
const canonicalFromLegacyNIP47: DiagnosticLogger = legacyNIP47Logger;
const webLegacyNIP47Logger: WebNIP47Logger = diagnostic;
const nip47Argument: NIP47LogArgument = diagnosticArgument;
const webNIP47Argument: WebNIP47LogArgument = nip47Argument;

export {
  diagnostic,
  webDiagnostic,
  diagnosticArgument,
  webDiagnosticArgument,
  loggerOptions,
  webLoggerOptions,
  implementation,
  warnOnly,
  warningLogger,
  legacyNIP02Logger,
  webWarningLogger,
  webLegacyNIP02Logger,
  contextualLegacyNIP02Logger,
  consoleWarningLogger,
  legacyNIP47Logger,
  canonicalFromLegacyNIP47,
  webLegacyNIP47Logger,
  nip47Argument,
  webNIP47Argument,
};
