// Jest setup file for unified classification service tests

// Increase timeout for integration tests that may call external services
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },
  
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    
    return {
      message: () => `expected ${received} to be within range ${min} - ${max}`,
      pass,
    };
  },
});