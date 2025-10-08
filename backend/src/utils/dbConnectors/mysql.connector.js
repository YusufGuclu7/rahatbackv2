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
  const command = `mysql -h ${config.host} -P ${config.port} -u ${config.username} -p${config.password} ${config.database} < "${backupFilePath}"`;

  try {
    const startTime = Date.now();
    await execPromise(command, { maxBuffer: 1024 * 1024 * 100 });
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
