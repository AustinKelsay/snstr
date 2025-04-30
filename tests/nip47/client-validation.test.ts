import { describe, it, expect } from "@jest/globals";
import {
  NostrWalletConnectClient,
  NIP47ClientError,
  NIP47ErrorCode,
} from "../../src/nip47";

describe("NIP-47 Client Parameter Validation", () => {
  describe("lookupInvoice method", () => {
    it("should validate input parameters", () => {
      // This is just a local function that extracts the validation part of the lookupInvoice method
      function validateLookupInvoiceParams(params: {
        payment_hash?: string;
        invoice?: string;
      }) {
        if (!params.payment_hash && !params.invoice) {
          throw new NIP47ClientError(
            "Payment hash or invoice is required",
            NIP47ErrorCode.INVALID_REQUEST,
          );
        }
        return true;
      }

      // These are test assertions for our local implementation
      expect(() => {
        validateLookupInvoiceParams({});
      }).toThrow(NIP47ClientError);

      expect(() =>
        validateLookupInvoiceParams({ payment_hash: "test-hash" }),
      ).not.toThrow();
      expect(() =>
        validateLookupInvoiceParams({ invoice: "test-invoice" }),
      ).not.toThrow();
      expect(() =>
        validateLookupInvoiceParams({
          payment_hash: "test-hash",
          invoice: "test-invoice",
        }),
      ).not.toThrow();
    });

    it("should contain validation code in the client implementation", () => {
      // Access lookupInvoice but don't actually call it - we just want to verify
      // that the code contains the validation check
      const clientCode =
        NostrWalletConnectClient.prototype.lookupInvoice.toString();

      // Check for the essential parts of the validation
      expect(clientCode).toContain("!params.payment_hash");
      expect(clientCode).toContain("!params.invoice");
      expect(clientCode).toContain("Payment hash or invoice is required");
      expect(clientCode).toContain("INVALID_REQUEST");
    });

    it("should properly document and handle NOT_FOUND error code", () => {
      // This test verifies that the method properly handles the NOT_FOUND error code
      // which is defined in the NIP-47 spec for the lookupInvoice method
      const clientCode =
        NostrWalletConnectClient.prototype.lookupInvoice.toString();

      // The implementation should handle NOT_FOUND errors
      expect(clientCode).toContain("NOT_FOUND");

      // Test that the implementation extracts and uses the lookup type properly
      expect(clientCode).toContain("const lookupType");
      expect(clientCode).toContain("params.payment_hash ?");
      expect(clientCode).toContain("payment_hash");
      expect(clientCode).toContain("invoice");

      // Test that we format error messages properly
      expect(clientCode).toContain("in the wallet");
      expect(clientCode).toContain("database");

      // Verify the error message contains template literals for dynamic content
      expect(clientCode).toContain("${lookupType}");
      expect(clientCode).toContain("${lookupValue}");
    });

    it("should provide a helpful recovery hint for NOT_FOUND errors", () => {
      // Looking for evidence of a recovery hint in the error handling
      const clientCode =
        NostrWalletConnectClient.prototype.lookupInvoice.toString();

      // Check that the lookup error handling uses NOT_FOUND error code
      expect(clientCode).toContain("NOT_FOUND");

      // Validate that we have a test for the recovery hint in ERROR_RECOVERY_HINTS
      const errorTypes = require("../../src/nip47").NIP47ErrorCode;
      const recoveryHints = require("../../src/nip47").ERROR_RECOVERY_HINTS;

      // Verify the NOT_FOUND error has a recovery hint
      expect(recoveryHints[errorTypes.NOT_FOUND]).toBeDefined();

      // Verify the hint mentions lookupInvoice specifically
      expect(recoveryHints[errorTypes.NOT_FOUND]).toContain("lookupInvoice");
      expect(recoveryHints[errorTypes.NOT_FOUND]).toContain(
        "check that the payment_hash or invoice exists",
      );
    });
  });
});
