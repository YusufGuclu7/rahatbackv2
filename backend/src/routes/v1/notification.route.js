const express = require('express');
const auth = require('../../middlewares/auth');
const notificationController = require('../../controllers/notification.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), notificationController.getSettings)
  .patch(auth(), notificationController.updateSettings);

router.post('/test-email', auth(), notificationController.testEmail);

module.exports = router;
