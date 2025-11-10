/**
 * Test helper utilities
 */

/**
 * Generate a fake user object for testing
 */
const generateFakeUser = (overrides = {}) => {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    isEmailVerified: false,
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Generate a fake database config for testing
 */
const generateFakeDatabase = (overrides = {}) => {
  return {
    id: 1,
    userId: 1,
    name: 'Test Database',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    username: 'testuser',
    password: 'testpass',
    database: 'testdb',
    sslEnabled: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Generate a fake backup job for testing
 */
const generateFakeBackupJob = (overrides = {}) => {
  return {
    id: 1,
    databaseId: 1,
    name: 'Test Backup Job',
    scheduleType: 'daily',
    cronExpression: null,
    storageType: 'local',
    storagePath: '/backups',
    cloudStorageId: null,
    retentionDays: 30,
    compression: true,
    isActive: true,
    lastRunAt: null,
    nextRunAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Generate a fake audit log entry for testing
 */
const generateFakeAuditLog = (overrides = {}) => {
  return {
    id: 1,
    userId: 1,
    action: 'LOGIN',
    resource: 'auth',
    resourceId: null,
    details: JSON.stringify({ method: 'POST', path: '/v1/auth/login' }),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    status: 'success',
    errorMessage: null,
    createdAt: new Date(),
    ...overrides,
  };
};

/**
 * Generate a fake cloud storage config for testing
 */
const generateFakeCloudStorage = (overrides = {}) => {
  return {
    id: 1,
    userId: 1,
    name: 'Test S3 Storage',
    storageType: 's3',
    isActive: true,
    isDefault: false,
    s3Region: 'us-east-1',
    s3Bucket: 'test-bucket',
    s3AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    s3SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    s3Endpoint: null,
    gdRefreshToken: null,
    gdFolderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a mock request object
 */
const mockRequest = (data = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    path: '/',
    method: 'GET',
    ...data,
  };
};

/**
 * Create a mock response object
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.on = jest.fn().mockReturnValue(res);
  res.statusCode = 200;
  return res;
};

/**
 * Create a mock next function
 */
const mockNext = () => jest.fn();

module.exports = {
  generateFakeUser,
  generateFakeDatabase,
  generateFakeBackupJob,
  generateFakeAuditLog,
  generateFakeCloudStorage,
  mockRequest,
  mockResponse,
  mockNext,
};
