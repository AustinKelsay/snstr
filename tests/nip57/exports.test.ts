import { parseBolt11Invoice } from "../../src";
import { parseBolt11Invoice as parseBolt11InvoiceDirect } from "../../src/nip57/utils";

describe("NIP-57 exports", () => {
  it("re-exports parseBolt11Invoice from the package root", () => {
    expect(parseBolt11Invoice).toBe(parseBolt11InvoiceDirect);
  });
});
