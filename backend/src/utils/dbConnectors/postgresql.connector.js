const { Client } = require('pg');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execPromise = promisify(exec);

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
  const command = `pg_dump -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -F p -f "${filePath}"`;

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

  const command = `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f "${backupFilePath}"`;

  try {
    const startTime = Date.now();
    await execPromise(command, { env, maxBuffer: 1024 * 1024 * 100 });
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
