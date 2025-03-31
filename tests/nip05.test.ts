/**
 * NIP-05 Tests
 * 
 * These tests verify the functioning of the NIP-05 module
 * for identity verification and relay discovery.
 * 
 * Note: Some tests may need an internet connection to work
 * properly since they query real .well-known/nostr.json files.
 */

import { verifyNIP05, lookupNIP05, getPublicKeyFromNIP05, getRelaysFromNIP05 } from '../src/nip05';

// Mock implementations for testing without network
global.fetch = jest.fn();

describe('NIP-05', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('lookupNIP05', () => {
    it('should return null for invalid identifiers', async () => {
      const result1 = await lookupNIP05('invalid-format');
      const result2 = await lookupNIP05('missingdomain@');
      const result3 = await lookupNIP05('@missingname');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
    
    it('should handle network errors gracefully', async () => {
      // Mock a network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lookupNIP05('user@example.com');
      
      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/.well-known/nostr.json?name=user');
    });
    
    it('should handle non-200 responses gracefully', async () => {
      // Mock a 404 response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      
      const result = await lookupNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should handle invalid JSON responses gracefully', async () => {
      // Mock an invalid JSON response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      });
      
      const result = await lookupNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should handle responses without names field gracefully', async () => {
      // Mock a response missing the names field
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({})
      });
      
      const result = await lookupNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should parse valid responses correctly', async () => {
      const mockResponse = {
        names: {
          user: 'abcdef1234567890',
          another: '0987654321fedcba'
        },
        relays: {
          'abcdef1234567890': ['wss://relay1.example.com', 'wss://relay2.example.com']
        }
      };
      
      // Mock a successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await lookupNIP05('user@example.com');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/.well-known/nostr.json?name=user');
    });
    
    it('should handle root identifiers (_@domain) correctly', async () => {
      // Mock a successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          names: {
            _: 'rootpubkey1234',
          }
        })
      });
      
      const result = await lookupNIP05('_@example.com');
      
      expect(result).not.toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/.well-known/nostr.json');
    });
  });
  
  describe('verifyNIP05', () => {
    it('should return false for invalid identifiers', async () => {
      const result1 = await verifyNIP05('invalid-format', 'pubkey');
      const result2 = await verifyNIP05('missingdomain@', 'pubkey');
      const result3 = await verifyNIP05('@missingname', 'pubkey');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
    
    it('should return false when lookup fails', async () => {
      // Mock a failed lookup
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await verifyNIP05('user@example.com', 'pubkey');
      
      expect(result).toBe(false);
    });
    
    it('should return true when pubkey matches', async () => {
      const pubkey = 'matching_pubkey_123';
      const mockResponse = {
        names: {
          user: pubkey
        }
      };
      
      // Mock a successful response with matching pubkey
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await verifyNIP05('user@example.com', pubkey);
      
      expect(result).toBe(true);
    });
    
    it('should return false when pubkey does not match', async () => {
      const pubkey = 'non_matching_pubkey_456';
      const mockResponse = {
        names: {
          user: 'different_pubkey_789'
        }
      };
      
      // Mock a successful response with non-matching pubkey
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await verifyNIP05('user@example.com', pubkey);
      
      expect(result).toBe(false);
    });
  });
  
  describe('getPublicKeyFromNIP05', () => {
    it('should return null for invalid identifiers', async () => {
      const result1 = await getPublicKeyFromNIP05('invalid-format');
      const result2 = await getPublicKeyFromNIP05('missingdomain@');
      const result3 = await getPublicKeyFromNIP05('@missingname');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
    
    it('should return null when lookup fails', async () => {
      // Mock a failed lookup
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await getPublicKeyFromNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should return pubkey when name exists', async () => {
      const pubkey = 'valid_pubkey_123';
      const mockResponse = {
        names: {
          user: pubkey
        }
      };
      
      // Mock a successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getPublicKeyFromNIP05('user@example.com');
      
      expect(result).toBe(pubkey);
    });
    
    it('should return null when name does not exist', async () => {
      const mockResponse = {
        names: {
          other_user: 'some_pubkey'
        }
      };
      
      // Mock a successful response but without the requested name
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getPublicKeyFromNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getRelaysFromNIP05', () => {
    it('should return null when lookup fails', async () => {
      // Mock a failed lookup
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await getRelaysFromNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should return null when response has no relays field', async () => {
      const mockResponse = {
        names: {
          user: 'pubkey'
        }
        // No relays field
      };
      
      // Mock a successful response without relays
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getRelaysFromNIP05('user@example.com');
      
      expect(result).toBeNull();
    });
    
    it('should return relays for the matching pubkey', async () => {
      const pubkey = 'matching_pubkey';
      const relays = ['wss://relay1.com', 'wss://relay2.com'];
      
      const mockResponse = {
        names: {
          user: pubkey
        },
        relays: {
          [pubkey]: relays
        }
      };
      
      // Mock a successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getRelaysFromNIP05('user@example.com');
      
      expect(result).toEqual(relays);
    });
    
    it('should allow specifying a pubkey directly', async () => {
      const pubkey = 'specified_pubkey';
      const relays = ['wss://relay1.com', 'wss://relay2.com'];
      
      const mockResponse = {
        names: {
          user: 'different_pubkey'
        },
        relays: {
          [pubkey]: relays
        }
      };
      
      // Mock a successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getRelaysFromNIP05('user@example.com', pubkey);
      
      expect(result).toEqual(relays);
    });
  });
}); 