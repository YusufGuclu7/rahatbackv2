const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { agentService } = require('../services');

/**
 * Register a new agent
 * POST /v1/agent/register
 */
const registerAgent = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const agentData = {
    ...req.body,
    ipAddress: req.ip || req.connection.remoteAddress,
  };

  const agent = await agentService.registerAgent(userId, agentData);

  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Agent registered successfully',
    data: agent,
  });
});

/**
 * Get user's agents
 * GET /v1/agent
 */
const getAgents = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const agents = await agentService.getAgentsByUserId(userId);

  res.send({
    success: true,
    data: agents,
  });
});

/**
 * Get agent by agentId
 * GET /v1/agent/:agentId
 */
const getAgent = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const agent = await agentService.getAgentByAgentId(agentId);

  res.send({
    success: true,
    data: agent,
  });
});

/**
 * Update agent heartbeat
 * POST /v1/agent/:agentId/heartbeat
 */
const heartbeat = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const agent = await agentService.updateAgentHeartbeat(agentId, ipAddress);

  res.send({
    success: true,
    message: 'Heartbeat updated',
    data: {
      agentId: agent.agentId,
      status: agent.status,
      lastHeartbeat: agent.lastHeartbeat,
    },
  });
});

/**
 * Get agent statistics (databases and jobs count)
 * GET /v1/agent/stats
 */
const getStats = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const stats = await agentService.getAgentStats(userId);

  res.send({
    success: true,
    data: stats,
  });
});

/**
 * Update agent status
 * PATCH /v1/agent/:agentId/status
 */
const updateStatus = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const { status } = req.body;

  const agent = await agentService.updateAgentStatus(agentId, status);

  res.send({
    success: true,
    message: 'Agent status updated',
    data: agent,
  });
});

/**
 * Update agent information
 * PATCH /v1/agent/:agentId
 */
const updateAgent = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const updateData = req.body;

  const agent = await agentService.updateAgent(agentId, updateData);

  res.send({
    success: true,
    message: 'Agent updated successfully',
    data: agent,
  });
});

/**
 * Delete agent
 * DELETE /v1/agent/:agentId
 */
const deleteAgent = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const userId = req.user.id;

  await agentService.deleteAgent(agentId, userId);

  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Get online agents (admin only)
 * GET /v1/agent/online
 */
const getOnlineAgents = catchAsync(async (req, res) => {
  const agents = await agentService.getOnlineAgents();

  res.send({
    success: true,
    data: agents,
  });
});

module.exports = {
  registerAgent,
  getAgents,
  getAgent,
  heartbeat,
  getStats,
  updateStatus,
  updateAgent,
  deleteAgent,
  getOnlineAgents,
};
