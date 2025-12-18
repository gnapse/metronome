# Remote Metronome

A minimal metronome app with WebSocket remote control and room-based functionality for synchronized multi-device use.

## Features

- **Room-based sessions**: Each room has isolated metronome state
- **Real-time sync**: Changes sync instantly across all devices in the same room
- **Visual & audio feedback**: Animated beat indicator with Web Audio API clicks
- **Tap tempo**: Calculate BPM by tapping the beat
- **Time signatures**: Support for 2/4, 3/4, 4/4, 6/8, 7/8
- **Mobile friendly**: Responsive design for all screen sizes

## Usage

### Local Development
```bash
npm install
npm start
```
Open http://localhost:3000

### Room Sharing
1. Open the app - you'll be redirected to a unique room URL
2. Click "Copy Link" to share the URL with other devices
3. All devices in the same room stay synchronized

### Controls
- **Play/Stop**: Start/stop the metronome
- **BPM Slider**: Set tempo (40-220 BPM)
- **Tap Tempo**: Tap button to calculate BPM from your tapping rhythm
- **Time Signature**: Select beat pattern

### Deployment
For public deployment:
1. Deploy to any Node.js hosting service
2. Ensure WebSocket support (most modern hosts support this)
3. For HTTPS sites, WebSocket will automatically upgrade to WSS

## Architecture

- **Server**: Single Node.js file (~76 lines) with static file serving and WebSocket room management
- **Client**: Vanilla HTML/CSS/JS with Web Audio API
- **Dependencies**: Only `ws` package for WebSocket server
- **State sync**: Bidirectional room-based synchronization

## Room System

- Room IDs are 6-character alphanumeric strings
- Generated client-side if not present in URL
- Empty rooms are automatically cleaned up when last client disconnects
- Each room maintains independent state (BPM, playing status, time signature)