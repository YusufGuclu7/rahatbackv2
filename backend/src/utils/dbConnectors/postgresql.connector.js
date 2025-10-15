const { Client } = require('pg');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execPromise = promisify(exec);

// PostgreSQL binary path detection
const getPgBinPath = () => {
  if (os.platform() === 'win32') {
    // Windows: Check common PostgreSQL installation paths
    const commonPaths = [
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
      'C:\\Program Files\\PostgreSQL\\14\\bin',
      'C:\\Program Files\\PostgreSQL\\13\\bin',
      'C:\\Program Files (x86)\\PostgreSQL\\16\\bin',
      'C:\\Program Files (x86)\\PostgreSQL\\15\\bin',
      'C:\\Program Files (x86)\\PostgreSQL\\14\\bin',
    ];

    // Return first existing path, or assume it's in PATH
    const existingPath = commonPaths.find(p => {
      try {
        return require('fs').existsSync(path.join(p, 'pg_dump.exe'));
      } catch {
        return false;
      }
    });

    return existingPath || '';
  }
  return ''; // Unix systems: assume in PATH
};

const PG_BIN_PATH = getPgBinPath();
const PG_DUMP = PG_BIN_PATH ? path.join(PG_BIN_PATH, 'pg_dump') : 'pg_dump';
const PSQL = PG_BIN_PATH ? path.join(PG_BIN_PATH, 'psql') : 'psql';

/**
 * Test PostgreSQL database connection
 */
const testConnection = async (config) => {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    await client.end();
    return {
      success: true,
      message: 'Connection successful',
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Create PostgreSQL backup using pg_dump
 */
const createBackup = async (config, outputPath) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${config.database}_${timestamp}.sql`;
  const filePath = path.join(outputPath, fileName);

  // Set environment variable for password
  const env = {
    ...process.env,
    PGPASSWORD: config.password,
  };

  // Build pg_dump command
  const command = `"${PG_DUMP}" -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -F p -f "${filePath}"`;

  try {
    const startTime = Date.now();
    await execPromise(command, { env, maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Get file size
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    return {
      success: true,
      fileName,
      filePath,
      fileSize,
      duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Restore PostgreSQL database from backup
 */
const restoreBackup = async (config, backupFilePath) => {
  const env = {
    ...process.env,
    PGPASSWORD: config.password,
  };

  // Terminate all active connections to the database before dropping
  const terminateConnectionsCommand = `"${PSQL}" -h ${config.host} -p ${config.port} -U ${config.username} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${config.database}' AND pid <> pg_backend_pid();"`;

  // Drop and recreate the database to ensure clean restore
  const dropCommand = `"${PSQL}" -h ${config.host} -p ${config.port} -U ${config.username} -d postgres -c "DROP DATABASE IF EXISTS ${config.database};"`;
  const createCommand = `"${PSQL}" -h ${config.host} -p ${config.port} -U ${config.username} -d postgres -c "CREATE DATABASE ${config.database};"`;
  const restoreCommand = `"${PSQL}" -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f "${backupFilePath}"`;

  try {
    const startTime = Date.now();

    // Terminate all active connections first
    await execPromise(terminateConnectionsCommand, { env, maxBuffer: 1024 * 1024 * 100 });

    // Drop existing database
    await execPromise(dropCommand, { env, maxBuffer: 1024 * 1024 * 100 });

    // Create fresh database
    await execPromise(createCommand, { env, maxBuffer: 1024 * 1024 * 100 });

    // Restore from backup
    await execPromise(restoreCommand, { env, maxBuffer: 1024 * 1024 * 100 });

    const duration = Math.floor((Date.now() - startTime) / 1000);

    return {
      success: true,
      duration,
      message: 'Restore completed successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get database size
 */
const getDatabaseSize = async (config) => {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT pg_database_size('${config.database}') as size`
    );
    await client.end();
    return {
      success: true,
      size: parseInt(result.rows[0].size, 10),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  testConnection,
  createBackup,
  restoreBackup,
  getDatabaseSize,
};
