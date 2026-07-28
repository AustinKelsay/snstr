import type { DiagnosticLogger } from "../../src/utils/logger";
import { createRelayTransport } from "../../src/utils/ephemeral-relay/transport";

const logger: DiagnosticLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
};

describe("ephemeral Relay transport", () => {
  test("releases its server when session shutdown rejects", async () => {
    const globals = globalThis as typeof globalThis & { Bun?: unknown };
    const isBun = typeof globals.Bun !== "undefined";
    const hadBun = Object.prototype.hasOwnProperty.call(globals, "Bun");
    const previousBun = globals.Bun;
    if (!isBun) globals.Bun = {};
    const transport = createRelayTransport({
      port: 0,
      logger,
      onConnection: () => {},
    });
    const shutdownError = new Error("session shutdown failed");

    try {
      await transport.start();

      await expect(
        transport.close(
          async () => {
            throw shutdownError;
          },
          () => {},
        ),
      ).rejects.toBe(shutdownError);
      expect(() => transport.server).toThrow(
        "websocket server not initialized",
      );
    } finally {
      if (!isBun) {
        if (hadBun) globals.Bun = previousBun;
        else delete globals.Bun;
      }
    }
  });
});
