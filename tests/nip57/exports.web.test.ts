// Load the web entry at runtime to avoid editor TS(6059) rootDir issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webEntry = require("../../src/entries/index.web");
const parseBolt11Invoice = webEntry.parseBolt11Invoice as (bolt11: string) => unknown;
import { parseBolt11Invoice as parseBolt11InvoiceDirect } from "../../src/nip57/utils";

describe("NIP-57 web entry exports", () => {
  it("re-exports parseBolt11Invoice from the web entry", () => {
    expect(parseBolt11Invoice).toBe(parseBolt11InvoiceDirect);
  });
});
