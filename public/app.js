/**
 * Alpine.js Metronome Store
 * Main reactive state management for the metronome application
 * Integrates timing, audio, and WebSocket services
 */

/// <reference path="./types.d.ts" />

import { AudioService } from "./js/audio.js";
import { TimingService } from "./js/timing.js";
import { WebSocketManager } from "./js/websocket.js";
import { generateRoomId, parseUrlParams, updateUrl } from "./js/utils.js";

function metronome() {
	return {
		// Core reactive state
		/** @type {number} */
		bpm: 120,
		/** @type {string} */
		timeSignature: "4/4",
		/** @type {string} */
		subdivisions: "quarter",
		/** @type {boolean} */
		isPlaying: false,
		/** @type {number} */
		beatCount: -1,
		/** @type {number} */
		subdivisionCount: 0,

		// UI state
		/** @type {string} */
		mode: "normal",
		/** @type {string | null} */
		roomId: null,
		/** @type {boolean} */
		wsConnected: false,
		/** @type {boolean} */
		beatActive: false,
		/** @type {number} */
		currentSubdivision: 0,

		// QR Modal state
		/** @type {boolean} */
		showQrModal: false,
		/** @type {string | null} */
		qrCodeDataUrl: null,
		/** @type {boolean} */
		connectionFeedback: false,
		/** @type {string} */
		copyUrlText: "Copy URL",

		// Services (will be initialized)
		/** @type {typeof TimingService | null} */
		timingService: null,
		/** @type {AudioService | null} */
		audioService: null,
		/** @type {WebSocketManager | null} */
		wsManager: null,

		// Timing control
		/** @type {ReturnType<typeof setInterval> | null} */
		intervalId: null,

		// Tap tempo state
		/** @type {number | null} */
		lastTapTime: null,
		/** @type {number[]} */
		tapTimes: [],

		// Guard for double init
		/** @type {boolean | undefined} */
		_initialized: undefined,

		// Computed properties (Alpine.js getters)
		get subdivisionMultiplier() {
			return this.timingService
				? this.timingService.getSubdivisionMultiplier(this.subdivisions)
				: 1;
		},

		get tickInterval() {
			return this.timingService
				? this.timingService.calculateTickInterval(this.bpm, this.subdivisions)
				: 500;
		},

		get beatsPerMeasure() {
			return this.timingService
				? this.timingService.parseTimeSignature(this.timeSignature).beats
				: 4;
		},

		get showSubdivisions() {
			return this.subdivisionMultiplier > 1;
		},

		get beatDisplayContent() {
			if (this.mode === "remote") {
				return this.isPlaying ? "STOP" : '<div class="play-triangle"></div>';
			}
			if (this.isPlaying) {
				return Math.max(this.beatCount, 0) + 1;
			}
			return '<div class="play-triangle"></div>';
		},

		get connectionStatus() {
			return this.wsConnected ? "Connected" : "Disconnected";
		},

		get qrButtonText() {
			return "Show QR Code";
		},

		// Initialization method (called automatically by Alpine.js)
		// Guard needed because Alpine calls init() twice in some cases
		init() {
			if (this._initialized) return;
			this._initialized = true;
			this.initRoom();
			this.initServices();
			this.initWebSocket();
		},

		initRoom() {
			const params = parseUrlParams();
			this.roomId = params.roomId;
			this.mode = params.mode;

			// Apply mode-specific styling
			if (this.mode === "remote") {
				document.body.classList.add("remote-mode");
			}

			if (!this.roomId) {
				// Generate random room ID and update URL without reloading
				this.roomId = generateRoomId();
				updateUrl(this.roomId, this.mode);
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
			if (this.wsManager) return;
			if (!this.roomId) return; // Guard for TypeScript
			this.wsManager = new WebSocketManager(
				this.roomId,
				(state) => this.updateFromRemote(state),
				(connected) => {
					this.wsConnected = connected;
				},
				() => this.handleNewConnection(),
			);
			this.wsManager.connect();
		},

		/** @param {{ bpm?: number; playing?: boolean; timeSignature?: string; subdivisions?: string }} state */
		updateFromRemote(state) {
			let timingChanged = false;

			// Update BPM - only reset if actually changed
			if (state.bpm !== undefined && state.bpm !== this.bpm) {
				this.bpm = state.bpm;
				timingChanged = true;
			}

			// Update time signature - only reset if actually changed
			if (
				state.timeSignature !== undefined &&
				state.timeSignature !== this.timeSignature
			) {
				this.timeSignature = state.timeSignature;
				this.resetBeatCount(); // Reset counts when time signature changes to sync timing
			}

			// Update subdivisions - only reset if actually changed
			if (
				state.subdivisions !== undefined &&
				state.subdivisions !== this.subdivisions
			) {
				this.subdivisions = state.subdivisions;
				this.subdivisionCount = 0; // Reset subdivision count when subdivisions change to sync timing
				timingChanged = true;
			}

			// If timing-related parameters changed and we're playing, restart timing
			if (timingChanged && this.isPlaying) {
				this.restartWithNewTiming();
				this.resetBeatCount(); // Reset counts to sync timing across devices
			}

			// Update playing state
			if (state.playing !== undefined && state.playing !== this.isPlaying) {
				if (state.playing) {
					this.startMetronome();
				} else {
					this.stopMetronome();
				}
			}
		},

		// Broadcast state to other clients
		broadcastState() {
			if (!this.wsManager) return;
			this.wsManager.broadcast({
				bpm: this.bpm,
				playing: this.isPlaying,
				timeSignature: this.timeSignature,
				subdivisions: this.subdivisions,
			});
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

		resetBeatCount() {
			this.beatCount = -1;
			this.subdivisionCount = 0;
		},

		startMetronome() {
			// Resume audio context if suspended
			if (this.audioService) {
				this.audioService.resumeContext();
			}

			this.isPlaying = true;
			this.resetBeatCount();

			// First beat immediately
			this.tick();
			this.intervalId = setInterval(() => this.tick(), this.tickInterval);
		},

		stopMetronome() {
			this.isPlaying = false;

			if (this.intervalId) {
				clearInterval(this.intervalId);
				this.intervalId = null;
			}

			this.beatActive = false;
		},

		tick() {
			if (!this.timingService) return;
			// Check if this is a main beat (quarter note)
			const isMainBeat = this.timingService.isMainBeat(
				this.subdivisionCount,
				this.subdivisions,
			);

			if (isMainBeat && this.mode !== "remote") {
				// Visual beat flash
				this.visualBeat();
			}

			// Update subdivision display
			if (this.showSubdivisions && this.mode !== "remote") {
				this.currentSubdivision = this.timingService.getCurrentSubdivision(
					this.subdivisionCount,
					this.subdivisions,
				);
			}

			// Advance subdivision count
			this.subdivisionCount++;

			// Advance beat count only on main beats
			if (isMainBeat) {
				this.beatCount = this.timingService.advanceBeatCount(
					this.beatCount,
					this.timeSignature,
				);
			}

			// Play audio (handles remote mode check internally)
			this.playClick(isMainBeat);
		},

		/**
		 * Play click sound
		 * @param {boolean} isMainBeat
		 */
		playClick(isMainBeat) {
			if (!this.audioService || !this.timingService) return;

			const frequency = this.timingService.calculateBeatFrequency(
				this.beatCount,
				isMainBeat,
			);
			this.audioService.playClick(frequency, isMainBeat);
		},

		// Visual beat flash
		visualBeat() {
			if (this.mode === "remote") return;

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

		/** @param {number} newBpm */
		setBpm(newBpm) {
			if (!this.timingService) return;
			this.bpm = this.timingService.validateBpm(newBpm);

			if (this.isPlaying) {
				this.restartWithNewTiming();
				this.resetBeatCount(); // Reset counts when BPM changes to sync timing across devices
			}

			this.broadcastState();
		},

		/**
		 * Adjust BPM by delta
		 * @param {number} delta
		 */
		adjustBpm(delta) {
			this.setBpm(this.bpm + delta);
		},

		/** @param {string} newTimeSignature */
		setTimeSignature(newTimeSignature) {
			this.timeSignature = newTimeSignature;
			this.resetBeatCount();
			this.broadcastState();
		},

		/** @param {string} newSubdivisions */
		setSubdivisions(newSubdivisions) {
			this.subdivisions = newSubdivisions;
			this.subdivisionCount = 0; // Reset subdivision count

			// Update timing if currently playing
			if (this.isPlaying) {
				this.restartWithNewTiming();
			}

			this.broadcastState();
		},

		tapTempo() {
			if (!this.timingService) return;
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
				if (this.lastTapTime && Date.now() - this.lastTapTime >= 3000) {
					this.tapTimes = [];
					this.lastTapTime = null;
				}
			}, 3000);
		},

		// QR Code modal functionality
		async showQrCode() {
			if (!this.wsManager) return;
			const url = this.wsManager.generateShareableUrl(this.mode);
			// Create QR code as canvas
			const canvas = document.createElement('canvas');
			QrCreator.render({
				text: url,
				radius: 0.5,
				ecLevel: 'M',
				fill: '#000000',
				background: '#FFFFFF',
				size: 256
			}, canvas);
			this.qrCodeDataUrl = canvas.toDataURL();
			this.showQrModal = true;
		},

		closeQrModal() {
			this.showQrModal = false;
			this.qrCodeDataUrl = null;
			this.connectionFeedback = false;
		},

		async copyUrlFromModal() {
			if (!this.wsManager) return;
			const url = this.wsManager.generateShareableUrl(this.mode);
			await navigator.clipboard.writeText(url);
			this.copyUrlText = "Copied!";
			setTimeout(() => {
				this.copyUrlText = "Copy URL";
			}, 1000);
		},

		handleNewConnection() {
			if (this.showQrModal) {
				this.connectionFeedback = true;
				// Highlight connection status briefly
				setTimeout(() => {
					this.closeQrModal();
				}, 1500);
			}
			// Highlight connection status when someone joins via QR
			const connectionStatusEl = document.querySelector('.connection-status');
			if (connectionStatusEl) {
				connectionStatusEl.classList.add('new-connection');
				setTimeout(() => {
					connectionStatusEl.classList.remove('new-connection');
				}, 1500);
			}
		},
	};
}

// Make metronome function available globally for Alpine.js after imports load
document.addEventListener("DOMContentLoaded", () => {
	window.metronome = metronome;
});

// Also make it immediately available
window.metronome = metronome;
