import { describe, it, expect } from '@jest/globals';
import { 
  NIP47ClientError, 
  NIP47ErrorCode, 
  ERROR_RECOVERY_HINTS, 
  ERROR_CATEGORIES,
  NIP47ErrorCategory 
} from '../../src/nip47';

describe('NIP-47 Error Handling', () => {
  describe('NIP47ClientError', () => {
    it('should create error with appropriate properties', () => {
      const error = new NIP47ClientError('Test error', NIP47ErrorCode.NOT_FOUND);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(NIP47ErrorCode.NOT_FOUND);
      expect(error.name).toBe('NIP47ClientError');
      expect(error.category).toBe(ERROR_CATEGORIES[NIP47ErrorCode.NOT_FOUND]);
      expect(error.recoveryHint).toBe(ERROR_RECOVERY_HINTS[NIP47ErrorCode.NOT_FOUND]);
    });
    
    it('should include additional data if provided', () => {
      const additionalData = { details: 'More information' };
      const error = new NIP47ClientError('Test error', NIP47ErrorCode.NOT_FOUND, additionalData);
      
      expect(error.data).toBe(additionalData);
    });
    
    it('should create user-friendly messages with recovery hints', () => {
      const error = new NIP47ClientError('Test error', NIP47ErrorCode.NOT_FOUND);
      const friendlyMessage = error.getUserMessage();
      
      expect(friendlyMessage).toContain('Test error');
      expect(friendlyMessage).toContain(ERROR_RECOVERY_HINTS[NIP47ErrorCode.NOT_FOUND]);
    });
  });
  
  describe('NOT_FOUND Error Handling', () => {
    it('should have the correct category for NOT_FOUND', () => {
      expect(ERROR_CATEGORIES[NIP47ErrorCode.NOT_FOUND]).toBe(NIP47ErrorCategory.RESOURCE);
    });
    
    it('should have a recovery hint specifically mentioning lookupInvoice', () => {
      const hint = ERROR_RECOVERY_HINTS[NIP47ErrorCode.NOT_FOUND];
      
      expect(hint).toBeDefined();
      expect(hint).toContain('lookupInvoice');
      expect(hint).toContain('check that the payment_hash or invoice exists in the wallet database');
    });
    
    it('should create appropriate error for lookupInvoice NOT_FOUND', () => {
      const paymentHash = 'test123';
      const error = new NIP47ClientError(
        `Invoice not found: Could not find payment_hash: ${paymentHash} in the wallet's database`,
        NIP47ErrorCode.NOT_FOUND
      );
      
      expect(error.message).toContain(paymentHash);
      expect(error.message).toContain('in the wallet\'s database');
      expect(error.code).toBe(NIP47ErrorCode.NOT_FOUND);
      expect(error.category).toBe(NIP47ErrorCategory.RESOURCE);
      
      // Check getUserMessage format
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain(paymentHash);
      expect(userMessage).toContain('in the wallet\'s database');
      expect(userMessage).toContain('lookupInvoice');
    });

    it('should provide consistent error information for all NIP-47 modules', () => {
      // Test that the lookupInvoice error is handled consistently in both client and service
      
      // Create similar NOT_FOUND errors to simulate client and service handling
      const paymentHash = '0123456789abcdef';
      
      // Simulate error as created in service.ts
      const serviceError = {
        code: NIP47ErrorCode.NOT_FOUND,
        message: `Invoice not found: Could not find payment_hash: ${paymentHash} in the wallet's database`,
        category: NIP47ErrorCategory.RESOURCE
      };
      
      // Simulate error as created in client.ts lookupInvoice method
      const clientError = new NIP47ClientError(
        `Invoice not found: Could not find payment_hash: ${paymentHash} in the wallet's database`,
        NIP47ErrorCode.NOT_FOUND
      );
      
      // Test that both errors have the same critical information
      expect(clientError.code).toBe(serviceError.code);
      expect(clientError.message).toBe(serviceError.message);
      expect(clientError.category).toBe(serviceError.category);
      
      // Test that when created from a response error, properties are preserved
      const responseError = {
        code: NIP47ErrorCode.NOT_FOUND,
        message: `Invoice not found: Could not find payment_hash: ${paymentHash} in the wallet's database`,
      };
      
      const fromResponseError = NIP47ClientError.fromResponseError(responseError);
      expect(fromResponseError.code).toBe(NIP47ErrorCode.NOT_FOUND);
      expect(fromResponseError.message).toBe(responseError.message);
      expect(fromResponseError.category).toBe(NIP47ErrorCategory.RESOURCE);
    });
  });
  
  describe('Standardized Error Properties', () => {
    it('should include information matching the NIP-47 specification', () => {
      // In the NIP-47 specification, errors should have code and message fields
      const error = new NIP47ClientError('Test error', NIP47ErrorCode.NOT_FOUND);
      
      // These properties should match what would be sent in a NIP-47 response
      expect(error.code).toBe(NIP47ErrorCode.NOT_FOUND);
      expect(error.message).toBe('Test error');
      
      // Our implementation adds these helpful extensions
      expect(error.category).toBeDefined();
      expect(error.recoveryHint).toBeDefined();
    });
    
    it('should properly handle common NIP-47 error codes', () => {
      // Test each of the standard error codes from the NIP-47 spec
      const standardErrorCodes = [
        NIP47ErrorCode.UNAUTHORIZED,
        NIP47ErrorCode.INVALID_REQUEST,
        NIP47ErrorCode.INSUFFICIENT_BALANCE,
        NIP47ErrorCode.PAYMENT_FAILED,
        NIP47ErrorCode.INVOICE_EXPIRED,
        NIP47ErrorCode.NOT_FOUND,
        NIP47ErrorCode.INTERNAL_ERROR,
        NIP47ErrorCode.REQUEST_EXPIRED
      ];
      
      standardErrorCodes.forEach(code => {
        const error = new NIP47ClientError(`Error with code ${code}`, code);
        expect(error.code).toBe(code);
        expect(error.category).toBeDefined();
        expect(error.recoveryHint).toBeDefined();
        
        // The error should be able to generate a user-friendly message
        const userMessage = error.getUserMessage();
        expect(userMessage.length).toBeGreaterThan(0);
      });
    });
  });
}); 