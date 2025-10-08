const cron = require('node-cron');
const cronParser = require('cron-parser');
const { backupJobModel } = require('../models');
const backupService = require('./backup.service');
const logger = require('../config/logger');

// Store active cron jobs
const activeCronJobs = new Map();

/**
 * Get cron expression from schedule type
 */
const getCronExpression = (scheduleType, customCron = null) => {
  const cronExpressions = {
    hourly: '0 * * * *', // Every hour at minute 0
    daily: '0 2 * * *', // Every day at 2:00 AM
    weekly: '0 2 * * 0', // Every Sunday at 2:00 AM
    monthly: '0 2 1 * *', // First day of month at 2:00 AM
    custom: customCron,
  };

  return cronExpressions[scheduleType] || cronExpressions.daily;
};

/**
 * Calculate next run time based on cron expression
 */
const getNextRunTime = (cronExpression) => {
  try {
    const interval = cronParser.parseExpression(cronExpression);
    const nextDate = interval.next().toDate();
    return nextDate;
  } catch (error) {
    logger.error(`Failed to calculate next run time: ${error.message}`);
    return null;
  }
};

/**
 * Start a scheduled backup job
 */
const startScheduledJob = async (backupJob) => {
  if (backupJob.scheduleType === 'manual') {
    return; // Manual jobs don't need scheduling
  }

  // Stop existing job if any
  stopScheduledJob(backupJob.id);

  const cronExpression = getCronExpression(backupJob.scheduleType, backupJob.cronExpression);

  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression for job ${backupJob.id}: ${cronExpression}`);
    return;
  }

  logger.info(`Scheduling backup job ${backupJob.id} with cron: ${cronExpression}`);

  const task = cron.schedule(cronExpression, async () => {
    logger.info(`Executing scheduled backup for job ${backupJob.id}`);
    try {
      await backupService.executeBackup(backupJob.id);
      logger.info(`Scheduled backup completed for job ${backupJob.id}`);
    } catch (error) {
      logger.error(`Scheduled backup failed for job ${backupJob.id}: ${error.message}`);
    }
  });

  activeCronJobs.set(backupJob.id, task);

  // Update next run time in database
  const nextRunAt = getNextRunTime(cronExpression);
  if (nextRunAt) {
    await backupJobModel.update(backupJob.id, { nextRunAt });
  }
};

/**
 * Stop a scheduled job
 */
const stopScheduledJob = (backupJobId) => {
  const task = activeCronJobs.get(backupJobId);
  if (task) {
    task.stop();
    activeCronJobs.delete(backupJobId);
    logger.info(`Stopped scheduled job ${backupJobId}`);
  }
};

/**
 * Restart a scheduled job
 */
const restartScheduledJob = async (backupJobId) => {
  const backupJob = await backupJobModel.findById(backupJobId);
  if (!backupJob) {
    logger.error(`Backup job ${backupJobId} not found`);
    return;
  }

  if (backupJob.isActive) {
    await startScheduledJob(backupJob);
  } else {
    stopScheduledJob(backupJobId);
  }
};

/**
 * Initialize all active scheduled jobs
 */
const initializeScheduledJobs = async () => {
  logger.info('Initializing scheduled backup jobs...');

  try {
    const activeJobs = await backupJobModel.findActiveJobs();

    for (const job of activeJobs) {
      await startScheduledJob(job);
    }

    logger.info(`Initialized ${activeJobs.length} scheduled backup jobs`);
  } catch (error) {
    logger.error(`Failed to initialize scheduled jobs: ${error.message}`);
  }
};

/**
 * Stop all scheduled jobs
 */
const stopAllScheduledJobs = () => {
  logger.info('Stopping all scheduled jobs...');
  activeCronJobs.forEach((task, jobId) => {
    task.stop();
    logger.info(`Stopped job ${jobId}`);
  });
  activeCronJobs.clear();
};

/**
 * Get status of all scheduled jobs
 */
const getScheduledJobsStatus = () => {
  const status = [];
  activeCronJobs.forEach((task, jobId) => {
    status.push({
      jobId,
      isRunning: true,
    });
  });
  return status;
};

/**
 * Validate cron expression
 */
const validateCronExpression = (expression) => {
  return cron.validate(expression);
};

module.exports = {
  getCronExpression,
  getNextRunTime,
  startScheduledJob,
  stopScheduledJob,
  restartScheduledJob,
  initializeScheduledJobs,
  stopAllScheduledJobs,
  getScheduledJobsStatus,
  validateCronExpression,
};
