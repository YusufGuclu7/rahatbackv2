const axios = require('axios');
const config = require('../utils/config');

/**
 * Create axios instance with auth token
 */
const createApiClient = () => {
  const serverUrl = config.getServerUrl();
  const authToken = config.getAuthToken();

  return axios.create({
    baseURL: `${serverUrl}/v1`,
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : {},
    timeout: 30000,
  });
};

/**
 * Login to backend
 * @param {string} email
 * @param {string} password
 */
const login = async (email, password) => {
  const client = createApiClient();
  const response = await client.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Register agent with backend
 * @param {Object} agentData
 */
const registerAgent = async (agentData) => {
  const client = createApiClient();
  const response = await client.post('/agent/register', agentData);
  return response.data;
};

/**
 * Get agent statistics (databases and jobs count)
 */
const getAgentStats = async () => {
  const client = createApiClient();
  const response = await client.get('/agent/stats');
  return response.data;
};

/**
 * Send heartbeat to backend
 * @param {string} agentId
 */
const sendHeartbeat = async (agentId) => {
  const client = createApiClient();
  const response = await client.post(`/agent/${agentId}/heartbeat`);
  return response.data;
};

/**
 * Update agent status
 * @param {string} agentId
 * @param {string} status
 */
const updateAgentStatus = async (agentId, status) => {
  const client = createApiClient();
  const response = await client.patch(`/agent/${agentId}/status`, { status });
  return response.data;
};

/**
 * Get all user's agents
 */
const getAgents = async () => {
  const client = createApiClient();
  const response = await client.get('/agent');
  return response.data;
};

/**
 * Delete agent
 * @param {string} agentId
 */
const deleteAgent = async (agentId) => {
  const client = createApiClient();
  const response = await client.delete(`/agent/${agentId}`);
  return response.data;
};

module.exports = {
  login,
  registerAgent,
  getAgentStats,
  sendHeartbeat,
  updateAgentStatus,
  getAgents,
  deleteAgent,
};
