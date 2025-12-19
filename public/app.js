/**
 * Alpine.js Metronome Store
 * Main reactive state management for the metronome application
 * Integrates timing, audio, and WebSocket services
 */

import { TimingService } from './js/timing.js';
import { AudioService } from './js/audio.js';
import { WebSocketManager } from './js/websocket.js';
import { parseUrlParams, redirectToRoom, generateRoomId, debounce } from './js/utils.js';

function metronome() {
  return {
    // Core reactive state
    bpm: 120,
    timeSignature: '4/4',
    subdivisions: 'quarter',
    isPlaying: false,
    beatCount: 0,
    subdivisionCount: 0,

    // UI state
    mode: 'normal',
    roomId: null,
    wsConnected: false,
    beatActive: false,
    currentSubdivision: 0,
    copyButtonText: 'Copy Link',

    // Services (will be initialized)
    timingService: null,
    audioService: null,
    wsManager: null,

    // Timing control
    intervalId: null,

    // Tap tempo state
    lastTapTime: null,
    tapTimes: [],

    // Computed properties (Alpine.js getters)
    get subdivisionMultiplier() {
      return this.timingService ? this.timingService.getSubdivisionMultiplier(this.subdivisions) : 1;
    },

    get tickInterval() {
      return this.timingService ? this.timingService.calculateTickInterval(this.bpm, this.subdivisions) : 500;
    },

    get beatsPerMeasure() {
      return this.timingService ? this.timingService.parseTimeSignature(this.timeSignature).beats : 4;
    },

    get showSubdivisions() {
      return this.subdivisionMultiplier > 1;
    },

    get beatDisplayContent() {
      if (this.mode === 'remote') {
        return this.isPlaying ? 'STOP' : '<div class="play-triangle"></div>';
      } else {
        if (this.isPlaying) {
          return this.beatCount + 1;
        } else {
          return '<div class="play-triangle"></div>';
        }
      }
    },

    get connectionStatus() {
      return this.wsConnected ? 'Connected' : 'Disconnected';
    },

    // Initialization method (called by Alpine.js x-init)
    init() {
      this.initRoom();
      this.initServices();
      this.initWebSocket();
    },

    // Room initialization from legacy app.js lines 32-46
    initRoom() {
      const params = parseUrlParams();
      this.roomId = params.roomId;
      this.mode = params.mode;

      // Set copy button text based on mode
      this.copyButtonText = this.mode === 'normal' ? 'Copy Remote Link' : 'Copy Link';

      // Apply mode-specific styling
      if (this.mode === 'remote') {
        document.body.classList.add('remote-mode');
      }

      if (!this.roomId) {
        // Generate random room ID and redirect
        this.roomId = generateRoomId();
        redirectToRoom(this.roomId, this.mode);
        return;
      }
    },

    // Initialize service modules
    initServices() {
      this.timingService = TimingService;
      this.audioService = new AudioService();
      this.audioService.init(this.mode);
    },

    // WebSocket initialization
    initWebSocket() {
      this.wsManager = new WebSocketManager(
        this.roomId,
        (state) => this.updateFromRemote(state),
        (connected) => this.wsConnected = connected
      );
      this.wsManager.connect();
    },

    // State update from remote (from legacy app.js lines 167-215)
    updateFromRemote(state) {
      // Update BPM
      if (state.bpm !== undefined) {
        this.bpm = state.bpm;

        // Restart interval with new timing if currently playing
        if (this.isPlaying) {
          this.restartWithNewTiming();
          // Reset counts to sync timing across devices
          this.beatCount = 0;
          this.subdivisionCount = 0;
        }
      }

      // Update time signature
      if (state.timeSignature !== undefined) {
        this.timeSignature = state.timeSignature;
        // Reset counts when time signature changes to sync timing
        this.beatCount = 0;
        this.subdivisionCount = 0;
      }

      // Update subdivisions
      if (state.subdivisions !== undefined) {
        this.subdivisions = state.subdivisions;
        // Reset subdivision count when subdivisions change to sync timing
        this.subdivisionCount = 0;
      }

      // Update playing state
      if (state.playing !== undefined) {
        if (state.playing !== this.isPlaying) {
          if (state.playing) {
            this.startMetronome();
          } else {
            this.stopMetronome();
          }
        }
      }
    },

    // Broadcast state to other clients
    broadcastState() {
      if (this.wsManager) {
        this.wsManager.broadcast({
          bpm: this.bpm,
          playing: this.isPlaying,
          timeSignature: this.timeSignature,
          subdivisions: this.subdivisions
        });
      }
    },

    // Control methods
    togglePlay() {
      if (this.isPlaying) {
        this.stopMetronome();
      } else {
        this.startMetronome();
      }
      this.broadcastState();
    },

    // Start metronome (from legacy app.js lines 253-265)
    startMetronome() {
      // Resume audio context if suspended
      if (this.audioService) {
        this.audioService.resumeContext();
      }

      this.isPlaying = true;
      this.beatCount = 0;
      this.subdivisionCount = 0;

      // First beat immediately
      this.tick();
      this.intervalId = setInterval(() => this.tick(), this.tickInterval);
    },

    // Stop metronome (from legacy app.js lines 267-278)
    stopMetronome() {
      this.isPlaying = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      this.beatActive = false;
    },

    // Main tick function (from legacy app.js lines 348-376)
    tick() {
      const subdivisionMultiplier = this.subdivisionMultiplier;
      const beatsPerMeasure = this.beatsPerMeasure;

      // Check if this is a main beat (quarter note)
      const isMainBeat = this.timingService.isMainBeat(this.subdivisionCount, this.subdivisions);

      if (isMainBeat && this.mode !== 'remote') {
        // Visual beat flash
        this.visualBeat();
      }

      // Play audio (handles remote mode check internally)
      this.playClick(isMainBeat);

      // Update subdivision display
      if (this.showSubdivisions && this.mode !== 'remote') {
        this.currentSubdivision = this.timingService.getCurrentSubdivision(this.subdivisionCount, this.subdivisions);
      }

      // Advance subdivision count
      this.subdivisionCount++;

      // Advance beat count only on main beats
      if (isMainBeat) {
        this.beatCount = this.timingService.advanceBeatCount(this.beatCount, this.timeSignature);
      }
    },

    // Play click sound
    playClick(isMainBeat) {
      if (!this.audioService) return;

      const frequency = this.timingService.calculateBeatFrequency(this.beatCount, isMainBeat);
      this.audioService.playClick(frequency, isMainBeat);
    },

    // Visual beat flash
    visualBeat() {
      if (this.mode === 'remote') return;

      this.beatActive = true;
      setTimeout(() => {
        this.beatActive = false;
      }, 100);
    },

    // Restart timing with new interval
    restartWithNewTiming() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.tick(), this.tickInterval);
      }
    },

    // BPM control (from legacy app.js lines 416-431)
    setBpm(newBpm) {
      this.bpm = this.timingService.validateBpm(newBpm);

      if (this.isPlaying) {
        this.restartWithNewTiming();
        // Reset counts when BPM changes to sync timing across devices
        this.beatCount = 0;
        this.subdivisionCount = 0;
      }

      this.broadcastState();
    },

    // Adjust BPM by delta
    adjustBpm(delta) {
      this.setBpm(this.bpm + delta);
    },

    // Time signature control (from legacy app.js lines 433-438)
    setTimeSignature(newTimeSignature) {
      this.timeSignature = newTimeSignature;
      this.beatCount = 0; // Reset beat count
      this.subdivisionCount = 0; // Reset subdivision count
      this.broadcastState();
    },

    // Subdivisions control (from legacy app.js lines 440-452)
    setSubdivisions(newSubdivisions) {
      this.subdivisions = newSubdivisions;
      this.subdivisionCount = 0; // Reset subdivision count

      // Update timing if currently playing
      if (this.isPlaying) {
        this.restartWithNewTiming();
      }

      this.broadcastState();
    },

    // Tap tempo (from legacy app.js lines 454-484)
    tapTempo() {
      const now = Date.now();

      if (this.lastTapTime) {
        const interval = now - this.lastTapTime;
        this.tapTimes.push(interval);

        // Keep only last 4 taps
        if (this.tapTimes.length > 4) {
          this.tapTimes.shift();
        }

        if (this.tapTimes.length >= 2) {
          const newBpm = this.timingService.calculateTapTempoBpm(this.tapTimes);
          if (newBpm) {
            this.setBpm(newBpm);
          }
        }
      }

      this.lastTapTime = now;

      // Reset if no tap for 3 seconds
      setTimeout(() => {
        if (Date.now() - this.lastTapTime >= 3000) {
          this.tapTimes = [];
          this.lastTapTime = null;
        }
      }, 3000);
    },

    // Copy shareable link
    async copyLink() {
      if (this.wsManager) {
        const success = await this.wsManager.copyShareableUrl(this.mode);
        if (success) {
          const originalText = this.copyButtonText;
          this.copyButtonText = 'Copied!';
          setTimeout(() => {
            this.copyButtonText = originalText;
          }, 1000);
        }
      }
    }
  };
}

// Make metronome function available globally for Alpine.js after imports load
document.addEventListener('DOMContentLoaded', () => {
  window.metronome = metronome;
});

// Also make it immediately available
window.metronome = metronome;