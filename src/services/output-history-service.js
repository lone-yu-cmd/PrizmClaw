/**
 * Output History Service
 * F-020: Enhanced Terminal Output Streaming
 *
 * In-memory ring buffer that tracks per-session AI CLI command output history.
 * Allows users to retrieve recent command outputs via the /output command.
 *
 * Each entry: { prompt, output, timestamp, index }
 */

const DEFAULT_MAX_ENTRIES = 10;

/**
 * Create an output history service instance.
 *
 * @param {number} [maxEntries=10] - Maximum entries to retain per session (ring buffer size)
 * @returns {OutputHistoryService}
 */
export function createOutputHistoryService(maxEntries = DEFAULT_MAX_ENTRIES) {
  /** @type {Map<string, Array<{prompt: string, output: string, timestamp: number, index: number}>>} */
  const store = new Map();
  // Global monotonic counter for entry indices (unique within service lifetime)
  let counter = 0;

  return {
    /**
     * Add a command output entry to the session history.
     * If the ring buffer is full, the oldest entry is evicted.
     *
     * @param {string} sessionKey - Session identifier (e.g. 'telegram:123456')
     * @param {string} prompt - The user prompt / command that triggered the output
     * @param {string} output - Full command output text
     */
    addOutput(sessionKey, prompt, output) {
      if (!store.has(sessionKey)) {
        store.set(sessionKey, []);
      }
      const entries = store.get(sessionKey);

      const entry = {
        prompt: String(prompt ?? ''),
        output: String(output ?? ''),
        timestamp: Date.now(),
        index: counter++
      };

      entries.push(entry);

      // Enforce ring buffer limit — evict oldest entries
      while (entries.length > maxEntries) {
        entries.shift();
      }
    },

    /**
     * Retrieve the most recent N command output entries for a session.
     * Returns entries in chronological order (oldest first).
     *
     * @param {string} sessionKey - Session identifier
     * @param {number} count - Number of recent entries to retrieve
     * @returns {Array<{prompt: string, output: string, timestamp: number, index: number}>}
     */
    getHistory(sessionKey, count) {
      if (!count || count <= 0) return [];
      const entries = store.get(sessionKey);
      if (!entries || entries.length === 0) return [];
      // Return last `count` entries in chronological order (oldest first)
      return entries.slice(-count);
    },

    /**
     * Clear all stored history for a session.
     *
     * @param {string} sessionKey - Session identifier
     */
    clearHistory(sessionKey) {
      store.delete(sessionKey);
    }
  };
}
