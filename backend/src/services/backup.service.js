const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const zlib = require('zlib');
const { backupJobModel, backupHistoryModel, databaseModel } = require('../models');
const { getConnector } = require('../utils/dbConnectors');
const databaseService = require('./database.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

// Backup storage directory
const BACKUP_STORAGE_PATH = process.env.BACKUP_STORAGE_PATH || path.join(__dirname, '../../backups');

/**
 * Ensure backup storage directory exists
 */
const ensureBackupDirectory = async () => {
  try {
    await fs.access(BACKUP_STORAGE_PATH);
  } catch {
    await fs.mkdir(BACKUP_STORAGE_PATH, { recursive: true });
  }
};

/**
 * Create a new backup job
 */
const createBackupJob = async (userId, jobData) => {
  // Verify database belongs to user
  const database = await databaseModel.findById(jobData.databaseId);
  if (!database) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Database not found');
  }
  if (database.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }

  const backupJob = await backupJobModel.create(jobData);
  return backupJob;
};

/**
 * Get backup job by ID
 */
const getBackupJobById = async (id, userId) => {
  const backupJob = await backupJobModel.findById(id);
  if (!backupJob) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup job not found');
  }
  if (backupJob.database.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }
  return backupJob;
};

/**
 * Get all backup jobs for a user
 */
const getUserBackupJobs = async (userId, filters = {}) => {
  return await backupJobModel.findByUserId(userId, filters);
};

/**
 * Update backup job
 */
const updateBackupJob = async (id, userId, updateData) => {
  await getBackupJobById(id, userId); // Verify ownership
  return await backupJobModel.update(id, updateData);
};

/**
 * Delete backup job
 */
const deleteBackupJob = async (id, userId) => {
  const backupJob = await getBackupJobById(id, userId);
  await backupJobModel.delete(id);
  return backupJob;
};

/**
 * Execute a backup
 */
const executeBackup = async (backupJobId) => {
  const backupJob = await backupJobModel.findById(backupJobId);
  if (!backupJob) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup job not found');
  }

  // Get database config with decrypted password
  const dbConfig = await databaseService.getDatabaseConfig(backupJob.databaseId);

  // Create backup history entry
  const backupHistory = await backupHistoryModel.create({
    backupJobId,
    databaseId: backupJob.databaseId,
    status: 'running',
    fileName: '',
    filePath: '',
  });

  try {
    // Ensure backup directory exists
    await ensureBackupDirectory();

    // Create job-specific directory
    const jobBackupPath = path.join(BACKUP_STORAGE_PATH, `job_${backupJobId}`);
    await fs.mkdir(jobBackupPath, { recursive: true });

    // Get appropriate connector
    const connector = getConnector(dbConfig.type);

    // Execute backup
    logger.info(`Starting backup for job ${backupJobId}, database ${dbConfig.name}`);
    const result = await connector.createBackup(dbConfig, jobBackupPath);

    if (!result.success) {
      throw new Error(result.error);
    }

    let finalFilePath = result.filePath;
    let finalFileName = result.fileName;
    let fileSize = result.fileSize;

    // Compress if enabled
    if (backupJob.compression && dbConfig.type !== 'mongodb') {
      logger.info(`Compressing backup for job ${backupJobId}`);
      const compressedPath = await compressBackup(result.filePath);
      // Delete original uncompressed file
      await fs.unlink(result.filePath);
      finalFilePath = compressedPath;
      finalFileName = path.basename(compressedPath);
      const stats = await fs.stat(compressedPath);
      fileSize = stats.size;
    }

    // Update backup history with success
    await backupHistoryModel.update(backupHistory.id, {
      status: 'success',
      fileName: finalFileName,
      filePath: finalFilePath,
      fileSize: fileSize, // Keep as number, no BigInt conversion
      duration: result.duration,
      completedAt: new Date(),
    });

    // Update backup job last run time
    await backupJobModel.updateLastRun(backupJobId);

    // Clean up old backups based on retention policy
    await cleanupOldBackups(backupJobId, backupJob.retentionDays);

    logger.info(`Backup completed successfully for job ${backupJobId}`);

    return {
      success: true,
      backupHistoryId: backupHistory.id,
      fileName: finalFileName,
      fileSize,
    };
  } catch (error) {
    logger.error(`Backup failed for job ${backupJobId}: ${error.message}`);

    // Update backup history with failure
    await backupHistoryModel.updateStatus(backupHistory.id, 'failed', error.message);

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Backup failed: ${error.message}`);
  }
};

/**
 * Compress backup file using gzip
 */
const compressBackup = async (filePath) => {
  const output = `${filePath}.gz`;
  const inputStream = fsSync.createReadStream(filePath);
  const outputStream = fsSync.createWriteStream(output);
  const gzip = zlib.createGzip({ level: 9 });

  return new Promise((resolve, reject) => {
    outputStream.on('finish', () => resolve(output));
    outputStream.on('error', reject);
    inputStream.on('error', reject);
    gzip.on('error', reject);

    inputStream.pipe(gzip).pipe(outputStream);
  });
};

/**
 * Clean up old backups based on retention policy
 */
const cleanupOldBackups = async (backupJobId, retentionDays) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const oldBackups = await backupHistoryModel.findByJobId(backupJobId, 1000);

  for (const backup of oldBackups) {
    if (new Date(backup.startedAt) < cutoffDate && backup.status === 'success') {
      try {
        // Delete file
        await fs.unlink(backup.filePath);
        // Delete history record
        await backupHistoryModel.delete(backup.id);
        logger.info(`Cleaned up old backup: ${backup.fileName}`);
      } catch (error) {
        logger.error(`Failed to cleanup backup ${backup.id}: ${error.message}`);
      }
    }
  }
};

/**
 * Get backup history
 */
const getBackupHistory = async (userId, filters = {}) => {
  return await backupHistoryModel.findByUserId(userId, filters);
};

/**
 * Get backup history by ID
 */
const getBackupHistoryById = async (id, userId) => {
  const backup = await backupHistoryModel.findById(id);
  if (!backup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup not found');
  }
  if (backup.database.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }
  return backup;
};

/**
 * Download backup file
 */
const getBackupFilePath = async (id, userId) => {
  const backup = await getBackupHistoryById(id, userId);
  if (backup.status !== 'success') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Backup is not available for download');
  }

  try {
    await fs.access(backup.filePath);
    return {
      filePath: backup.filePath,
      fileName: backup.fileName,
    };
  } catch {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup file not found');
  }
};

/**
 * Delete backup
 */
const deleteBackup = async (id, userId) => {
  const backup = await getBackupHistoryById(id, userId);

  try {
    // Delete file
    await fs.unlink(backup.filePath);
  } catch (error) {
    logger.error(`Failed to delete backup file: ${error.message}`);
  }

  // Delete history record
  await backupHistoryModel.delete(id);
  return backup;
};

/**
 * Get backup statistics for user
 */
const getBackupStats = async (userId) => {
  return await backupHistoryModel.getStats(userId);
};

/**
 * Restore a backup
 */
const restoreBackup = async (historyId, userId) => {
  // Get backup history with ownership verification
  const backup = await getBackupHistoryById(historyId, userId);

  if (backup.status !== 'success') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only successful backups can be restored');
  }

  // Check if file exists
  try {
    await fs.access(backup.filePath);
  } catch {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup file not found');
  }

  // Get database config with decrypted password
  const dbConfig = await databaseService.getDatabaseConfig(backup.databaseId);

  // Handle compressed files
  let filePathToRestore = backup.filePath;
  let needsCleanup = false;

  if (backup.fileName.endsWith('.gz')) {
    // Decompress the file
    const decompressedPath = backup.filePath.replace('.gz', '');
    const inputStream = fsSync.createReadStream(backup.filePath);
    const outputStream = fsSync.createWriteStream(decompressedPath);
    const gunzip = zlib.createGunzip();

    await new Promise((resolve, reject) => {
      outputStream.on('finish', () => resolve());
      outputStream.on('error', reject);
      inputStream.on('error', reject);
      gunzip.on('error', reject);
      inputStream.pipe(gunzip).pipe(outputStream);
    });

    filePathToRestore = decompressedPath;
    needsCleanup = true;
  }

  try {
    // Get appropriate connector
    const connector = getConnector(dbConfig.type);

    // Check if connector supports restore
    if (!connector.restoreBackup) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Restore not supported for ${dbConfig.type}`);
    }

    // Execute restore
    logger.info(`Starting restore for backup ${historyId} to database ${dbConfig.name}`);
    const result = await connector.restoreBackup(dbConfig, filePathToRestore);

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info(`Restore completed successfully for backup ${historyId}`);

    return {
      success: true,
      message: result.message,
      duration: result.duration,
      databaseName: dbConfig.name,
    };
  } catch (error) {
    logger.error(`Restore failed for backup ${historyId}: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Restore failed: ${error.message}`);
  } finally {
    // Clean up decompressed file if created
    if (needsCleanup) {
      try {
        await fs.unlink(filePathToRestore);
      } catch (error) {
        logger.error(`Failed to cleanup decompressed file: ${error.message}`);
      }
    }
  }
};

module.exports = {
  createBackupJob,
  getBackupJobById,
  getUserBackupJobs,
  updateBackupJob,
  deleteBackupJob,
  executeBackup,
  getBackupHistory,
  getBackupHistoryById,
  getBackupFilePath,
  deleteBackup,
  getBackupStats,
  restoreBackup,
};
