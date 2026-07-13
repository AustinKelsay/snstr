import {
  Logger as CoreLogger,
  LogLevel as CoreLogLevel,
} from "../../src/utils/logger";
import {
  Logger as CompatibilityLogger,
  LogLevel as CompatibilityLogLevel,
} from "../../src/nip46/utils/logger";

describe("logger compatibility seam", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("keeps core and NIP-46 exports identical at runtime", () => {
    expect(CompatibilityLogger).toBe(CoreLogger);
    expect(CompatibilityLogLevel).toBe(CoreLogLevel);
  });

  test("preserves logger level filtering and message formatting", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const logger = new CompatibilityLogger({
      level: CompatibilityLogLevel.INFO,
      prefix: "compat",
    });

    logger.info("ready", "argument");
    logger.debug("hidden");

    expect(log).toHaveBeenCalledWith("[compat] ready", "argument");
    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    logger.setLevel(CompatibilityLogLevel.WARN);
    logger.warn("visible");

    expect(warn).toHaveBeenCalledWith("[compat] visible");
  });
});
