/**
 * Timing Service - Pure timing calculation functions
 */

export const TimingService = {
	/**
	 * @param {string} subdivisions
	 * @returns {1 | 2 | 3 | 4}
	 */
	getSubdivisionMultiplier(subdivisions) {
		switch (subdivisions) {
			case "quarter":
				return 1;
			case "eighth":
				return 2;
			case "triplets":
				return 3;
			case "sixteenth":
				return 4;
			default:
				return 1;
		}
	},

	/**
	 * @param {number} bpm
	 * @param {string} subdivisions
	 * @returns {number}
	 */
	calculateTickInterval(bpm, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return 60000 / bpm / multiplier;
	},

	/**
	 * Parse time signature into beats and note value
	 * @param {string} timeSignature
	 * @returns {{ beats: number; noteValue: number }}
	 */
	parseTimeSignature(timeSignature) {
		const [beats, noteValue] = timeSignature.split("/").map(Number);
		return { beats, noteValue };
	},

	/**
	 * Calculate audio frequency for beats
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
	 * @param {number} subdivisionCount
	 * @param {string} subdivisions
	 * @returns {boolean}
	 */
	isMainBeat(subdivisionCount, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return subdivisionCount % multiplier === 0;
	},

	/**
	 * Calculate current subdivision within a beat
	 * @param {number} subdivisionCount
	 * @param {string} subdivisions
	 * @returns {number}
	 */
	getCurrentSubdivision(subdivisionCount, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return subdivisionCount % multiplier;
	},

	/**
	 * Advance beat count with proper wrapping
	 * @param {number} currentBeatCount
	 * @param {string} timeSignature
	 * @returns {number}
	 */
	advanceBeatCount(currentBeatCount, timeSignature) {
		const { beats } = this.parseTimeSignature(timeSignature);
		return (currentBeatCount + 1) % beats;
	},

	/**
	 * Validate BPM within reasonable bounds
	 * @param {number} bpm
	 * @returns {number}
	 */
	validateBpm(bpm) {
		const numericBpm = typeof bpm === 'string' ? parseInt(bpm, 10) : Math.round(bpm);
		return Math.max(40, Math.min(220, numericBpm));
	},

	/**
	 * Calculate tap tempo BPM from array of tap intervals
	 * @param {number[]} tapTimes
	 * @returns {number | null}
	 */
	calculateTapTempoBpm(tapTimes) {
		if (tapTimes.length < 1) return null;

		// tapTimes already contains intervals, use them directly
		const avgInterval =
			tapTimes.reduce((sum, interval) => sum + interval, 0) / tapTimes.length;

		// Convert to BPM (60000ms = 1 minute)
		const bpm = 60000 / avgInterval;

		// Return validated BPM
		return this.validateBpm(bpm);
	},
};
