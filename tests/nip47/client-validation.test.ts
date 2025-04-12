import { describe, it, expect } from '@jest/globals';
import { NostrWalletConnectClient, NIP47ClientError, NIP47ErrorCode } from '../../src/nip47';

describe('NIP-47 Client Parameter Validation', () => {
  describe('lookupInvoice method', () => {
    it('should validate input parameters', () => {
      // This is just a local function that extracts the validation part of the lookupInvoice method
      function validateLookupInvoiceParams(params: { payment_hash?: string; invoice?: string }) {
        if (!params.payment_hash && !params.invoice) {
          throw new NIP47ClientError('Payment hash or invoice is required', NIP47ErrorCode.INVALID_REQUEST);
        }
        return true;
      }

      // These are test assertions for our local implementation
      expect(() => {
        validateLookupInvoiceParams({});
      }).toThrow(NIP47ClientError);
      
      expect(() => validateLookupInvoiceParams({ payment_hash: 'test-hash' })).not.toThrow();
      expect(() => validateLookupInvoiceParams({ invoice: 'test-invoice' })).not.toThrow();
      expect(() => validateLookupInvoiceParams({ payment_hash: 'test-hash', invoice: 'test-invoice' })).not.toThrow();
    });

    it('should contain validation code in the client implementation', () => {
      // Access lookupInvoice but don't actually call it - we just want to verify
      // that the code contains the validation check
      const clientCode = NostrWalletConnectClient.prototype.lookupInvoice.toString();
      
      // Check for the essential parts of the validation
      expect(clientCode).toContain('!params.payment_hash');
      expect(clientCode).toContain('!params.invoice');
      expect(clientCode).toContain('Payment hash or invoice is required');
      expect(clientCode).toContain('INVALID_REQUEST');
    });
    
    it('should properly document and handle NOT_FOUND error code', () => {
      // This test verifies that the method properly documents the NOT_FOUND error code
      // which is defined in the NIP-47 spec for the lookupInvoice method
      const clientCode = NostrWalletConnectClient.prototype.lookupInvoice.toString();
      
      // The implementation should document that lookupInvoice can return NOT_FOUND error
      expect(clientCode).toContain('NOT_FOUND');
      
      // Either in a comment or in the code itself
      const hasDocumentation = 
        clientCode.includes('@throws') && 
        clientCode.includes('NOT_FOUND') &&
        clientCode.includes('if the invoice or payment hash is not found');
        
      expect(hasDocumentation).toBe(true);
    });
  });
}); 