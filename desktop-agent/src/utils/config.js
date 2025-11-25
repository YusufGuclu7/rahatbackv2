const Store = require('electron-store').default || require('electron-store');
const os = require('os');

// Initialize electron-store for persisting config
const store = new Store({
  name: 'rahat-agent-config',
  defaults: {
    serverUrl: 'http://localhost:3000',
    authToken: null,
    agentId: null,
    userId: null,
    userEmail: null,
    autoStart: true,
    showNotifications: true,
    autoUpdate: true,
  },
});

/**
 * Get server URL
 */
const getServerUrl = () => {
  return store.get('serverUrl');
};

/**
 * Set server URL
 */
const setServerUrl = (url) => {
  store.set('serverUrl', url);
};

/**
 * Get authentication token
 */
const getAuthToken = () => {
  return store.get('authToken');
};

/**
 * Set authentication token
 */
const setAuthToken = (token) => {
  store.set('authToken', token);
};

/**
 * Get agent ID
 */
const getAgentId = () => {
  return store.get('agentId');
};

/**
 * Set agent ID
 */
const setAgentId = (agentId) => {
  store.set('agentId', agentId);
};

/**
 * Get user ID
 */
const getUserId = () => {
  return store.get('userId');
};

/**
 * Set user ID
 */
const setUserId = (userId) => {
  store.set('userId', userId);
};

/**
 * Get user email
 */
const getUserEmail = () => {
  return store.get('userEmail');
};

/**
 * Set user email
 */
const setUserEmail = (email) => {
  store.set('userEmail', email);
};

/**
 * Check if agent is authenticated
 */
const isAuthenticated = () => {
  return !!getAuthToken() && !!getAgentId();
};

/**
 * Clear all auth data
 */
const clearAuth = () => {
  store.set('authToken', null);
  store.set('agentId', null);
  store.set('userId', null);
  store.set('userEmail', null);
};

/**
 * Get all settings
 */
const getSettings = () => {
  return {
    serverUrl: getServerUrl(),
    autoStart: store.get('autoStart'),
    showNotifications: store.get('showNotifications'),
    autoUpdate: store.get('autoUpdate'),
  };
};

/**
 * Update settings
 */
const updateSettings = (settings) => {
  if (settings.serverUrl !== undefined) store.set('serverUrl', settings.serverUrl);
  if (settings.autoStart !== undefined) store.set('autoStart', settings.autoStart);
  if (settings.showNotifications !== undefined) store.set('showNotifications', settings.showNotifications);
  if (settings.autoUpdate !== undefined) store.set('autoUpdate', settings.autoUpdate);
};

/**
 * Get system info for agent registration
 */
const getSystemInfo = () => {
  return {
    hostname: os.hostname(),
    platform: os.platform(), // 'win32', 'darwin', 'linux'
    osVersion: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
  };
};

module.exports = {
  store,
  getServerUrl,
  setServerUrl,
  getAuthToken,
  setAuthToken,
  getAgentId,
  setAgentId,
  getUserId,
  setUserId,
  getUserEmail,
  setUserEmail,
  isAuthenticated,
  clearAuth,
  getSettings,
  updateSettings,
  getSystemInfo,
};
