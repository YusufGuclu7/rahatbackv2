const { app, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const config = require('./utils/config');

let tray = null;
let stats = { databases: 0, jobs: 0 };
let connectionStatus = 'offline';

/**
 * Create system tray icon
 */
const createTray = (mainWindow, settingsWindow) => {
  // Create tray icon
  const iconPath = path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png');

  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      throw new Error('Icon is empty');
    }
    // Resize for tray (tray icons should be small, typically 16x16 or 22x22)
    icon = icon.resize({ width: 22, height: 22 });
  } catch (error) {
    console.error('Error loading tray icon:', error);
    // Create a simple colored icon as fallback
    const canvas = require('electron').nativeImage.createEmpty();
    icon = canvas;
  }

  tray = new Tray(icon);
  tray.setToolTip('Rahat Backup Agent');

  updateTrayMenu(mainWindow, settingsWindow);

  return tray;
};

/**
 * Update tray context menu
 */
const updateTrayMenu = (mainWindow, settingsWindow) => {
  if (!tray) return;

  // Check if user is authenticated
  const isAuthenticated = config.isAuthenticated();

  if (!isAuthenticated) {
    // Logged out menu - minimal
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '❌ Disconnected',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '🔑 Login',
        click: () => {
          const { BrowserWindow } = require('electron');
          const path = require('path');

          // Check if login window already exists
          let loginWindow = BrowserWindow.getAllWindows().find(
            (win) => !win.isDestroyed() && win.getTitle().includes('Login')
          );

          if (!loginWindow) {
            loginWindow = new BrowserWindow({
              width: 450,
              height: 600,
              show: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
              },
              icon: path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png'),
            });
            loginWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
          } else {
            loginWindow.show();
            loginWindow.focus();
          }
        },
      },
      {
        label: '❌ Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    return;
  }

  // Logged in menu - full features
  const statusText =
    connectionStatus === 'online'
      ? '✅ Connected'
      : connectionStatus === 'connecting'
      ? '🔄 Connecting...'
      : '❌ Disconnected';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: statusText,
      enabled: false,
    },
    {
      label: `💾 Databases: ${stats.databases}`,
      enabled: false,
    },
    {
      label: `📦 Jobs: ${stats.jobs}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '📊 Show Dashboard',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-dashboard');
        }
        // Also handle via IPC in case main window is not available
        const { ipcMain } = require('electron');
        const { BrowserWindow } = require('electron');

        // Find or create dashboard window
        const path = require('path');
        let dashboardWindow = BrowserWindow.getAllWindows().find(
          (win) => win.getTitle().includes('Dashboard')
        );

        if (!dashboardWindow) {
          dashboardWindow = new BrowserWindow({
            width: 700,
            height: 600,
            show: true,
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
        } else {
          dashboardWindow.show();
          dashboardWindow.focus();
        }
      },
    },
    {
      label: '🌐 Open Web Dashboard',
      click: () => {
        const serverUrl = config.getServerUrl();
        // Frontend runs on port 3001, backend API on 3000
        const frontendUrl = serverUrl.replace(':3000', ':3001');
        shell.openExternal(frontendUrl);
      },
    },
    { type: 'separator' },
    {
      label: '⚙️ Settings',
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
        }
      },
    },
    {
      label: '🔄 Restart Agent',
      click: () => {
        app.relaunch();
        app.exit(0);
      },
    },
    { type: 'separator' },
    {
      label: '🚪 Logout',
      click: async () => {
        const { ipcMain } = require('electron');
        const { dialog } = require('electron');

        // Show confirmation dialog
        const response = await dialog.showMessageBox({
          type: 'question',
          buttons: ['Cancel', 'Logout'],
          defaultId: 0,
          title: 'Logout',
          message: 'Are you sure you want to logout?',
          detail: 'You will need to login again to use the agent.',
        });

        if (response.response === 1) {
          // User clicked Logout
          const apiService = require('./services/api.service');
          const websocketService = require('./services/websocket.service');

          // Disconnect WebSocket
          websocketService.disconnect();

          // Update agent status
          const agentId = config.getAgentId();
          if (agentId) {
            try {
              await apiService.updateAgentStatus(agentId, 'offline');
            } catch (error) {
              console.error('Error updating agent status:', error);
            }
          }

          // Clear auth
          config.clearAuth();

          // Update tray
          updateConnectionStatus('offline', mainWindow, settingsWindow);
          updateStats({ databases: 0, jobs: 0 }, mainWindow, settingsWindow);

          // Close dashboard and settings windows only (not all windows)
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach((win) => {
            const winTitle = win.getTitle();
            // Close dashboard and settings, but not login window if it exists
            if (winTitle.includes('Dashboard') || winTitle.includes('Settings')) {
              win.close();
            }
          });

          // Show login window
          const path = require('path');
          const loginWindow = new BrowserWindow({
            width: 450,
            height: 600,
            show: true,
            resizable: false,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
            },
            icon: path.join(__dirname, '..', 'assets', 'rahatsistem-logo.png'),
          });
          loginWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
        }
      },
    },
    {
      label: '❌ Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
};

/**
 * Update stats displayed in tray
 */
const updateStats = (newStats, mainWindow, settingsWindow) => {
  stats = newStats;
  updateTrayMenu(mainWindow, settingsWindow);
};

/**
 * Update connection status
 */
const updateConnectionStatus = (status, mainWindow, settingsWindow) => {
  connectionStatus = status;
  updateTrayMenu(mainWindow, settingsWindow);

  // Update tooltip
  const tooltip =
    status === 'online'
      ? `Rahat Backup Agent - Connected\n${stats.databases} Databases | ${stats.jobs} Jobs`
      : status === 'connecting'
      ? 'Rahat Backup Agent - Connecting...'
      : 'Rahat Backup Agent - Disconnected';

  if (tray) {
    tray.setToolTip(tooltip);
  }
};

/**
 * Show notification
 */
const showNotification = (title, body) => {
  const showNotifications = config.getSettings().showNotifications;
  if (!showNotifications) return;

  if (tray) {
    tray.displayBalloon({
      title,
      content: body,
    });
  }
};

/**
 * Destroy tray
 */
const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

module.exports = {
  createTray,
  updateTrayMenu,
  updateStats,
  updateConnectionStatus,
  showNotification,
  destroyTray,
};
