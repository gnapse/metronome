/**
 * Audio Service - Web Audio API synthesis
 * Extracted from legacy app.js lines 78-84, 378-404
 */

export class AudioService {
  constructor() {
    this.audioContext = null;
    this.mode = 'normal';
  }

  /**
   * Initialize audio context (from legacy app.js lines 80-84)
   * Only creates context in normal mode, not remote mode
   */
  init(mode = 'normal') {
    this.mode = mode;

    if (mode !== 'remote') {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        console.warn('AudioContext not available:', error);
        this.audioContext = null;
      }
    }
  }

  /**
   * Play metronome click sound
   * Exact logic from legacy app.js lines 378-404
   * @param {number} frequency - Frequency in Hz
   * @param {boolean} isMainBeat - Whether this is a main beat (affects volume)
   */
  playClick(frequency, isMainBeat = true) {
    // Skip audio in remote mode or if no audio context
    if (this.mode === 'remote' || !this.audioContext) {
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Set frequency
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Set volume based on beat type
      if (isMainBeat) {
        // Main beats: Higher volume
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      } else {
        // Subdivisions: Lower volume
        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      }

      // Exponential decay over 100ms
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

      // Play the sound for 100ms
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.1);

    } catch (error) {
      console.warn('Audio playback error:', error);
    }
  }

  /**
   * Resume audio context if suspended (required for user interaction)
   */
  async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  /**
   * Check if audio is available and ready
   */
  isAvailable() {
    return this.audioContext && this.audioContext.state !== 'closed';
  }

  /**
   * Get current audio context state
   */
  getState() {
    if (!this.audioContext) return 'unavailable';
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
        console.warn('Error closing audio context:', error);
      }
      this.audioContext = null;
    }
  }
}