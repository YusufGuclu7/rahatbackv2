const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./utils/config');
const apiService = require('./services/api.service');
const websocketService = require('./services/websocket.service');
const tray = require('./tray');

let mainWindow = null;
let settingsWindow = null;
let dashboardWindow = null;

/**
 * Create main window (login/setup)
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 600,
    show: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Create settings window
 */
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 500,
    show: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png'),
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

/**
 * Create dashboard window
 */
function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return dashboardWindow;
  }

  dashboardWindow = new BrowserWindow({
    width: 700,
    height: 600,
    show: false,
    resizable: true,
    minimumWidth: 600,
    minimumHeight: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png'),
  });

  dashboardWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'));

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  return dashboardWindow;
}

/**
 * Initialize application
 */
async function initialize() {
  console.log('Initializing Rahat Backup Agent...');

  // Check if already authenticated
  if (config.isAuthenticated()) {
    console.log('Agent is authenticated, connecting to server...');

    // Connect to WebSocket
    websocketService.connect();

    // Fetch initial stats
    try {
      const statsResponse = await apiService.getAgentStats();
      tray.updateStats(statsResponse.data, mainWindow, settingsWindow);
    } catch (error) {
      console.error('Error fetching initial stats:', error);
    }

    // Open dashboard window automatically
    createDashboardWindow();
    console.log('Agent running with dashboard');
  } else {
    // Show login window
    console.log('Agent not authenticated, showing login window...');
    createMainWindow();
  }
}

/**
 * App ready
 */
app.whenReady().then(() => {
  // Create system tray
  tray.createTray(mainWindow, settingsWindow);

  // Initialize
  initialize();
});

/**
 * Handle app activation (macOS)
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

/**
 * Prevent app quit, minimize to tray instead
 */
app.on('window-all-closed', (event) => {
  // Keep app running in tray
  console.log('All windows closed, running in background...');
});

/**
 * Handle app quit
 */
app.on('before-quit', () => {
  // Disconnect WebSocket
  websocketService.disconnect();

  // Destroy tray
  tray.destroyTray();
});

// ==================== IPC Handlers ====================

/**
 * Login handler
 */
ipcMain.handle('login', async (event, { email, password, serverUrl }) => {
  try {
    console.log('Login attempt:', email);

    // Update server URL if provided
    if (serverUrl) {
      config.setServerUrl(serverUrl);
    }

    // Login
    const loginResponse = await apiService.login(email, password);
    const { tokens, user } = loginResponse;

    // Store auth token
    config.setAuthToken(tokens.access.token);
    config.setUserId(user.id);
    config.setUserEmail(user.email);

    console.log('Login successful');

    // Register agent
    const systemInfo = config.getSystemInfo();
    const agentData = {
      name: systemInfo.hostname,
      hostname: systemInfo.hostname,
      platform: systemInfo.platform,
      osVersion: systemInfo.osVersion,
      agentVersion: app.getVersion(),
      metadata: systemInfo,
    };

    const agentResponse = await apiService.registerAgent(agentData);
    const agent = agentResponse.data;

    // Store agent ID
    config.setAgentId(agent.agentId);

    console.log('Agent registered:', agent.agentId);

    // Connect to WebSocket
    websocketService.connect();

    // Fetch stats
    const statsResponse = await apiService.getAgentStats();
    tray.updateStats(statsResponse.data, mainWindow, settingsWindow);

    // Close login window
    if (mainWindow) {
      mainWindow.close();
    }

    // Open dashboard window
    createDashboardWindow();

    // Show notification
    tray.showNotification('Rahat Backup Agent', 'Successfully connected to server');

    return { success: true, message: 'Login successful' };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Login failed',
    };
  }
});

/**
 * Logout handler
 */
ipcMain.handle('logout', async () => {
  try {
    // Disconnect WebSocket
    websocketService.disconnect();

    // Update agent status
    const agentId = config.getAgentId();
    if (agentId) {
      await apiService.updateAgentStatus(agentId, 'offline');
    }

    // Clear auth
    config.clearAuth();

    // Update tray
    tray.updateConnectionStatus('offline', mainWindow, settingsWindow);
    tray.updateStats({ databases: 0, jobs: 0 }, mainWindow, settingsWindow);

    // Close dashboard window if open
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.close();
    }

    // Close settings window if open
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }

    // Show login window
    createMainWindow();

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, message: error.message };
  }
});

/**
 * Get settings
 */
ipcMain.handle('get-settings', async () => {
  return {
    ...config.getSettings(),
    userEmail: config.getUserEmail(),
    agentId: config.getAgentId(),
    isConnected: websocketService.isConnected,
  };
});

/**
 * Update settings
 */
ipcMain.handle('update-settings', async (event, settings) => {
  try {
    config.updateSettings(settings);
    return { success: true, message: 'Settings updated' };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, message: error.message };
  }
});

/**
 * Get stats
 */
ipcMain.handle('get-stats', async () => {
  try {
    const response = await apiService.getAgentStats();
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { success: false, message: error.message };
  }
});

/**
 * Open settings window
 */
ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

/**
 * Open dashboard window
 */
ipcMain.handle('open-dashboard', () => {
  createDashboardWindow();
});

// ==================== WebSocket Event Handlers ====================

websocketService.on('connected', () => {
  console.log('WebSocket connected');
  tray.updateConnectionStatus('online', mainWindow, settingsWindow);
});

websocketService.on('disconnected', () => {
  console.log('WebSocket disconnected');
  tray.updateConnectionStatus('offline', mainWindow, settingsWindow);
});

websocketService.on('authenticated', (data) => {
  console.log('WebSocket authenticated:', data);
  tray.showNotification('Rahat Backup Agent', 'Connected to server');
});

websocketService.on('auth_error', (error) => {
  console.error('WebSocket auth error:', error);
  tray.showNotification('Rahat Backup Agent', 'Authentication failed. Please login again.');
  config.clearAuth();
  createMainWindow();
});

websocketService.on('stats_update', (stats) => {
  console.log('Stats update:', stats);
  tray.updateStats(stats, mainWindow, settingsWindow);
});

websocketService.on('backup_job', (jobData) => {
  console.log('Backup job received:', jobData);
  tray.showNotification('Rahat Backup', `Starting backup job: ${jobData.name || jobData.job_id}`);

  // TODO: Execute backup job
  // For now, just send a mock completion
  setTimeout(() => {
    websocketService.sendJobComplete(jobData.job_id, true, null);
    tray.showNotification('Rahat Backup', `Backup completed: ${jobData.name || jobData.job_id}`);
  }, 5000);
});

websocketService.on('error', (error) => {
  console.error('WebSocket error:', error);
});

console.log('Rahat Backup Agent - Main process loaded');
