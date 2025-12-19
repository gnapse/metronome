import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import compression from 'compression';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parse as parseUrl } from 'url';
import { networkInterfaces } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Enhanced HTTP handling with security and compression (relaxed for local development)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      upgradeInsecureRequests: null  // Explicitly disable HTTPS upgrades for network IP access
    }
  },
  // Disable problematic headers for local network IP access
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  hsts: false,  // Don't force HTTPS - critical for network IP access
  contentTypeOptions: false // Allow flexible content types
}));
app.use(compression());

// Static file serving (no caching in development)
app.use(express.static('public', {
  maxAge: 0,
  etag: false
}));

// Network IP detection (preserved from legacy)
function getLocalNetworkIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

// WebSocket setup - EXACT logic preservation from legacy/server.js
const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomId -> { clients: Set<WebSocket>, state, lastActivity: timestamp }

const ROOM_TTL_MS = 60 * 60 * 1000; // 60 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

function cleanupStaleRooms() {
  const now = Date.now();
  let cleaned = 0;
  for (const [roomId, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      // Close any remaining connections
      room.clients.forEach(client => client.close(1000, 'Room expired'));
      rooms.delete(roomId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale room(s), ${rooms.size} remaining`);
  }
}

setInterval(cleanupStaleRooms, CLEANUP_INTERVAL_MS);

function getRoomId(req) {
  const query = parseUrl(req.url, true).query;
  return query.room;
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      state: { bpm: 120, playing: false, timeSignature: '4/4', subdivisions: 'quarter' },
      lastActivity: Date.now()
    });
  }
  return rooms.get(roomId);
}

function touchRoom(room) {
  room.lastActivity = Date.now();
}

function broadcastToRoom(roomId, message, sender = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// WebSocket connection handling - EXACT preservation from legacy/server.js lines 72-109
wss.on('connection', (ws, req) => {
  const roomId = getRoomId(req);
  if (!roomId) {
    ws.close(1008, 'Room ID required');
    return;
  }

  const isNewRoom = !rooms.has(roomId);
  const room = getOrCreateRoom(roomId);
  room.clients.add(ws);
  ws.roomId = roomId;
  touchRoom(room);

  if (isNewRoom) {
    console.log(`Room created: ${roomId}`);
  } else {
    console.log(`Client joined room: ${roomId} (${room.clients.size} clients)`);
  }

  // Send current state to new client
  ws.send(JSON.stringify({ type: 'state', networkIP: getLocalNetworkIP(), ...room.state }));

  // Notify other clients that someone joined
  if (!isNewRoom) {
    broadcastToRoom(roomId, { type: 'client-joined', clientCount: room.clients.size }, ws);
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'state') {
        // Update room state and activity timestamp
        Object.assign(room.state, message);
        touchRoom(room);
        // Broadcast to other clients in room
        broadcastToRoom(roomId, message, ws);
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    if (room) {
      room.clients.delete(ws);
      console.log(`Client left room: ${roomId} (${room.clients.size} remaining)`);
      if (room.clients.size === 0) {
        rooms.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Enhanced metronome server running on port ${PORT}`);
  const networkIP = getLocalNetworkIP();
  if (networkIP) {
    console.log(`Local network access: http://${networkIP}:${PORT}`);
  }
});