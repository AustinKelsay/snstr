import { RelayEvent } from "../../src";
import type { RelayInterface } from "../../src";
import type { RelayTestContext, RelayTestMock } from "../../src/testing";
// @ts-expect-error Relay test helpers are available only from the testing entrypoint.
import type { RelayTestContext as RootRelayTestContext } from "../../src";
// @ts-expect-error The web entry must not expose Node-only relay test helpers.
import type { RelayTestContext as WebRelayTestContext } from "../../src/entries/index.web";

void (undefined as unknown as RootRelayTestContext);
void (undefined as unknown as WebRelayTestContext);

describe("testing entrypoint relay context types", () => {
  test("accepts framework-neutral and Jest mock callables", () => {
    const plainMock: RelayTestMock = (...args: unknown[]) => args.length;
    const jestMock = jest.fn();
    const typedMock = (id: string, accepted: boolean): string =>
      `${id}:${accepted}`;
    const context: RelayTestContext = {
      relay: {} as RelayInterface,
      originals: {},
      mocks: {
        send: plainMock,
        connect: typedMock,
        handlers: {
          [RelayEvent.OK]: jestMock,
        },
      },
      capturedCallbacks: {},
    };

    expect(context.mocks.send?.("request")).toBe(1);
    expect(context.mocks.connect).toBe(typedMock);
    expect(context.mocks.handlers?.[RelayEvent.OK]).toBe(jestMock);
  });
});
