/**
 * Global test setup and utilities
 */

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_ACCESS_EXPIRATION_MINUTES = '30';
process.env.JWT_REFRESH_EXPIRATION_DAYS = '30';

// Increase timeout for database operations
jest.setTimeout(10000);

// Mock logger to avoid console spam in tests
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Global test cleanup
afterAll(async () => {
  // Close database connections, etc.
  await new Promise((resolve) => setTimeout(resolve, 500));
});
