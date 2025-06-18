// Set test environment
process.env.NODE_ENV = 'test';

// Increase Jest timeout for async operations
jest.setTimeout(30000);

// Mock window.open for auth challenge tests
if (typeof window !== 'undefined') {
  window.open = jest.fn();
} 