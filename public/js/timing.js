/**
 * Timing Service - Pure timing calculation functions
 */

export const TimingService = {
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

	calculateTickInterval(bpm, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return 60000 / bpm / multiplier;
	},

	/**
	 * Parse time signature into beats and note value
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
	 */
	isMainBeat(subdivisionCount, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return subdivisionCount % multiplier === 0;
	},

	/**
	 * Calculate current subdivision within a beat
	 */
	getCurrentSubdivision(subdivisionCount, subdivisions) {
		const multiplier = this.getSubdivisionMultiplier(subdivisions);
		return subdivisionCount % multiplier;
	},

	/**
	 * Advance beat count with proper wrapping
	 */
	advanceBeatCount(currentBeatCount, timeSignature) {
		const { beats } = this.parseTimeSignature(timeSignature);
		return (currentBeatCount + 1) % beats;
	},

	/**
	 * Validate BPM within reasonable bounds
	 */
	validateBpm(bpm) {
		const numericBpm = parseInt(bpm, 10);
		return Math.max(40, Math.min(220, numericBpm));
	},

	/**
	 * Calculate tap tempo BPM from array of tap intervals
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
