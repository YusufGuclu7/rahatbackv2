const express = require('express');
const auth = require('../../middlewares/auth');
const agentController = require('../../controllers/agent.controller');

const router = express.Router();

// Register agent (authenticated users)
router.post('/register', auth(), agentController.registerAgent);

// Get stats (databases and jobs count)
router.get('/stats', auth(), agentController.getStats);

// Get all agents for authenticated user
router.get('/', auth(), agentController.getAgents);

// Get online agents (admin only)
router.get('/online', auth('manageUsers'), agentController.getOnlineAgents);

// Agent heartbeat
router.post('/:agentId/heartbeat', auth(), agentController.heartbeat);

// Update agent status
router.patch('/:agentId/status', auth(), agentController.updateStatus);

// Get, update, delete specific agent
router
  .route('/:agentId')
  .get(auth(), agentController.getAgent)
  .patch(auth(), agentController.updateAgent)
  .delete(auth(), agentController.deleteAgent);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: Desktop agent management
 */

/**
 * @swagger
 * /agent/register:
 *   post:
 *     summary: Register a new desktop agent
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - agentVersion
 *             properties:
 *               name:
 *                 type: string
 *                 description: Agent name or hostname
 *               hostname:
 *                 type: string
 *               platform:
 *                 type: string
 *                 description: Operating system (Windows, Darwin, Linux)
 *               osVersion:
 *                 type: string
 *               agentVersion:
 *                 type: string
 *               metadata:
 *                 type: object
 *             example:
 *               name: LAPTOP-HOME
 *               hostname: LAPTOP-HOME
 *               platform: Windows
 *               osVersion: Windows 11
 *               agentVersion: 1.0.0
 *     responses:
 *       "201":
 *         description: Agent registered successfully
 *       "401":
 *         description: Unauthorized
 */

/**
 * @swagger
 * /agent/stats:
 *   get:
 *     summary: Get agent statistics (databases and jobs count)
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     databases:
 *                       type: number
 *                     jobs:
 *                       type: number
 *       "401":
 *         description: Unauthorized
 */

/**
 * @swagger
 * /agent:
 *   get:
 *     summary: Get all agents for authenticated user
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Agents retrieved successfully
 *       "401":
 *         description: Unauthorized
 */

/**
 * @swagger
 * /agent/{agentId}/heartbeat:
 *   post:
 *     summary: Update agent heartbeat
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       "200":
 *         description: Heartbeat updated
 *       "401":
 *         description: Unauthorized
 *       "404":
 *         description: Agent not found
 */

/**
 * @swagger
 * /agent/{agentId}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Agent retrieved successfully
 *       "401":
 *         description: Unauthorized
 *       "404":
 *         description: Agent not found
 *   patch:
 *     summary: Update agent
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               agentVersion:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Agent updated successfully
 *       "401":
 *         description: Unauthorized
 *       "404":
 *         description: Agent not found
 *   delete:
 *     summary: Delete agent
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "204":
 *         description: Agent deleted successfully
 *       "401":
 *         description: Unauthorized
 *       "404":
 *         description: Agent not found
 */
