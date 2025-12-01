const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');
const { agentService } = require('.');

// Store active agent connections
const agentConnections = new Map(); // agentId -> ws

/**
 * Initialize WebSocket server
 * @param {http.Server} server
 */
const initializeWebSocketServer = (server) => {
  const wss = new WebSocket.Server({
    server,
    path: '/ws/agent',
  });

  logger.info('WebSocket server initialized on /ws/agent');

  wss.on('connection', async (ws, req) => {
    logger.info('New WebSocket connection attempt');

    let agentId = null;
    let userId = null;
    let isAuthenticated = false;

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.info(`WebSocket message received: ${message.type}`);

        // Handle authentication
        if (message.type === 'auth') {
          try {
            const { token, agentId: clientAgentId } = message.data;

            // Verify JWT token
            const decoded = jwt.verify(token, config.jwt.secret);
            userId = decoded.sub;

            // Verify agent belongs to user
            const agent = await agentService.getAgentByAgentId(clientAgentId);
            if (!agent || agent.userId !== userId) {
              ws.send(
                JSON.stringify({
                  type: 'auth_error',
                  error: 'Invalid agent or unauthorized',
                })
              );
              ws.close();
              return;
            }

            agentId = clientAgentId;
            isAuthenticated = true;

            // Store connection
            agentConnections.set(agentId, ws);

            // Update agent status
            await agentService.updateAgentStatus(agentId, 'online');

            // Send authentication success
            ws.send(
              JSON.stringify({
                type: 'auth_success',
                data: {
                  agentId,
                  message: 'Agent authenticated successfully',
                },
              })
            );

            // Send initial stats
            const stats = await agentService.getAgentStats(userId);
            ws.send(
              JSON.stringify({
                type: 'stats_update',
                data: stats,
              })
            );

            logger.info(`Agent authenticated: ${agentId}`);
          } catch (error) {
            logger.error('WebSocket authentication error:', error);
            ws.send(
              JSON.stringify({
                type: 'auth_error',
                error: 'Authentication failed',
              })
            );
            ws.close();
          }
          return;
        }

        // Require authentication for all other messages
        if (!isAuthenticated) {
          ws.send(
            JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
            })
          );
          return;
        }

        // Handle heartbeat
        if (message.type === 'heartbeat') {
          await agentService.updateAgentHeartbeat(agentId);
          ws.send(
            JSON.stringify({
              type: 'heartbeat_ack',
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        // Handle backup job status updates
        if (message.type === 'job_status') {
          const { jobId, status, progress, message: jobMessage } = message.data;

          // Broadcast to other connections (e.g., web dashboard)
          broadcastToUser(userId, {
            type: 'job_status',
            data: {
              agentId,
              jobId,
              status,
              progress,
              message: jobMessage,
              timestamp: new Date().toISOString(),
            },
          });

          logger.info(`Job status update: ${jobId} - ${status} (${progress}%)`);
          return;
        }

        // Handle backup job completion
        if (message.type === 'job_complete') {
          const { jobId, success, backupHistoryId, error } = message.data;

          broadcastToUser(userId, {
            type: 'job_complete',
            data: {
              agentId,
              jobId,
              success,
              backupHistoryId,
              error,
              timestamp: new Date().toISOString(),
            },
          });

          logger.info(`Job completed: ${jobId} - ${success ? 'success' : 'failed'}`);
          return;
        }

        logger.warn(`Unknown message type: ${message.type}`);
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Failed to process message',
          })
        );
      }
    });

    // Handle connection close
    ws.on('close', async () => {
      logger.info(`WebSocket connection closed for agent: ${agentId}`);

      if (agentId) {
        agentConnections.delete(agentId);

        try {
          await agentService.updateAgentStatus(agentId, 'offline');
        } catch (error) {
          logger.error('Error updating agent status on disconnect:', error);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to Rahat Backup Server. Please authenticate.',
      })
    );
  });

  return wss;
};

/**
 * Send message to specific agent
 * @param {string} agentId
 * @param {Object} message
 */
const sendToAgent = (agentId, message) => {
  const ws = agentConnections.get(agentId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
};

/**
 * Broadcast message to all agents of a user
 * @param {number} userId
 * @param {Object} message
 */
const broadcastToUser = async (userId, message) => {
  try {
    const agents = await agentService.getAgentsByUserId(userId);
    const agentIds = agents.map((agent) => agent.agentId);

    agentIds.forEach((agentId) => {
      sendToAgent(agentId, message);
    });
  } catch (error) {
    logger.error('Error broadcasting to user:', error);
  }
};

/**
 * Send backup job to agent
 * @param {string} agentId
 * @param {Object} jobData
 */
const sendBackupJob = (agentId, jobData) => {
  return sendToAgent(agentId, {
    type: 'backup_job',
    data: jobData,
  });
};

/**
 * Get online agents count
 */
const getOnlineAgentsCount = () => {
  return agentConnections.size;
};

/**
 * Check if agent is online
 * @param {string} agentId
 */
const isAgentOnline = (agentId) => {
  const ws = agentConnections.get(agentId);
  return ws && ws.readyState === WebSocket.OPEN;
};

module.exports = {
  initializeWebSocketServer,
  sendToAgent,
  broadcastToUser,
  sendBackupJob,
  getOnlineAgentsCount,
  isAgentOnline,
};
