const database = require('../utils/database');

const createAgent = async (agentData) => {
  const agent = await database.agent.create({
    data: agentData,
  });
  return agent;
};

const getAgentById = async (id) => {
  const agent = await database.agent.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  return agent;
};

const getAgentByAgentId = async (agentId) => {
  const agent = await database.agent.findUnique({
    where: { agentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  return agent;
};

const getAgentsByUserId = async (userId) => {
  const agents = await database.agent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return agents;
};

const updateAgent = async (agentId, updateData) => {
  const updatedAgent = await database.agent.update({
    where: { agentId },
    data: updateData,
  });
  return updatedAgent;
};

const updateAgentHeartbeat = async (agentId) => {
  const updatedAgent = await database.agent.update({
    where: { agentId },
    data: {
      lastHeartbeat: new Date(),
      status: 'online',
    },
  });
  return updatedAgent;
};

const updateAgentStatus = async (agentId, status) => {
  const updatedAgent = await database.agent.update({
    where: { agentId },
    data: { status },
  });
  return updatedAgent;
};

const deleteAgent = async (agentId) => {
  const deletedAgent = await database.agent.delete({
    where: { agentId },
  });
  return deletedAgent;
};

const getOnlineAgents = async () => {
  const agents = await database.agent.findMany({
    where: {
      status: 'online',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  return agents;
};

module.exports = {
  createAgent,
  getAgentById,
  getAgentByAgentId,
  getAgentsByUserId,
  updateAgent,
  updateAgentHeartbeat,
  updateAgentStatus,
  deleteAgent,
  getOnlineAgents,
};
