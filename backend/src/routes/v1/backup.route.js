const express = require('express');
const auth = require('../../middlewares/auth');
const backupController = require('../../controllers/backup.controller');

const router = express.Router();

// Backup Jobs
router
  .route('/jobs')
  .post(auth(), backupController.createBackupJob)
  .get(auth(), backupController.getBackupJobs);

router
  .route('/jobs/:jobId')
  .get(auth(), backupController.getBackupJob)
  .patch(auth(), backupController.updateBackupJob)
  .delete(auth(), backupController.deleteBackupJob);

router.post('/jobs/:jobId/run', auth(), backupController.runBackupJob);

// Backup History
router.route('/history').get(auth(), backupController.getBackupHistory);

router
  .route('/history/:historyId')
  .get(auth(), backupController.getBackupHistoryById)
  .delete(auth(), backupController.deleteBackup);

router.get('/history/:historyId/download', auth(), backupController.downloadBackup);

// Stats
router.get('/stats', auth(), backupController.getBackupStats);

module.exports = router;
