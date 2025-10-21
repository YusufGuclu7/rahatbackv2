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

  // MSSQL requires a path that SQL Server service can write to
  // Use C:\Temp which is more accessible than user's temp folder
  const tempBackupDir = 'C:\\Temp\\rahat-backup-mssql';

  // Ensure temp directory exists
  if (!fsSync.existsSync(tempBackupDir)) {
    await fs.mkdir(tempBackupDir, { recursive: true });
  }

  const tempFilePath = path.join(tempBackupDir, fileName);
  const finalFilePath = path.join(outputPath, fileName);

  // Ensure output directory exists
  if (!fsSync.existsSync(outputPath)) {
    await fs.mkdir(outputPath, { recursive: true });
  }

  // Use T-SQL BACKUP DATABASE command to temp location
  // Note: COMPRESSION is not supported in Express Edition, so we don't use it
  const backupQuery = `BACKUP DATABASE [${safeDatabase}] TO DISK = N'${tempFilePath.replace(/'/g, "''")}' WITH FORMAT, INIT, STATS = 10`;

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

    // Move backup file from temp to final destination
    await fs.copyFile(tempFilePath, finalFilePath);

    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Get file size from final location
    const stats = await fs.stat(finalFilePath);
    const fileSize = stats.size;

    return {
      success: true,
      fileName,
      filePath: finalFilePath,
      fileSize,
      duration,
    };
  } catch (error) {
    // Clean up temp file on error
    try {
      if (fsSync.existsSync(tempFilePath)) {
        await fs.unlink(tempFilePath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    // MSSQL returns multiple errors - get the root cause
    let detailedError = error.message;

    // Check for preceding errors (these usually contain the real cause)
    if (error.precedingErrors && error.precedingErrors.length > 0) {
      // Use the first preceding error as the main error (it's usually the root cause)
      const firstError = error.precedingErrors[0];
      detailedError = `${firstError.message} (Code: ${firstError.number})`;
    }

    return {
      success: false,
      error: detailedError,
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

  // If backup is compressed (.gz), decompress it first
  let actualBackupPath = backupFilePath;
  let tempUncompressedPath = null;
  let tempRestorePath = null;

  if (backupFilePath.endsWith('.gz')) {
    const zlib = require('zlib');
    tempUncompressedPath = backupFilePath.replace(/\.gz$/, '');

    // Decompress the file
    const compressed = fsSync.createReadStream(backupFilePath);
    const decompressed = fsSync.createWriteStream(tempUncompressedPath);
    const gunzip = zlib.createGunzip();

    await new Promise((resolve, reject) => {
      compressed.pipe(gunzip).pipe(decompressed);
      decompressed.on('finish', resolve);
      decompressed.on('error', reject);
      compressed.on('error', reject);
      gunzip.on('error', reject);
    });

    actualBackupPath = tempUncompressedPath;
  }

  // Copy backup file to SQL Server accessible location
  // SQL Server service might not have access to user folders
  const tempBackupDir = 'C:\\Temp\\rahat-backup-mssql';
  if (!fsSync.existsSync(tempBackupDir)) {
    await fs.mkdir(tempBackupDir, { recursive: true });
  }

  tempRestorePath = path.join(tempBackupDir, `restore_${Date.now()}_${path.basename(actualBackupPath)}`);
  await fs.copyFile(actualBackupPath, tempRestorePath);
  actualBackupPath = tempRestorePath;

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
    const fileListQuery = `RESTORE FILELISTONLY FROM DISK = N'${actualBackupPath.replace(/'/g, "''")}'`;
    const fileListResult = await pool.request().query(fileListQuery);

    const dataFile = fileListResult.recordset.find((f) => f.Type === 'D');
    const logFile = fileListResult.recordset.find((f) => f.Type === 'L');

    if (!dataFile || !logFile) {
      throw new Error('Invalid backup file: Could not find data or log files');
    }

    // 3. Restore database with REPLACE option
    const restoreQuery = `
      RESTORE DATABASE [${safeDatabase}]
      FROM DISK = N'${actualBackupPath.replace(/'/g, "''")}'
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

    // Clean up temp restore file
    try {
      await fs.unlink(tempRestorePath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

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

    // Clean up temp restore file
    try {
      if (tempRestorePath && fsSync.existsSync(tempRestorePath)) {
        await fs.unlink(tempRestorePath);
      }
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
