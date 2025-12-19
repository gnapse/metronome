/**
 * Utility Functions
 */

/**
 * Generate random room ID
 */
export function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

/**
 * Parse URL parameters
 */
export function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        roomId: urlParams.get("room"),
        mode: urlParams.get("mode") || "normal",
    };
}

/**
 * Update URL with new parameters
 * @param {string} roomId
 * @param {string} mode
 */
export function updateUrl(roomId, mode) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    if (mode !== "normal") {
        url.searchParams.set("mode", mode);
    } else {
        url.searchParams.delete("mode");
    }
    window.history.replaceState({}, "", url);
}

/**
 * Redirect to URL with room and mode
 * @param {string} roomId
 * @param {string} [mode]
 */
export function redirectToRoom(roomId, mode = "normal") {
    const modeParam = mode === "remote" ? "&mode=remote" : "";
    window.location.replace(
        `${window.location.origin}${window.location.pathname}?room=${roomId}${modeParam}`
    );
}

/**
 * Debounce function to limit rapid calls
 * @template {(...args: any[]) => void} T
 * @param {T} func
 * @param {number} wait
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(func, wait) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Clamp value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
