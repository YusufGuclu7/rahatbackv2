const WebSocket = require('ws');
const EventEmitter = require('events');
const config = require('../utils/config');

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.reconnectInterval = 5000;
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    const serverUrl = config.getServerUrl();
    const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const wsEndpoint = `${wsUrl}/ws/agent`;

    console.log(`Connecting to WebSocket: ${wsEndpoint}`);

    try {
      this.ws = new WebSocket(wsEndpoint);

      this.ws.on('open', () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.emit('connected');

        // Authenticate
        this.authenticate();

        // Start heartbeat
        this.startHeartbeat();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('WebSocket message received:', message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');

        // Attempt reconnect
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Authenticate with backend
   */
  authenticate() {
    const authToken = config.getAuthToken();
    const agentId = config.getAgentId();

    if (!authToken || !agentId) {
      console.error('Missing auth credentials for WebSocket');
      this.emit('auth_required');
      return;
    }

    this.send({
      type: 'auth',
      data: {
        token: authToken,
        agentId: agentId,
      },
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'welcome':
        console.log('Server says:', message.message);
        break;

      case 'auth_success':
        console.log('Authentication successful');
        this.emit('authenticated', message.data);
        break;

      case 'auth_error':
        console.error('Authentication failed:', message.error);
        this.emit('auth_error', message.error);
        this.disconnect();
        break;

      case 'stats_update':
        console.log('Stats update received:', message.data);
        this.emit('stats_update', message.data);
        break;

      case 'backup_job':
        console.log('Backup job received:', message.data);
        this.emit('backup_job', message.data);
        break;

      case 'heartbeat_ack':
        console.log('Heartbeat acknowledged');
        break;

      case 'error':
        console.error('Server error:', message.error);
        this.emit('server_error', message.error);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, cannot send message');
    return false;
  }

  /**
   * Send heartbeat
   */
  sendHeartbeat() {
    this.send({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start heartbeat timer
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    console.log(`Reconnecting in ${this.reconnectInterval / 1000} seconds...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Send job status update
   */
  sendJobStatus(jobId, status, progress, message) {
    this.send({
      type: 'job_status',
      data: {
        jobId,
        status,
        progress,
        message,
      },
    });
  }

  /**
   * Send job completion
   */
  sendJobComplete(jobId, success, backupHistoryId, error = null) {
    this.send({
      type: 'job_complete',
      data: {
        jobId,
        success,
        backupHistoryId,
        error,
      },
    });
  }
}

// Export singleton instance
module.exports = new WebSocketService();
