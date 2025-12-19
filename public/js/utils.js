/**
 * Utility Functions
 */

/**
 * Generate random room ID
 * From legacy app.js lines 38-39
 */
export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Parse URL parameters
 * From legacy app.js lines 33-35
 */
export function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    roomId: urlParams.get('room'),
    mode: urlParams.get('mode') || 'normal'
  };
}

/**
 * Update URL with new parameters
 */
export function updateUrl(roomId, mode) {
  const url = new URL(window.location);
  url.searchParams.set('room', roomId);
  if (mode !== 'normal') {
    url.searchParams.set('mode', mode);
  } else {
    url.searchParams.delete('mode');
  }
  window.history.replaceState({}, '', url);
}

/**
 * Redirect to URL with room and mode
 */
export function redirectToRoom(roomId, mode = 'normal') {
  const modeParam = mode === 'remote' ? '&mode=remote' : '';
  window.location.href = `${window.location.origin}${window.location.pathname}?room=${roomId}${modeParam}`;
}

/**
 * Debounce function to limit rapid calls
 */
export function debounce(func, wait) {
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
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}