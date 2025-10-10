const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { backupService, scheduleService } = require('../services');

// Backup Jobs
const createBackupJob = catchAsync(async (req, res) => {
  const backupJob = await backupService.createBackupJob(req.user.id, req.body);

  // Start scheduled job if not manual
  if (backupJob.isActive && backupJob.scheduleType !== 'manual') {
    await scheduleService.startScheduledJob(backupJob);
  }

  res.status(httpStatus.CREATED).send(backupJob);
});

const getBackupJobs = catchAsync(async (req, res) => {
  const filters = {
    isActive: req.query.isActive,
    scheduleType: req.query.scheduleType,
  };
  const backupJobs = await backupService.getUserBackupJobs(req.user.id, filters);
  res.send(backupJobs);
});

const getBackupJob = catchAsync(async (req, res) => {
  const backupJob = await backupService.getBackupJobById(req.params.jobId, req.user.id);
  res.send(backupJob);
});

const updateBackupJob = catchAsync(async (req, res) => {
  const backupJob = await backupService.updateBackupJob(req.params.jobId, req.user.id, req.body);

  // Restart scheduled job with new settings
  await scheduleService.restartScheduledJob(backupJob.id);

  res.send(backupJob);
});

const deleteBackupJob = catchAsync(async (req, res) => {
  await backupService.deleteBackupJob(req.params.jobId, req.user.id);

  // Stop scheduled job
  scheduleService.stopScheduledJob(parseInt(req.params.jobId));

  res.status(httpStatus.NO_CONTENT).send();
});

const runBackupJob = catchAsync(async (req, res) => {
  const result = await backupService.executeBackup(parseInt(req.params.jobId));
  res.send(result);
});

// Backup History
const getBackupHistory = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    databaseId: req.query.databaseId,
    backupJobId: req.query.backupJobId,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
  };
  const history = await backupService.getBackupHistory(req.user.id, filters);
  res.send(history);
});

const getBackupHistoryById = catchAsync(async (req, res) => {
  const backup = await backupService.getBackupHistoryById(parseInt(req.params.historyId), req.user.id);
  res.send(backup);
});

const downloadBackup = catchAsync(async (req, res) => {
  const { filePath, fileName } = await backupService.getBackupFilePath(parseInt(req.params.historyId), req.user.id);
  res.download(filePath, fileName);
});

const deleteBackup = catchAsync(async (req, res) => {
  await backupService.deleteBackup(parseInt(req.params.historyId), req.user.id);
  res.status(httpStatus.NO_CONTENT).send();
});

const getBackupStats = catchAsync(async (req, res) => {
  const stats = await backupService.getBackupStats(req.user.id);
  res.send(stats);
});

const restoreBackup = catchAsync(async (req, res) => {
  const result = await backupService.restoreBackup(parseInt(req.params.historyId), req.user.id);
  res.send(result);
});

const getScheduledJobsStatus = catchAsync(async (req, res) => {
  const status = scheduleService.getScheduledJobsStatus();
  res.send(status);
});

module.exports = {
  createBackupJob,
  getBackupJobs,
  getBackupJob,
  updateBackupJob,
  deleteBackupJob,
  runBackupJob,
  getBackupHistory,
  getBackupHistoryById,
  downloadBackup,
  deleteBackup,
  getBackupStats,
  restoreBackup,
  getScheduledJobsStatus,
};
