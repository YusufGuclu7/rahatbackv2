const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execPromise = promisify(exec);

/**
 * Test MySQL database connection
 */
const testConnection = async (config) => {
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
    });

    const [rows] = await connection.query('SELECT VERSION() as version');
    await connection.end();

    return {
      success: true,
      message: 'Connection successful',
      version: rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Create MySQL backup using mysqldump
 */
const createBackup = async (config, outputPath) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${config.database}_${timestamp}.sql`;
  const filePath = path.join(outputPath, fileName);

  // Build mysqldump command
  const command = `mysqldump -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} ${config.database} > "${filePath}"`;

  try {
    const startTime = Date.now();
    await execPromise(command, { maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer
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
 * Restore MySQL database from backup
 */
const restoreBackup = async (config, backupFilePath) => {
  // Kill all connections to the database before dropping
  const killConnectionsCommand = `mysql -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} -e "SELECT CONCAT('KILL ', id, ';') FROM INFORMATION_SCHEMA.PROCESSLIST WHERE db = '${config.database}' AND id != CONNECTION_ID() INTO OUTFILE '/tmp/kill_connections.txt'; SOURCE /tmp/kill_connections.txt;" || true`;

  // Simpler approach: Drop and recreate with FORCE (MySQL 8.0+)
  const dropCommand = `mysql -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} -e "DROP DATABASE IF EXISTS ${config.database};"`;
  const createCommand = `mysql -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} -e "CREATE DATABASE ${config.database};"`;
  const restoreCommand = `mysql -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} ${config.database} < "${backupFilePath}"`;

  try {
    const startTime = Date.now();

    // Try to kill connections (may fail on some MySQL versions, that's ok)
    try {
      await execPromise(killConnectionsCommand, { maxBuffer: 1024 * 1024 * 100 });
    } catch (err) {
      // Ignore errors from kill connections - continue with drop
    }

    // Drop existing database
    await execPromise(dropCommand, { maxBuffer: 1024 * 1024 * 100 });

    // Create fresh database
    await execPromise(createCommand, { maxBuffer: 1024 * 1024 * 100 });

    // Restore from backup
    await execPromise(restoreCommand, { maxBuffer: 1024 * 1024 * 100 });

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
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
    });

    const [rows] = await connection.query(
      `SELECT SUM(data_length + index_length) as size
       FROM information_schema.tables
       WHERE table_schema = ?`,
      [config.database]
    );
    await connection.end();

    return {
      success: true,
      size: parseInt(rows[0].size || 0, 10),
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
