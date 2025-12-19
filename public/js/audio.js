/**
 * Audio Service - Web Audio API synthesis
 */

export class AudioService {
    constructor() {
        /** @type {AudioContext | null} */
        this.audioContext = null;
        /** @type {string} */
        this.mode = "normal";
    }

    /**
     * Only creates context in normal mode, not remote mode
     * @param {string} [mode]
     */
    init(mode = "normal") {
        this.mode = mode;

        if (mode !== "remote") {
            try {
                this.audioContext = new (window.AudioContext ||
                    window.webkitAudioContext)();
            } catch (error) {
                console.warn("AudioContext not available:", error);
                this.audioContext = null;
            }
        }
    }

    /**
     * Play metronome click sound
     * @param {number} frequency - Frequency in Hz
     * @param {boolean} isMainBeat - Whether this is a main beat (affects volume)
     */
    playClick(frequency, isMainBeat = true) {
        // Skip audio in remote mode or if no audio context
        if (this.mode === "remote" || !this.audioContext) {
            return;
        }

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Set frequency
            oscillator.frequency.value = frequency;
            oscillator.type = "sine";

            // Set volume based on beat type
            if (isMainBeat) {
                // Main beats: Higher volume
                gainNode.gain.setValueAtTime(
                    0.3,
                    this.audioContext.currentTime
                );
            } else {
                // Subdivisions: Lower volume
                gainNode.gain.setValueAtTime(
                    0.15,
                    this.audioContext.currentTime
                );
            }

            // Exponential decay over 100ms
            gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                this.audioContext.currentTime + 0.1
            );

            // Play the sound for 100ms
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn("Audio playback error:", error);
        }
    }

    /**
     * Resume audio context if suspended (required for user interaction)
     * @returns {Promise<void>}
     */
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === "suspended") {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn("Failed to resume audio context:", error);
            }
        }
    }

    /**
     * Check if audio is available and ready
     * @returns {boolean}
     */
    isAvailable() {
        return !!(this.audioContext && this.audioContext.state !== "closed");
    }

    /**
     * Get current audio context state
     * @returns {string}
     */
    getState() {
        if (!this.audioContext) return "unavailable";
        return this.audioContext.state;
    }

    /**
     * Cleanup audio context
     */
    destroy() {
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (error) {
                console.warn("Error closing audio context:", error);
            }
            this.audioContext = null;
        }
    }
}
