const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { scheduleService, websocketService } = require('./services');

const server = app.listen(config.port, () => {
  logger.info(`Listening to port ${config.port}`);

  // Initialize scheduled backup jobs
  scheduleService.initializeScheduledJobs();

  // Initialize WebSocket server for agent communication
  websocketService.initializeWebSocketServer(server);
  logger.info('WebSocket server initialized for desktop agents');
});
const exitHandler = () => {
  if (server) {
    // Stop all scheduled jobs before closing
    scheduleService.stopAllScheduledJobs();

    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});

