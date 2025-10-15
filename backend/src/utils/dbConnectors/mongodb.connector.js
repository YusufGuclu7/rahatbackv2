const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execPromise = promisify(exec);

/**
 * Test MongoDB database connection
 */
const testConnection = async (config) => {
  let client;
  try {
    // Use connectionString if provided, otherwise build from components
    const uri =
      config.connectionString ||
      `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

    client = new MongoClient(uri, {
      ssl: config.sslEnabled,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    const adminDb = client.db().admin();
    const serverInfo = await adminDb.serverInfo();

    return {
      success: true,
      message: 'Connection successful',
      version: serverInfo.version,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};

/**
 * Create MongoDB backup using mongodump
 */
const createBackup = async (config, outputPath) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderName = `${config.database}_${timestamp}`;
  const outputDir = path.join(outputPath, folderName);

  // Build mongodump command
  let command;
  if (config.connectionString) {
    command = `mongodump --uri="${config.connectionString}" --out="${outputDir}"`;
  } else {
    command = `mongodump --host ${config.host} --port ${config.port} --username ${config.username} --password ${config.password} --db ${config.database} --out="${outputDir}"`;
  }

  try {
    const startTime = Date.now();
    await execPromise(command, {
      maxBuffer: 1024 * 1024 * 500, // 500MB buffer for large databases
      timeout: 30 * 60 * 1000 // 30 minutes timeout for very large backups
    });
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Calculate folder size
    const size = await getFolderSize(outputDir);

    return {
      success: true,
      fileName: folderName,
      filePath: outputDir,
      fileSize: size,
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
 * Restore MongoDB database from backup
 */
const restoreBackup = async (config, backupFolderPath) => {
  let command;
  if (config.connectionString) {
    command = `mongorestore --uri="${config.connectionString}" --drop "${backupFolderPath}"`;
  } else {
    command = `mongorestore --host ${config.host} --port ${config.port} --username ${config.username} --password ${config.password} --db ${config.database} --drop "${backupFolderPath}"`;
  }

  try {
    const startTime = Date.now();
    await execPromise(command, {
      maxBuffer: 1024 * 1024 * 500, // 500MB buffer for large databases
      timeout: 30 * 60 * 1000 // 30 minutes timeout for very large restores
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
  let client;
  try {
    const uri =
      config.connectionString ||
      `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

    client = new MongoClient(uri, {
      ssl: config.sslEnabled,
    });

    await client.connect();
    const db = client.db(config.database);
    const stats = await db.stats();

    return {
      success: true,
      size: stats.dataSize + stats.indexSize,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};

/**
 * Helper function to calculate folder size
 */
const getFolderSize = async (folderPath) => {
  let totalSize = 0;
  const files = await fs.readdir(folderPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(folderPath, file.name);
    if (file.isDirectory()) {
      totalSize += await getFolderSize(filePath);
    } else {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }
  }

  return totalSize;
};

module.exports = {
  testConnection,
  createBackup,
  restoreBackup,
  getDatabaseSize,
};
