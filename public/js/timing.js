/**
 * Timing Service - Pure timing calculation functions
 * Extracted from legacy app.js lines 229-242, 348-376
 */

export const TimingService = {
  /**
   * Get subdivision multiplier from legacy app.js lines 229-237
   */
  getSubdivisionMultiplier(subdivisions) {
    switch (subdivisions) {
      case 'quarter': return 1;
      case 'eighth': return 2;
      case 'triplets': return 3;
      case 'sixteenth': return 4;
      default: return 1;
    }
  },

  /**
   * Calculate tick interval in milliseconds from legacy app.js lines 239-242
   */
  calculateTickInterval(bpm, subdivisions) {
    const multiplier = this.getSubdivisionMultiplier(subdivisions);
    return (60000 / bpm) / multiplier;
  },

  /**
   * Parse time signature into beats and note value
   */
  parseTimeSignature(timeSignature) {
    const [beats, noteValue] = timeSignature.split('/').map(Number);
    return { beats, noteValue };
  },

  /**
   * Calculate audio frequency for beats from legacy app.js lines 389-397
   * @param {number} beatCount - Current beat (0-based)
   * @param {boolean} isMainBeat - Whether this is a main beat or subdivision
   * @returns {number} Frequency in Hz
   */
  calculateBeatFrequency(beatCount, isMainBeat) {
    if (!isMainBeat) {
      // Subdivisions: Lower pitch
      return 600;
    }

    // Main beats: First beat of measure is higher pitch
    return beatCount === 0 ? 1000 : 800;
  },

  /**
   * Determine if current subdivision count represents a main beat
   * From legacy app.js line 353
   */
  isMainBeat(subdivisionCount, subdivisions) {
    const multiplier = this.getSubdivisionMultiplier(subdivisions);
    return subdivisionCount % multiplier === 0;
  },

  /**
   * Calculate current subdivision within a beat
   * From legacy app.js lines 327-328
   */
  getCurrentSubdivision(subdivisionCount, subdivisions) {
    const multiplier = this.getSubdivisionMultiplier(subdivisions);
    return subdivisionCount % multiplier;
  },

  /**
   * Advance beat count with proper wrapping
   * From legacy app.js line 374
   */
  advanceBeatCount(currentBeatCount, timeSignature) {
    const { beats } = this.parseTimeSignature(timeSignature);
    return (currentBeatCount + 1) % beats;
  },

  /**
   * Validate BPM within reasonable bounds
   */
  validateBpm(bpm) {
    const numericBpm = parseInt(bpm);
    return Math.max(40, Math.min(220, numericBpm));
  },

  /**
   * Calculate tap tempo BPM from array of tap intervals
   * From legacy app.js tap tempo logic
   */
  calculateTapTempoBpm(tapTimes) {
    if (tapTimes.length < 2) return null;

    // Calculate intervals between taps
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Convert to BPM (60000ms = 1 minute)
    const bpm = 60000 / avgInterval;

    // Return validated BPM
    return this.validateBpm(bpm);
  }
};