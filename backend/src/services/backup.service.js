const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const zlib = require('zlib');
const { backupJobModel, backupHistoryModel, databaseModel, cloudStorageModel } = require('../models');
const { getConnector } = require('../utils/dbConnectors');
const { getCloudStorageConnector } = require('../utils/cloudStorage');
const databaseService = require('./database.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { sendBackupNotification } = require('./email.service');
const prisma = require('../utils/database');
const { encryptFile, decryptFile, hashPassword } = require('../utils/encryption');

// Backup storage directory
const BACKUP_STORAGE_PATH = process.env.BACKUP_STORAGE_PATH || path.join(__dirname, '../../backups');

// Track running backups to prevent concurrent execution
const runningBackups = new Set();

/**
 * Send email notification for backup status
 */
const sendBackupEmailNotification = async (userId, backupJob, dbConfig, status, details = {}) => {
  try {
    const notificationSettings = await prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!notificationSettings || !notificationSettings.isActive || !notificationSettings.emailEnabled) {
      return;
    }

    // Check if user wants this type of notification
    if (status === 'success' && !notificationSettings.notifyOnSuccess) {
      return;
    }
    if (status === 'failed' && !notificationSettings.notifyOnFailure) {
      return;
    }

    const isSuccess = status === 'success';
    const subject = isSuccess
      ? `✅ Backup Başarılı - ${dbConfig.name}`
      : `❌ Backup Hatalı - ${dbConfig.name}`;

    const formatBytes = (bytes) => {
      if (!bytes) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatDuration = (ms) => {
      if (!ms) return '0s';
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      }
      return `${seconds}s`;
    };

    const text = isSuccess
      ? `Veritabanı: ${dbConfig.name}\nJob: ${backupJob.name}\nDurum: Başarılı\nDosya: ${details.fileName}\nBoyut: ${formatBytes(details.fileSize)}\nSüre: ${formatDuration(details.duration)}`
      : `Veritabanı: ${dbConfig.name}\nJob: ${backupJob.name}\nDurum: Hatalı\nHata: ${details.error}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${isSuccess ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">${isSuccess ? '✅ Backup Başarılı' : '❌ Backup Hatalı'}</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #ddd;">
        <h2 style="color: #333;">Backup Detayları</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Veritabanı:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${dbConfig.name} (${dbConfig.type})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Job Adı:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${backupJob.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Durum:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${isSuccess ? '#4CAF50' : '#f44336'}; font-weight: bold;">${isSuccess ? 'Başarılı' : 'Hatalı'}</td>
          </tr>
          ${
            isSuccess
              ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Dosya Adı:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${details.fileName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Dosya Boyutu:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatBytes(details.fileSize)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Süre:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatDuration(details.duration)}</td>
          </tr>
          `
              : `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Hata Mesajı:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #f44336;">${details.error}</td>
          </tr>
          `
          }
          <tr>
            <td style="padding: 8px;"><strong>Tarih:</strong></td>
            <td style="padding: 8px;">${new Date().toLocaleString('tr-TR')}</td>
          </tr>
        </table>
      </div>
      <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>Bu email otomatik olarak Backup System tarafından gönderilmiştir.</p>
      </div>
    </div>
    `;

    await sendBackupNotification(userId, subject, text, html);
    logger.info(`Email notification sent to user ${userId} for backup job ${backupJob.id}`);
  } catch (error) {
    logger.error(`Failed to send email notification: ${error.message}`);
    // Don't throw error, just log it - email failure shouldn't stop backup process
  }
};

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
  // Prevent concurrent execution of the same backup job
  if (runningBackups.has(backupJobId)) {
    logger.warn(`Backup job ${backupJobId} is already running, skipping...`);
    throw new ApiError(httpStatus.CONFLICT, 'Backup is already running for this job');
  }

  const backupJob = await backupJobModel.findById(backupJobId);
  if (!backupJob) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Backup job not found');
  }

  // Mark as running
  runningBackups.add(backupJobId);

  // Get database config with decrypted password
  const dbConfig = await databaseService.getDatabaseConfig(backupJob.databaseId);

  // Create backup history entry
  const historyData = {
    backupJobId: parseInt(backupJobId),
    databaseId: parseInt(backupJob.databaseId),
    status: 'running',
    fileName: '',
    filePath: '',
  };
  logger.info(`Creating backup history for job ${backupJobId}`, historyData);
  const backupHistory = await backupHistoryModel.create(historyData);

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

    // Encrypt if enabled
    if (backupJob.isEncrypted && backupJob.encryptionPasswordHash) {
      logger.info(`Encrypting backup for job ${backupJobId}`);

      // Use the hash as the encryption password (in production, user should provide password)
      // For now, we'll use a fixed password derived from the hash
      const encryptionPassword = backupJob.encryptionPasswordHash;

      const encryptedPath = `${finalFilePath}.enc`;
      await encryptFile(finalFilePath, encryptedPath, encryptionPassword);

      // Delete unencrypted file
      await fs.unlink(finalFilePath);
      finalFilePath = encryptedPath;
      finalFileName = path.basename(encryptedPath);
      const stats = await fs.stat(encryptedPath);
      fileSize = stats.size;

      logger.info(`Backup encrypted successfully: ${finalFileName}`);
    }

    // Upload to cloud storage if configured
    let cloudUploadResult = null;
    if (backupJob.cloudStorageId && (backupJob.storageType === 's3' || backupJob.storageType === 'google_drive')) {
      logger.info(`Uploading backup to cloud storage for job ${backupJobId}`);
      const cloudStorage = await cloudStorageModel.findById(backupJob.cloudStorageId);

      if (!cloudStorage) {
        throw new Error('Cloud storage configuration not found');
      }

      if (!cloudStorage.isActive) {
        throw new Error('Cloud storage configuration is not active');
      }

      const cloudConnector = getCloudStorageConnector(cloudStorage.storageType);
      cloudUploadResult = await cloudConnector.uploadBackup(cloudStorage, finalFilePath, finalFileName);

      if (cloudUploadResult.success) {
        logger.info(`Successfully uploaded backup to ${cloudStorage.storageType}: ${cloudUploadResult.s3Key || cloudUploadResult.fileId}`);

        // Save local file path before updating to cloud location
        const localFilePath = finalFilePath;

        // Update file path to cloud location
        if (cloudStorage.storageType === 's3') {
          finalFilePath = cloudUploadResult.url || cloudUploadResult.s3Key;
        } else if (cloudStorage.storageType === 'google_drive') {
          finalFilePath = cloudUploadResult.fileId;
        }

        // Delete local file after successful cloud upload to save disk space
        try {
          await fs.unlink(localFilePath);
          logger.info(`Deleted local backup file after cloud upload: ${localFilePath}`);
        } catch (unlinkError) {
          logger.warn(`Failed to delete local file after cloud upload: ${unlinkError.message}`);
          // Don't fail the backup if local file deletion fails
        }
      } else {
        // Upload failed - throw error to mark backup as failed
        throw new Error(`Cloud upload failed: ${cloudUploadResult.error}`);
      }
    }

    // Update backup history with success
    await backupHistoryModel.update(backupHistory.id, {
      status: 'success',
      fileName: finalFileName,
      filePath: finalFilePath,
      fileSize: fileSize, // Keep as number, no BigInt conversion
      duration: result.duration,
      isEncrypted: backupJob.isEncrypted || false,
      completedAt: new Date(),
    });

    // Calculate next run time based on schedule
    let nextRunAt = null;
    if (backupJob.scheduleType !== 'manual') {
      const scheduleService = require('./schedule.service');
      const cronExpression = scheduleService.getCronExpression(backupJob.scheduleType, backupJob.cronExpression);
      nextRunAt = scheduleService.getNextRunTime(cronExpression);
    }

    // Update backup job last run time and next run time
    await backupJobModel.updateLastRun(backupJobId, nextRunAt);

    // Clean up old backups based on retention policy
    await cleanupOldBackups(backupJobId, backupJob.retentionDays);

    logger.info(`Backup completed successfully for job ${backupJobId}`);

    // Send success notification
    await sendBackupEmailNotification(dbConfig.userId, backupJob, dbConfig, 'success', {
      fileName: finalFileName,
      fileSize,
      duration: result.duration,
    });

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

    // Send failure notification
    await sendBackupEmailNotification(dbConfig.userId, backupJob, dbConfig, 'failed', {
      error: error.message,
    });

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Backup failed: ${error.message}`);
  } finally {
    // Remove from running backups
    runningBackups.delete(backupJobId);
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
  const backupJob = await backupJobModel.findById(backupJobId);

  for (const backup of oldBackups) {
    if (new Date(backup.startedAt) < cutoffDate && backup.status === 'success') {
      try {
        // Check if backup is from cloud storage
        if (backupJob && backupJob.cloudStorageId && (backupJob.storageType === 'google_drive' || backupJob.storageType === 's3')) {
          // Delete from cloud storage
          try {
            const cloudStorage = await cloudStorageModel.findById(backupJob.cloudStorageId);

            if (cloudStorage && cloudStorage.isActive) {
              const cloudConnector = getCloudStorageConnector(cloudStorage.storageType);
              const deleteResult = await cloudConnector.deleteBackup(cloudStorage, backup.filePath);

              if (deleteResult.success) {
                logger.info(`Cleaned up old backup from ${cloudStorage.storageType}: ${backup.fileName}`);
              } else {
                logger.warn(`Failed to delete old backup from cloud: ${deleteResult.error}`);
                continue; // Skip deleting history record if cloud delete failed
              }
            }
          } catch (error) {
            logger.error(`Error cleaning up backup from cloud storage: ${error.message}`);
            continue; // Skip deleting history record if cloud delete failed
          }
        } else {
          // Delete local file
          await fs.unlink(backup.filePath);
          logger.info(`Cleaned up old local backup: ${backup.fileName}`);
        }

        // Delete history record only after successful file deletion
        await backupHistoryModel.delete(backup.id);
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

  // Check if backup is from cloud storage
  // Handle old backups that might not have a backupJobId
  const backupJob = backup.backupJobId ? await backupJobModel.findById(backup.backupJobId) : null;

  // If cloud storage (Google Drive or S3), download first
  if (backupJob && backupJob.cloudStorageId && (backupJob.storageType === 'google_drive' || backupJob.storageType === 's3')) {
    const cloudStorage = await cloudStorageModel.findById(backupJob.cloudStorageId);

    if (cloudStorage && cloudStorage.isActive) {
      // Create temporary download path
      const tempDownloadPath = path.join(BACKUP_STORAGE_PATH, 'temp', backup.fileName);
      await fs.mkdir(path.dirname(tempDownloadPath), { recursive: true });

      const cloudConnector = getCloudStorageConnector(cloudStorage.storageType);

      // Download from cloud storage
      const downloadResult = await cloudConnector.downloadBackup(
        cloudStorage,
        backup.filePath, // This is the cloud fileId or S3 key
        tempDownloadPath
      );

      if (!downloadResult.success) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to download from cloud: ${downloadResult.error}`);
      }

      return {
        filePath: tempDownloadPath,
        fileName: backup.fileName,
        isTemp: true, // Flag to clean up after download
      };
    }
  }

  // Local file - check if exists
  try {
    await fs.access(backup.filePath);
    return {
      filePath: backup.filePath,
      fileName: backup.fileName,
      isTemp: false,
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

  // Check if backup is from cloud storage
  // Handle old backups that might not have a backupJobId
  const backupJob = backup.backupJobId ? await backupJobModel.findById(backup.backupJobId) : null;

  if (backupJob && backupJob.cloudStorageId && (backupJob.storageType === 'google_drive' || backupJob.storageType === 's3')) {
    // Delete from cloud storage
    try {
      const cloudStorage = await cloudStorageModel.findById(backupJob.cloudStorageId);

      if (cloudStorage && cloudStorage.isActive) {
        const cloudConnector = getCloudStorageConnector(cloudStorage.storageType);
        const deleteResult = await cloudConnector.deleteBackup(cloudStorage, backup.filePath);

        if (deleteResult.success) {
          logger.info(`Successfully deleted backup from ${cloudStorage.storageType}: ${backup.filePath}`);
        } else {
          logger.warn(`Failed to delete backup from cloud storage: ${deleteResult.error}`);
        }
      }
    } catch (error) {
      logger.error(`Error deleting backup from cloud storage: ${error.message}`);
      // Continue with deletion even if cloud delete fails
    }
  } else {
    // Delete local file
    try {
      await fs.unlink(backup.filePath);
      logger.info(`Successfully deleted local backup file: ${backup.filePath}`);
    } catch (error) {
      logger.error(`Failed to delete local backup file: ${error.message}`);
    }
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

  // Get database config with decrypted password
  const dbConfig = await databaseService.getDatabaseConfig(backup.databaseId);

  // Get backup file path (handles cloud storage downloads)
  let localFilePath = backup.filePath;
  let shouldCleanupDownloadedFile = false;

  // Check if backup is from cloud storage
  // Handle old backups that might not have a backupJobId
  const backupJob = backup.backupJobId ? await backupJobModel.findById(backup.backupJobId) : null;

  if (backupJob && backupJob.cloudStorageId && (backupJob.storageType === 'google_drive' || backupJob.storageType === 's3')) {
    const cloudStorage = await cloudStorageModel.findById(backupJob.cloudStorageId);

    if (cloudStorage && cloudStorage.isActive) {
      // Create temporary download path
      const tempDownloadPath = path.join(BACKUP_STORAGE_PATH, 'temp', backup.fileName);
      await fs.mkdir(path.dirname(tempDownloadPath), { recursive: true });

      const cloudConnector = getCloudStorageConnector(cloudStorage.storageType);

      // Download from cloud storage
      logger.info(`Downloading backup from ${cloudStorage.storageType} for restore: ${backup.filePath}`);
      const downloadResult = await cloudConnector.downloadBackup(
        cloudStorage,
        backup.filePath, // This is the cloud fileId or S3 key
        tempDownloadPath
      );

      if (!downloadResult.success) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to download from cloud: ${downloadResult.error}`);
      }

      localFilePath = tempDownloadPath;
      shouldCleanupDownloadedFile = true;
      logger.info(`Successfully downloaded backup to ${localFilePath}`);
    }
  } else {
    // Local file - check if exists
    try {
      await fs.access(localFilePath);
    } catch {
      throw new ApiError(httpStatus.NOT_FOUND, 'Backup file not found');
    }
  }

  // Handle encrypted files
  let filePathToRestore = localFilePath;
  let needsCleanup = shouldCleanupDownloadedFile;

  if (backup.isEncrypted) {
    // Get encryption password from backup job
    if (!backupJob || !backupJob.encryptionPasswordHash) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Backup is encrypted but password is not available');
    }

    logger.info(`Decrypting backup for restore: ${backup.fileName}`);
    const decryptedPath = localFilePath.replace('.enc', '');
    await decryptFile(localFilePath, decryptedPath, backupJob.encryptionPasswordHash);

    // Clean up encrypted file
    if (shouldCleanupDownloadedFile) {
      await fs.unlink(localFilePath);
    }

    filePathToRestore = decryptedPath;
    needsCleanup = true;
    logger.info(`Backup decrypted successfully: ${decryptedPath}`);
  }

  // Handle compressed files
  if (backup.fileName.replace('.enc', '').endsWith('.gz')) {
    // Decompress the file
    const decompressedPath = filePathToRestore.replace('.gz', '');
    const inputStream = fsSync.createReadStream(filePathToRestore);
    const outputStream = fsSync.createWriteStream(decompressedPath);
    const gunzip = zlib.createGunzip();

    await new Promise((resolve, reject) => {
      outputStream.on('finish', () => resolve());
      outputStream.on('error', reject);
      inputStream.on('error', reject);
      gunzip.on('error', reject);
      inputStream.pipe(gunzip).pipe(outputStream);
    });

    // Clean up previous file if needed
    if (needsCleanup) {
      await fs.unlink(filePathToRestore);
    }

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
    // Clean up temporary files
    if (needsCleanup) {
      try {
        // Clean up decompressed file if created
        if (backup.fileName.endsWith('.gz') && filePathToRestore !== localFilePath) {
          await fs.unlink(filePathToRestore);
        }
        // Clean up downloaded file from cloud storage
        if (shouldCleanupDownloadedFile) {
          await fs.unlink(localFilePath);
        }
      } catch (error) {
        logger.error(`Failed to cleanup temporary files: ${error.message}`);
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
