import { 
  fetchRelayInformation, 
  supportsNIP11, 
  relaySupportsNIPs, 
  getRelayPaymentInfo, 
  relayRequiresPayment, 
  useFetchImplementation,
  clearRelayInfoCache
} from '../../src/nip11';

describe('NIP-11 Functions', () => {
  // Mock the global fetch function
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    // Mock implementation of fetch
    mockFetch = jest.fn().mockImplementation((url, options) => {
      // Check if the correct header is sent
      if (options?.headers?.['Accept'] === 'application/nostr+json') {
        // Return mock relay info for a specific test URL
        if (url === 'https://relay.example.com') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              name: 'Test Relay',
              description: 'A test relay',
              pubkey: '0000000000000000000000000000000000000000000000000000000000000000',
              contact: 'admin@example.com',
              supported_nips: [1, 2, 4, 11, 20],
              software: 'test-relay',
              version: '1.0.0',
              limitation: {
                max_message_length: 65536,
                max_subscriptions: 20,
                payments_required: false
              }
            })
          });
        } else if (url === 'https://paid.relay.example.com') {
          // A paid relay example
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              name: 'Paid Relay',
              supported_nips: [1, 2, 4, 11, 20],
              limitation: {
                payments_required: true
              },
              payments_url: 'https://paid.relay.example.com/payments'
            })
          });
        } else if (url === 'https://no.nip11.relay.example.com') {
          // Relay that doesn't support NIP-11
          return Promise.resolve({
            ok: false,
            status: 404
          });
        }
      }
      
      // Default response for unknown URLs or incorrect headers
      return Promise.resolve({
        ok: false,
        status: 404
      });
    });
    
    useFetchImplementation(mockFetch);
    clearRelayInfoCache();
  });
  
  afterEach(() => {
    // Restore the original fetch
    useFetchImplementation(originalFetch);
    jest.clearAllMocks();
  });
  
  test('fetchRelayInformation should convert WebSocket URL to HTTP', async () => {
    const result = await fetchRelayInformation('wss://relay.example.com');
    
    // Check that fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://relay.example.com',
      expect.objectContaining({
        headers: {
          Accept: 'application/nostr+json'
        }
      })
    );
    
    // Check the returned data
    expect(result).toEqual(expect.objectContaining({
      name: 'Test Relay',
      supported_nips: [1, 2, 4, 11, 20]
    }));
  });
  
  test('fetchRelayInformation should reject invalid WebSocket URLs', async () => {
    const result = await fetchRelayInformation('invalid-url');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
  
  test('fetchRelayInformation should use cache for repeated calls', async () => {
    // First call - should use fetch
    await fetchRelayInformation('wss://relay.example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Second call - should use cache
    await fetchRelayInformation('wss://relay.example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still called only once
    
    // Call with cache disabled - should fetch again
    await fetchRelayInformation('wss://relay.example.com', { useCache: false });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  
  test('fetchRelayInformation should return null for non-supporting relays', async () => {
    const result = await fetchRelayInformation('wss://no.nip11.relay.example.com');
    expect(result).toBeNull();
  });
  
  test('fetchRelayInformation should handle HTTP errors gracefully', async () => {
    // Mock fetch to throw an error
    mockFetch.mockImplementationOnce(() => {
      throw new Error('Network error');
    });
    
    const result = await fetchRelayInformation('wss://error.relay.example.com');
    expect(result).toBeNull();
  });
  
  test('fetchRelayInformation should handle timeouts', async () => {
    // Mock fetch to never resolve within the timeout period
    mockFetch.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        // This will be aborted before it resolves
        setTimeout(() => resolve({ ok: true }), 10000);
      });
    });
    
    const result = await fetchRelayInformation('wss://slow.relay.example.com', { timeoutMs: 100 });
    expect(result).toBeNull();
  });
  
  test('supportsNIP11 should return true for supporting relays', async () => {
    const result = await supportsNIP11('wss://relay.example.com');
    expect(result).toBe(true);
  });
  
  test('supportsNIP11 should return false for non-supporting relays', async () => {
    const result = await supportsNIP11('wss://no.nip11.relay.example.com');
    expect(result).toBe(false);
  });
  
  test('relaySupportsNIPs should check for specific NIPs', async () => {
    // Check for NIPs that are supported
    const supportedResult = await relaySupportsNIPs('wss://relay.example.com', [1, 4, 11]);
    expect(supportedResult).toBe(true);
    
    // Check for a NIP that isn't supported
    const unsupportedResult = await relaySupportsNIPs('wss://relay.example.com', [1, 9]);
    expect(unsupportedResult).toBe(false);
  });
  
  test('getRelayPaymentInfo should return payment URL if available', async () => {
    const result = await getRelayPaymentInfo('wss://paid.relay.example.com');
    expect(result).toBe('https://paid.relay.example.com/payments');
    
    const noPaymentResult = await getRelayPaymentInfo('wss://relay.example.com');
    expect(noPaymentResult).toBeNull();
  });
  
  test('relayRequiresPayment should check payment requirements', async () => {
    const paidResult = await relayRequiresPayment('wss://paid.relay.example.com');
    expect(paidResult).toBe(true);
    
    const freeResult = await relayRequiresPayment('wss://relay.example.com');
    expect(freeResult).toBe(false);
  });
  
  test('clearRelayInfoCache should empty the cache', async () => {
    // Populate cache
    await fetchRelayInformation('wss://relay.example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // This should use cache
    await fetchRelayInformation('wss://relay.example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Clear cache
    clearRelayInfoCache();
    
    // This should fetch again
    await fetchRelayInformation('wss://relay.example.com');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
}); 