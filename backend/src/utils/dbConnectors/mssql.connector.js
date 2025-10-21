const sql = require('mssql');
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
    return `"${arg.replace(/"/g, '""')}"`;
  } else {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
};

/**
 * Test MS SQL Server database connection
 */
const testConnection = async (config) => {
  try {
    const poolConfig = {
      server: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      options: {
        encrypt: config.sslEnabled || false,
        trustServerCertificate: true, // For dev/testing
        enableArithAbort: true,
      },
      connectionTimeout: 15000,
      requestTimeout: 15000,
    };

    const pool = await sql.connect(poolConfig);
    const result = await pool.request().query('SELECT @@VERSION as version');
    await pool.close();

    return {
      success: true,
      message: 'Connection successful',
      version: result.recordset[0].version,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Create MSSQL backup using sqlcmd
 * Uses T-SQL BACKUP DATABASE command
 */
const createBackup = async (config, outputPath) => {
  // Validate inputs to prevent SQL injection
  const safeHost = validateInput(config.host, 'host', /^[a-zA-Z0-9\.\-]+$/);
  const safeUsername = validateInput(config.username, 'username', /^[a-zA-Z0-9_\-@\.\\]+$/); // Allow backslash for domain users
  const safeDatabase = validateInput(config.database, 'database', /^[a-zA-Z0-9_\-]+$/);
  const safePort = parseInt(config.port, 10);

  if (isNaN(safePort) || safePort < 1 || safePort > 65535) {
    throw new Error('Invalid port number');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeDatabase}_${timestamp}.bak`;
  const filePath = path.join(outputPath, fileName);

  // Use T-SQL BACKUP DATABASE command
  // MSSQL backup files (.bak) are binary and already compressed
  const backupQuery = `BACKUP DATABASE [${safeDatabase}] TO DISK = N'${filePath.replace(/'/g, "''")}' WITH FORMAT, INIT, COMPRESSION, STATS = 10`;

  try {
    const startTime = Date.now();

    const poolConfig = {
      server: safeHost,
      port: safePort,
      user: safeUsername,
      password: config.password,
      database: safeDatabase,
      options: {
        encrypt: config.sslEnabled || false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 30 * 60 * 1000, // 30 minutes for large databases
    };

    const pool = await sql.connect(poolConfig);
    await pool.request().query(backupQuery);
    await pool.close();

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
 * Restore MSSQL database from backup
 * Uses T-SQL RESTORE DATABASE command
 */
const restoreBackup = async (config, backupFilePath) => {
  // Validate inputs to prevent SQL injection
  const safeHost = validateInput(config.host, 'host', /^[a-zA-Z0-9\.\-]+$/);
  const safeUsername = validateInput(config.username, 'username', /^[a-zA-Z0-9_\-@\.\\]+$/);
  const safeDatabase = validateInput(config.database, 'database', /^[a-zA-Z0-9_\-]+$/);
  const safePort = parseInt(config.port, 10);

  if (isNaN(safePort) || safePort < 1 || safePort > 65535) {
    throw new Error('Invalid port number');
  }

  // Validate backup file path
  if (!backupFilePath || !fsSync.existsSync(backupFilePath)) {
    throw new Error('Invalid backup file path');
  }

  const poolConfig = {
    server: safeHost,
    port: safePort,
    user: safeUsername,
    password: config.password,
    database: 'master', // Connect to master for restore operations
    options: {
      encrypt: config.sslEnabled || false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 30000,
    requestTimeout: 30 * 60 * 1000, // 30 minutes for large restores
  };

  try {
    const startTime = Date.now();
    const pool = await sql.connect(poolConfig);

    // 1. Set database to single-user mode and close existing connections
    const setSingleUserQuery = `
      IF EXISTS (SELECT name FROM sys.databases WHERE name = N'${safeDatabase}')
      BEGIN
        ALTER DATABASE [${safeDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      END
    `;

    try {
      await pool.request().query(setSingleUserQuery);
    } catch (err) {
      // If database doesn't exist, that's fine
      if (!err.message.includes('does not exist')) {
        throw err;
      }
    }

    // 2. Get logical file names from backup
    const fileListQuery = `RESTORE FILELISTONLY FROM DISK = N'${backupFilePath.replace(/'/g, "''")}'`;
    const fileListResult = await pool.request().query(fileListQuery);

    const dataFile = fileListResult.recordset.find((f) => f.Type === 'D');
    const logFile = fileListResult.recordset.find((f) => f.Type === 'L');

    if (!dataFile || !logFile) {
      throw new Error('Invalid backup file: Could not find data or log files');
    }

    // 3. Restore database with REPLACE option
    const restoreQuery = `
      RESTORE DATABASE [${safeDatabase}]
      FROM DISK = N'${backupFilePath.replace(/'/g, "''")}'
      WITH FILE = 1,
      MOVE N'${dataFile.LogicalName}' TO N'${dataFile.PhysicalName}',
      MOVE N'${logFile.LogicalName}' TO N'${logFile.PhysicalName}',
      REPLACE,
      STATS = 10
    `;

    await pool.request().query(restoreQuery);

    // 4. Set database back to multi-user mode
    const setMultiUserQuery = `ALTER DATABASE [${safeDatabase}] SET MULTI_USER`;
    await pool.request().query(setMultiUserQuery);

    await pool.close();

    const duration = Math.floor((Date.now() - startTime) / 1000);

    return {
      success: true,
      duration,
      message: 'Restore completed successfully',
    };
  } catch (error) {
    // Try to set database back to multi-user mode if restore failed
    try {
      const pool = await sql.connect(poolConfig);
      await pool.request().query(`
        IF EXISTS (SELECT name FROM sys.databases WHERE name = N'${safeDatabase}')
        BEGIN
          ALTER DATABASE [${safeDatabase}] SET MULTI_USER;
        END
      `);
      await pool.close();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

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
    const poolConfig = {
      server: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      options: {
        encrypt: config.sslEnabled || false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 15000,
      requestTimeout: 15000,
    };

    const pool = await sql.connect(poolConfig);

    // Get database size in bytes
    const sizeQuery = `
      SELECT
        SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS bigint) * 8192) as size
      FROM sys.database_files
      WHERE type_desc = 'ROWS'
    `;

    const result = await pool.request().query(sizeQuery);
    await pool.close();

    return {
      success: true,
      size: parseInt(result.recordset[0].size || 0, 10),
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
