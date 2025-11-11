const Joi = require('joi');

const createBackupJob = {
  body: Joi.object().keys({
    databaseId: Joi.number().integer().required(),
    name: Joi.string()
      .required()
      .min(3)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_]+$/)
      .messages({
        'string.pattern.base': 'Backup job name can only contain letters, numbers, spaces, hyphens and underscores',
      }),
    scheduleType: Joi.string()
      .required()
      .valid('manual', 'hourly', 'daily', 'weekly', 'monthly', 'custom')
      .messages({
        'any.only': 'Schedule type must be one of: manual, hourly, daily, weekly, monthly, custom',
      }),
    cronExpression: Joi.string()
      .allow('', null)
      .when('scheduleType', {
        is: 'custom',
        then: Joi.string()
          .required()
          .pattern(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/)
          .messages({
            'string.pattern.base': 'Invalid cron expression format',
          }),
        otherwise: Joi.optional().allow('', null),
      }),
    storageType: Joi.string()
      .required()
      .valid('local', 's3', 'google_drive')
      .messages({
        'any.only': 'Storage type must be one of: local, s3, google_drive',
      }),
    storagePath: Joi.string()
      .required()
      .min(1)
      .max(500)
      .pattern(/^[a-zA-Z0-9\s\-_\/\\:\.]+$/)
      .messages({
        'string.pattern.base': 'Storage path contains invalid characters',
      }),
    cloudStorageId: Joi.number()
      .integer()
      .optional()
      .allow(null)
      .when('storageType', {
        is: Joi.string().valid('s3', 'google_drive'),
        then: Joi.number().integer().required(),
        otherwise: Joi.optional().allow(null),
      }),
    retentionDays: Joi.number().integer().min(1).max(3650).default(30).messages({
      'number.min': 'Retention days must be at least 1',
      'number.max': 'Retention days cannot exceed 3650 (10 years)',
    }),
    compression: Joi.boolean().default(true),
    isEncrypted: Joi.boolean().default(false),
    encryptionPassword: Joi.string()
      .min(8)
      .max(128)
      .when('isEncrypted', {
        is: true,
        then: Joi.required().messages({
          'any.required': 'Encryption password is required when encryption is enabled',
          'string.min': 'Encryption password must be at least 8 characters long',
          'string.max': 'Encryption password cannot exceed 128 characters',
        }),
        otherwise: Joi.optional().allow('', null),
      }),
    backupType: Joi.string()
      .optional()
      .valid('full', 'incremental', 'differential')
      .default('full')
      .messages({
        'any.only': 'Backup type must be one of: full, incremental, differential',
      }),
    isActive: Joi.boolean().default(true),
  }),
};

const updateBackupJob = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string()
        .min(3)
        .max(100)
        .pattern(/^[a-zA-Z0-9\s\-_]+$/),
      scheduleType: Joi.string().valid('manual', 'hourly', 'daily', 'weekly', 'monthly', 'custom'),
      cronExpression: Joi.string()
        .when('scheduleType', {
          is: 'custom',
          then: Joi.string()
            .required()
            .pattern(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/),
          otherwise: Joi.forbidden(),
        })
        .allow(null),
      storageType: Joi.string().valid('local', 's3', 'google_drive'),
      storagePath: Joi.string()
        .min(1)
        .max(500)
        .pattern(/^[a-zA-Z0-9\s\-_\/\\:\.]+$/),
      cloudStorageId: Joi.number().integer().allow(null),
      retentionDays: Joi.number().integer().min(1).max(3650),
      compression: Joi.boolean(),
      isEncrypted: Joi.boolean(),
      encryptionPassword: Joi.string()
        .min(8)
        .max(128)
        .when('isEncrypted', {
          is: true,
          then: Joi.required().messages({
            'any.required': 'Encryption password is required when encryption is enabled',
            'string.min': 'Encryption password must be at least 8 characters long',
            'string.max': 'Encryption password cannot exceed 128 characters',
          }),
          otherwise: Joi.optional().allow('', null),
        }),
      backupType: Joi.string().valid('full', 'incremental', 'differential'),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const getBackupJob = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().required(),
  }),
};

const deleteBackupJob = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().required(),
  }),
};

const runBackupJob = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().required(),
  }),
};

const getBackupJobs = {
  query: Joi.object().keys({
    isActive: Joi.boolean(),
    scheduleType: Joi.string().valid('manual', 'hourly', 'daily', 'weekly', 'monthly', 'custom'),
  }),
};

const getBackupHistory = {
  query: Joi.object().keys({
    status: Joi.string().valid('running', 'success', 'failed', 'cancelled').allow('').optional(),
    databaseId: Joi.number().integer().allow('').optional(),
    backupJobId: Joi.number().integer().allow('').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const getBackupHistoryById = {
  params: Joi.object().keys({
    historyId: Joi.number().integer().required(),
  }),
};

const downloadBackup = {
  params: Joi.object().keys({
    historyId: Joi.number().integer().required(),
  }),
};

const deleteBackup = {
  params: Joi.object().keys({
    historyId: Joi.number().integer().required(),
  }),
};

const restoreBackup = {
  params: Joi.object().keys({
    historyId: Joi.number().integer().required(),
  }),
};

module.exports = {
  createBackupJob,
  updateBackupJob,
  getBackupJob,
  deleteBackupJob,
  runBackupJob,
  getBackupJobs,
  getBackupHistory,
  getBackupHistoryById,
  downloadBackup,
  deleteBackup,
  restoreBackup,
};
