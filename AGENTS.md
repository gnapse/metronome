# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # Install dependencies
npm start        # Start server (also: npm run dev)
```

Server runs at http://localhost:3000. Network IP printed on startup for LAN access.

## Architecture

Real-time synchronized metronome with room-based WebSocket communication.

### Server (`server.js`)
Express + WebSocket server. Room management via Map: `roomId -> { clients: Set<WebSocket>, state }`. State includes bpm, playing, timeSignature, subdivisions. Broadcasts state changes to all room clients except sender.

### Client (`public/`)
Alpine.js reactive store in `app.js`. ES modules with no build step.

**Service modules in `public/js/`:**
- `audio.js` - Web Audio API oscillator synthesis. Skipped in remote mode.
- `timing.js` - Pure functions: BPM validation, subdivision math, tap tempo calculation
- `websocket.js` - Connection management, auto-reconnect, state broadcast
- `utils.js` - Room ID generation, URL parsing, redirect helpers

### Two Modes
- **normal**: Full UI with audio playback, shows beat count
- **remote**: Control-only, no audio, just play/stop button. URL param `?mode=remote`

Room ID is 6-char alphanumeric in URL param `?room=abc123`. Generated client-side if missing.

### State Flow
1. User action triggers Alpine method (e.g., `togglePlay()`)
2. Method updates local state and calls `broadcastState()`
3. WebSocket sends to server, server broadcasts to room
4. Other clients receive via `updateFromRemote()` callback

### Audio
Oscillator per click: 1000Hz downbeat, 800Hz other beats, 600Hz subdivisions. 100ms exponential decay.

## Key Constraints
- ES modules (`type: "module"` in package.json)
- No build/transpile step
- Alpine.js loaded from CDN
- QrCreator library for QR code sharing
