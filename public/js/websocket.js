/**
 * WebSocket Manager - Connection and state synchronization
 * Extracted from legacy app.js lines 86-110, 167-227
 */

export class WebSocketManager {
  constructor(roomId, onStateUpdate, onConnectionChange, onNewConnection = null) {
    this.roomId = roomId;
    this.onStateUpdate = onStateUpdate;
    this.onConnectionChange = onConnectionChange;
    this.onNewConnection = onNewConnection;
    this.ws = null;
    this.networkIP = null;
    this.reconnectDelay = 2000;
    this.isConnected = false;
    this.lastClientCount = 0;
    this.hasReceivedInitialState = false;
  }

  /**
   * Initialize WebSocket connection
   * From legacy app.js lines 86-110
   */
  connect() {
    if (this.ws) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${this.roomId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onConnectionChange(true);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onConnectionChange(false);
        // Try to reconnect after 2 seconds
        setTimeout(() => this.connect(), this.reconnectDelay);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            this.handleStateUpdate(data);
          }
        } catch (error) {
          console.warn('Invalid WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnected = false;
      this.onConnectionChange(false);
    }
  }

  /**
   * Handle incoming state updates from server
   * From legacy app.js lines 167-215
   */
  handleStateUpdate(state) {
    // Store network IP for link generation
    if (state.networkIP !== undefined) {
      this.networkIP = state.networkIP;
    }

    // Detect potential new connections
    // Skip the first state update (initial connection)
    if (this.hasReceivedInitialState && this.onNewConnection) {
      // Call new connection handler for any state update after initial
      // This is a simple heuristic - state updates often indicate new clients
      this.onNewConnection();
    }

    if (!this.hasReceivedInitialState) {
      this.hasReceivedInitialState = true;
    }

    // Pass state update to main store
    this.onStateUpdate(state);
  }

  /**
   * Broadcast current state to other clients
   * From legacy app.js lines 217-227
   */
  broadcast(state) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'state',
          bpm: state.bpm,
          playing: state.playing,
          timeSignature: state.timeSignature,
          subdivisions: state.subdivisions
        }));
      } catch (error) {
        console.warn('Failed to broadcast state:', error);
      }
    }
  }

  /**
   * Generate shareable URL for current room
   * From legacy app.js lines 146-164
   */
  generateShareableUrl(mode) {
    let linkUrl = window.location.href;

    // Generate remote control link if in normal mode
    if (mode === 'normal') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'remote');
      linkUrl = url.toString();
    }

    // Use network IP if current host is localhost and we have a network IP
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.networkIP) {
      linkUrl = linkUrl.replace(window.location.hostname, this.networkIP);
    }

    return linkUrl;
  }

  /**
   * Copy shareable URL to clipboard
   */
  async copyShareableUrl(mode) {
    try {
      const url = this.generateShareableUrl(mode);
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.warn('Failed to copy URL:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED
    };
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Reconnect with new room ID
   */
  reconnectWithRoom(newRoomId) {
    this.roomId = newRoomId;
    this.disconnect();
    this.connect();
  }
}