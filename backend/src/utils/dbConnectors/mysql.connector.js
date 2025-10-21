const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

const execPromise = promisify(exec);

/**
 * Validate and sanitize input to prevent command injection
 */
const validateInput = (value, fieldName, pattern = /^[a-zA-Z0-9_\-\.]+$/) => {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
  if (!pattern.test(value)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
  return value;
};

/**
 * Escape shell arguments
 */
const escapeShellArg = (arg) => {
  if (os.platform() === 'win32') {
    // Windows: use double quotes and escape existing quotes
    return `"${arg.replace(/"/g, '""')}"`;
  } else {
    // Unix: use single quotes and escape existing single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
};

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
  // Validate inputs to prevent command injection
  const safeHost = validateInput(config.host, 'host', /^[a-zA-Z0-9\.\-]+$/);
  const safeUsername = validateInput(config.username, 'username', /^[a-zA-Z0-9_\-@\.]+$/);
  const safeDatabase = validateInput(config.database, 'database', /^[a-zA-Z0-9_\-]+$/);
  const safePort = parseInt(config.port, 10);

  if (isNaN(safePort) || safePort < 1 || safePort > 65535) {
    throw new Error('Invalid port number');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeDatabase}_${timestamp}.sql`;
  const filePath = path.join(outputPath, fileName);

  // Use MYSQL_PWD environment variable instead of -p flag to avoid password in process list
  const env = {
    ...process.env,
    MYSQL_PWD: config.password,
  };

  // Build mysqldump command (password via environment variable)
  const command = `mysqldump -h ${safeHost} -P ${safePort} -u ${escapeShellArg(safeUsername)} ${safeDatabase} > "${filePath}"`;

  try {
    const startTime = Date.now();
    await execPromise(command, {
      env,
      maxBuffer: 1024 * 1024 * 500, // 500MB buffer for large databases
      timeout: 30 * 60 * 1000, // 30 minutes timeout for very large backups
    });
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
  // Validate inputs to prevent command injection
  const safeHost = validateInput(config.host, 'host', /^[a-zA-Z0-9\.\-]+$/);
  const safeUsername = validateInput(config.username, 'username', /^[a-zA-Z0-9_\-@\.]+$/);
  const safeDatabase = validateInput(config.database, 'database', /^[a-zA-Z0-9_\-]+$/);
  const safePort = parseInt(config.port, 10);

  if (isNaN(safePort) || safePort < 1 || safePort > 65535) {
    throw new Error('Invalid port number');
  }

  // Validate backup file path
  if (!backupFilePath || !fsSync.existsSync(backupFilePath)) {
    throw new Error('Invalid backup file path');
  }

  // Use MYSQL_PWD environment variable
  const env = {
    ...process.env,
    MYSQL_PWD: config.password,
  };

  // MySQL: Drop all tables to ensure clean restore
  // Use parameterized approach to avoid SQL injection
  const dropTablesCommand = `mysql -h ${safeHost} -P ${safePort} -u ${escapeShellArg(safeUsername)} -N -e "SELECT CONCAT('DROP TABLE IF EXISTS \\\\\`', table_name, '\\\\\`;') FROM information_schema.tables WHERE table_schema = '${safeDatabase}';" ${safeDatabase} | mysql -h ${safeHost} -P ${safePort} -u ${escapeShellArg(safeUsername)} ${safeDatabase}`;

  const restoreCommand = `mysql -h ${safeHost} -P ${safePort} -u ${escapeShellArg(safeUsername)} ${safeDatabase} < "${backupFilePath}"`;

  try {
    const startTime = Date.now();

    // Drop all existing tables (preserves database structure, doesn't disconnect users)
    try {
      await execPromise(dropTablesCommand, {
        env,
        maxBuffer: 1024 * 1024 * 500,
        timeout: 30 * 60 * 1000,
      });
    } catch (err) {
      // If no tables exist, this will fail - that's ok
    }

    // Restore from backup (recreates all tables with data, auto_increment values, etc.)
    await execPromise(restoreCommand, {
      env,
      maxBuffer: 1024 * 1024 * 500, // 500MB buffer for large databases
      timeout: 30 * 60 * 1000, // 30 minutes timeout for very large restores
    });

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
