/**
 * F-011: Heartbeat Manager Utility
 *
 * Provides reusable heartbeat functionality for long-running tasks.
 * Supports threshold-based activation and clean stop/cleanup.
 */

/**
 * @typedef {Object} HeartbeatOptions
 * @property {Function} callback - Function to call on each heartbeat
 * @property {number} intervalMs - Interval between heartbeats in milliseconds
 * @property {number} thresholdMs - Minimum time before first heartbeat
 */

/**
 * @typedef {Object} HeartbeatInfo
 * @property {number} elapsedMs - Elapsed time since start in milliseconds
 */

/**
 * Start a heartbeat timer.
 * @param {HeartbeatOptions} options
 * @returns {Function} Stop function to clear the heartbeat
 */
export function startHeartbeat({ callback, intervalMs, thresholdMs = 0 }) {
  const startedAt = Date.now();
  let thresholdTimer = null;
  let intervalTimer = null;
  let stopped = false;

  const clearAll = () => {
    if (thresholdTimer) {
      clearTimeout(thresholdTimer);
      thresholdTimer = null;
    }
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  };

  const triggerCallback = () => {
    if (stopped) return;
    const elapsedMs = Date.now() - startedAt;
    callback({ elapsedMs });
  };

  const startInterval = () => {
    if (stopped) return;
    // Trigger first heartbeat after threshold
    triggerCallback();
    // Then start interval
    intervalTimer = setInterval(() => {
      if (stopped) {
        clearAll();
        return;
      }
      triggerCallback();
    }, intervalMs);
  };

  // If threshold is 0, start immediately
  if (thresholdMs <= 0) {
    startInterval();
  } else {
    // Wait for threshold before starting
    thresholdTimer = setTimeout(startInterval, thresholdMs);
  }

  // Return stop function
  return () => {
    stopped = true;
    clearAll();
  };
}

/**
 * Create a heartbeat manager with start/stop lifecycle.
 * @returns {{ start: Function, stop: Function, isRunning: Function }}
 */
export function createHeartbeatManager() {
  let stopFn = null;

  return {
    /**
     * Start heartbeat with given options.
     * @param {HeartbeatOptions} options
     */
    start(options) {
      // Stop any existing heartbeat
      this.stop();
      stopFn = startHeartbeat(options);
    },

    /**
     * Stop the current heartbeat.
     */
    stop() {
      if (stopFn) {
        stopFn();
        stopFn = null;
      }
    },

    /**
     * Check if heartbeat is currently running.
     * @returns {boolean}
     */
    isRunning() {
      return stopFn !== null;
    }
  };
}
