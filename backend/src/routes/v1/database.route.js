const express = require('express');
const auth = require('../../middlewares/auth');
const databaseController = require('../../controllers/database.controller');

const router = express.Router();

router
  .route('/')
  .post(auth(), databaseController.createDatabase)
  .get(auth(), databaseController.getDatabases);

router.post('/test-connection', auth(), databaseController.testConnectionWithCredentials);

router
  .route('/:databaseId')
  .get(auth(), databaseController.getDatabase)
  .patch(auth(), databaseController.updateDatabase)
  .delete(auth(), databaseController.deleteDatabase);

router.post('/:databaseId/test', auth(), databaseController.testConnection);
router.get('/:databaseId/size', auth(), databaseController.getDatabaseSize);

module.exports = router;
