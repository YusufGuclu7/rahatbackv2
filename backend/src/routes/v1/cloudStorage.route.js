const express = require('express');
const auth = require('../../middlewares/auth');
const cloudStorageController = require('../../controllers/cloudStorage.controller');

const router = express.Router();

// Google Drive OAuth routes (no auth required for OAuth flow)
router.get('/google-drive/auth-url', cloudStorageController.getGoogleDriveAuthUrl);
router.get('/google-drive/callback', cloudStorageController.googleDriveCallback);

// Cloud storage CRUD routes
router
  .route('/')
  .post(auth(), cloudStorageController.createCloudStorage)
  .get(auth(), cloudStorageController.getCloudStorages);

router
  .route('/:id')
  .get(auth(), cloudStorageController.getCloudStorage)
  .patch(auth(), cloudStorageController.updateCloudStorage)
  .delete(auth(), cloudStorageController.deleteCloudStorage);

// Cloud storage operations
router.post('/:id/test', auth(), cloudStorageController.testConnection);
router.post('/:id/set-default', auth(), cloudStorageController.setAsDefault);
router.get('/:id/files', auth(), cloudStorageController.listFiles);

module.exports = router;
