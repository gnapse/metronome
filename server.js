const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const url = require('url');

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

const wss = new WebSocket.Server({ server });
const rooms = new Map(); // roomId -> { clients: Set<WebSocket>, state: {bpm, playing, timeSignature} }

function getRoomId(req) {
  const query = url.parse(req.url, true).query;
  return query.room;
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      state: { bpm: 120, playing: false, timeSignature: '4/4' }
    });
  }
  return rooms.get(roomId);
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

wss.on('connection', (ws, req) => {
  const roomId = getRoomId(req);
  if (!roomId) {
    ws.close(1008, 'Room ID required');
    return;
  }

  const room = getOrCreateRoom(roomId);
  room.clients.add(ws);
  ws.roomId = roomId;

  // Send current state to new client
  ws.send(JSON.stringify({ type: 'state', ...room.state }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'state') {
        // Update room state
        Object.assign(room.state, message);
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
      if (room.clients.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Metronome server running on port ${PORT}`);
});