const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const { agentModel, databaseModel, backupJobModel } = require('../models');
const { auditLogService } = require('.');

/**
 * Register a new agent
 * @param {number} userId
 * @param {Object} agentData
 * @returns {Promise<Agent>}
 */
const registerAgent = async (userId, agentData) => {
  const agentId = uuidv4();

  const agent = await agentModel.createAgent({
    userId,
    agentId,
    name: agentData.name || agentData.hostname || 'Unknown Agent',
    platform: agentData.platform,
    osVersion: agentData.osVersion,
    agentVersion: agentData.agentVersion || '1.0.0',
    status: 'online',
    lastHeartbeat: new Date(),
    lastIpAddress: agentData.ipAddress,
    metadata: agentData.metadata ? JSON.stringify(agentData.metadata) : null,
  });

  // Audit log
  await auditLogService.logAction({
    userId,
    action: 'AGENT_REGISTER',
    resource: 'agent',
    resourceId: agent.id,
    details: {
      agentId: agent.agentId,
      name: agent.name,
      platform: agent.platform,
    },
    ipAddress: agentData.ipAddress,
    status: 'success',
  });

  return agent;
};

/**
 * Get agent by agentId
 * @param {string} agentId
 * @returns {Promise<Agent>}
 */
const getAgentByAgentId = async (agentId) => {
  const agent = await agentModel.getAgentByAgentId(agentId);
  if (!agent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Agent not found');
  }
  return agent;
};

/**
 * Get agents by userId
 * @param {number} userId
 * @returns {Promise<Agent[]>}
 */
const getAgentsByUserId = async (userId) => {
  const agents = await agentModel.getAgentsByUserId(userId);
  return agents;
};

/**
 * Update agent heartbeat
 * @param {string} agentId
 * @param {string} ipAddress
 * @returns {Promise<Agent>}
 */
const updateAgentHeartbeat = async (agentId, ipAddress) => {
  const agent = await getAgentByAgentId(agentId);

  const updatedAgent = await agentModel.updateAgent(agentId, {
    lastHeartbeat: new Date(),
    status: 'online',
    lastIpAddress: ipAddress || agent.lastIpAddress,
  });

  return updatedAgent;
};

/**
 * Update agent status
 * @param {string} agentId
 * @param {string} status - online, offline, error
 * @returns {Promise<Agent>}
 */
const updateAgentStatus = async (agentId, status) => {
  const agent = await getAgentByAgentId(agentId);

  const updatedAgent = await agentModel.updateAgentStatus(agentId, status);

  // Audit log
  await auditLogService.logAction({
    userId: agent.userId,
    action: status === 'online' ? 'AGENT_CONNECT' : 'AGENT_DISCONNECT',
    resource: 'agent',
    resourceId: agent.id,
    details: { agentId, status },
    status: 'success',
  });

  return updatedAgent;
};

/**
 * Get agent statistics (databases and jobs count)
 * @param {number} userId
 * @returns {Promise<Object>}
 */
const getAgentStats = async (userId) => {
  // Get all databases for user
  const databases = await databaseModel.findByUserId(userId);
  const activeDatabases = databases.filter((db) => db.isActive);

  // Get all backup jobs for user's databases
  const databaseIds = databases.map((db) => db.id);
  const jobs = await backupJobModel.getJobsByDatabaseIds(databaseIds);
  const activeJobs = jobs.filter((job) => job.isActive);

  return {
    databases: activeDatabases.length,
    jobs: activeJobs.length,
    totalDatabases: databases.length,
    totalJobs: jobs.length,
  };
};

/**
 * Update agent information
 * @param {string} agentId
 * @param {Object} updateData
 * @returns {Promise<Agent>}
 */
const updateAgent = async (agentId, updateData) => {
  const agent = await getAgentByAgentId(agentId);

  const updatedAgent = await agentModel.updateAgent(agentId, updateData);

  // Audit log
  await auditLogService.logAction({
    userId: agent.userId,
    action: 'AGENT_UPDATE',
    resource: 'agent',
    resourceId: agent.id,
    details: { agentId, updateData },
    status: 'success',
  });

  return updatedAgent;
};

/**
 * Delete agent
 * @param {string} agentId
 * @param {number} userId
 * @returns {Promise<void>}
 */
const deleteAgent = async (agentId, userId) => {
  const agent = await getAgentByAgentId(agentId);

  // Check if agent belongs to user
  if (agent.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to delete this agent');
  }

  await agentModel.deleteAgent(agentId);

  // Audit log
  await auditLogService.logAction({
    userId,
    action: 'AGENT_DELETE',
    resource: 'agent',
    resourceId: agent.id,
    details: { agentId, name: agent.name },
    status: 'success',
  });
};

/**
 * Get online agents
 * @returns {Promise<Agent[]>}
 */
const getOnlineAgents = async () => {
  const agents = await agentModel.getOnlineAgents();
  return agents;
};

module.exports = {
  registerAgent,
  getAgentByAgentId,
  getAgentsByUserId,
  updateAgentHeartbeat,
  updateAgentStatus,
  getAgentStats,
  updateAgent,
  deleteAgent,
  getOnlineAgents,
};
