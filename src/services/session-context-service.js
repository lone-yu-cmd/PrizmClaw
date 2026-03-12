/**
 * Session Context Service
 * F-013: Session and Context Manager
 *
 * Manages session lifecycle, persistence, and timeout handling.
 * Coordinates with sessionStore for in-memory session state.
 */

import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { sessionStore } from './session-store.js';

/**
 * @typedef {Object} SessionContextService
 * @property {Function} initSessionContext - Initialize with data directory
 * @property {Function} createSession - Create new session
 * @property {Function} getOrCreateSession - Get existing or create new
 * @property {Function} touchSession - Update activity timestamp
 * @property {Function} cleanupSession - Clear session data
 * @property {Function} persistSession - Save to disk
 * @property {Function} restoreSessions - Load from disk on startup
 * @property {Function} startTimeoutWatcher - Start interval to check timeouts
 * @property {Function} stopTimeoutWatcher - Stop interval on shutdown
 * @property {Function} setNotificationCallback - Set callback for timeout notifications
 * @property {Function} isWatcherRunning - Check if watcher is active
 */

class SessionContextServiceClass {
  #dataDir = null;
  #notificationCallback = null;
  #timeoutWatcherId = null;
  #isInitialized = false;
  #timeoutMs = null;
  #checkIntervalMs = null;

  /**
   * Reset the service state (for testing).
   */
  reset() {
    this.#dataDir = null;
    this.#notificationCallback = null;
    if (this.#timeoutWatcherId) {
      clearInterval(this.#timeoutWatcherId);
      this.#timeoutWatcherId = null;
    }
    this.#isInitialized = false;
    this.#timeoutMs = null;
    this.#checkIntervalMs = null;
  }

  /**
   * Check if service is initialized.
   * @returns {boolean}
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Initialize the session context service.
   * @param {Object} options - Initialization options
   * @param {string} options.dataDir - Directory for session persistence
   * @param {number} [options.timeoutMs] - Session timeout in ms (default: from config)
   * @param {number} [options.checkIntervalMs] - Timeout check interval in ms (default: 60000)
   */
  initSessionContext({ dataDir, timeoutMs, checkIntervalMs }) {
    this.#dataDir = dataDir;
    this.#timeoutMs = timeoutMs || config.sessionTimeoutMs;
    this.#checkIntervalMs = checkIntervalMs || 60000;
    this.#isInitialized = true;
  }

  /**
   * Check if service is initialized.
   * @throws {Error} If not initialized
   */
  #checkInitialized() {
    if (!this.#isInitialized) {
      throw new Error('SessionContextService not initialized. Call initSessionContext first.');
    }
  }

  /**
   * Ensure data directory exists.
   */
  async #ensureDataDir() {
    if (this.#dataDir) {
      await mkdir(this.#dataDir, { recursive: true });
    }
  }

  /**
   * Create a new session.
   * @param {string} sessionKey - Session identifier
   * @param {string} userId - Telegram user ID
   * @returns {Object} Created session info
   */
  createSession(sessionKey, userId) {
    this.#checkInitialized();

    // Create in sessionStore - touchSession will set createdAt if new
    sessionStore.touchSession(sessionKey, userId);
    sessionStore.setUserId(sessionKey, userId);

    return sessionStore.getSessionInfo(sessionKey);
  }

  /**
   * Get existing session or create new one.
   * @param {string} sessionKey - Session identifier
   * @param {string} userId - Telegram user ID
   * @returns {Object} Session info
   */
  getOrCreateSession(sessionKey, userId) {
    this.#checkInitialized();

    const existing = sessionStore.getSessionInfo(sessionKey);
    if (existing) {
      // Update userId if different
      if (existing.userId !== userId) {
        sessionStore.setUserId(sessionKey, userId);
      }
      // Return fresh info from sessionStore
      return sessionStore.getSessionInfo(sessionKey);
    }

    return this.createSession(sessionKey, userId);
  }

  /**
   * Update session activity timestamp.
   * @param {string} sessionKey - Session identifier
   */
  touchSession(sessionKey) {
    this.#checkInitialized();

    // sessionStore.touchSession will set createdAt if new
    const userId = sessionStore.getUserId(sessionKey) || undefined;
    sessionStore.touchSession(sessionKey, userId);
  }

  /**
   * Cleanup a session - clear from memory and delete persisted file.
   * @param {string} sessionKey - Session identifier
   */
  cleanupSession(sessionKey) {
    this.#checkInitialized();

    // Get userId before clearing for notification
    const userId = sessionStore.getUserId(sessionKey);

    // Clear from sessionStore
    sessionStore.clear(sessionKey);

    // Delete persisted file (async, fire-and-forget)
    this.#deleteSessionFile(sessionKey);

    // Notify if callback set
    if (this.#notificationCallback && userId) {
      this.#notificationCallback(sessionKey, userId);
    }
  }

  /**
   * Delete session file from disk.
   * @param {string} sessionKey - Session identifier
   */
  async #deleteSessionFile(sessionKey) {
    const filePath = this.#getSessionFilePath(sessionKey);
    try {
      await unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Set notification callback for session cleanup.
   * @param {Function} callback - Function(sessionKey, userId)
   */
  setNotificationCallback(callback) {
    this.#notificationCallback = callback;
  }

  /**
   * Get file path for a session file.
   * @param {string} sessionKey - Session identifier
   * @returns {string} File path
   */
  #getSessionFilePath(sessionKey) {
    // Replace colons with underscores for filesystem compatibility
    const safeFileName = sessionKey.replace(/:/g, '_');
    return join(this.#dataDir, `${safeFileName}.json`);
  }

  /**
   * Persist a session to disk.
   * @param {string} sessionKey - Session identifier
   */
  async persistSession(sessionKey) {
    this.#checkInitialized();
    await this.#ensureDataDir();

    const info = sessionStore.getSessionInfo(sessionKey);
    if (!info) {
      throw new Error(`Session ${sessionKey} not found`);
    }

    const data = {
      sessionKey: info.sessionKey,
      userId: info.userId,
      cwd: sessionStore.getCwd(sessionKey),
      envOverrides: sessionStore.getEnvOverrides(sessionKey),
      commandHistory: sessionStore.getCommandHistory(sessionKey),
      createdAt: info.createdAt,
      lastActivityAt: info.lastActivityAt
    };

    const filePath = this.#getSessionFilePath(sessionKey);
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Restore sessions from disk.
   */
  async restoreSessions() {
    this.#checkInitialized();

    try {
      const files = await readdir(this.#dataDir);
      const sessionFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const filePath = join(this.#dataDir, file);
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // Check if session has expired
          const idleTime = Date.now() - (data.lastActivityAt || 0);
          const timeoutMs = this.#timeoutMs;

          if (idleTime > timeoutMs) {
            // Session expired, delete file
            await unlink(filePath);
            continue;
          }

          // Restore to sessionStore
          const { sessionKey, userId, cwd, envOverrides } = data;

          // Set userId and timestamps
          sessionStore.touchSession(sessionKey, userId);

          // Restore cwd
          if (cwd) {
            sessionStore.setCwd(sessionKey, cwd);
          }

          // Restore env overrides
          for (const [key, value] of Object.entries(envOverrides || {})) {
            sessionStore.setEnvOverride(sessionKey, key, value);
          }

          // Note: commandHistory is stored in the file but we don't restore it
          // to sessionStore because it's mainly for historical reference.

        } catch (error) {
          // Log error but continue with other files
          console.error(`Failed to restore session from ${file}:`, error.message);
        }
      }
    } catch (error) {
      // Directory might not exist yet
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Start the timeout watcher.
   */
  startTimeoutWatcher() {
    if (this.#timeoutWatcherId) {
      // Already running
      return;
    }

    this.#timeoutWatcherId = setInterval(() => {
      this.#checkTimeouts();
    }, this.#checkIntervalMs);

    // Prevent the interval from keeping the process alive
    this.#timeoutWatcherId.unref?.();
  }

  /**
   * Check all sessions for timeout.
   */
  #checkTimeouts() {
    const sessionKeys = sessionStore.getAllSessionKeys();

    for (const sessionKey of sessionKeys) {
      const idleTime = sessionStore.getIdleTime(sessionKey);

      if (idleTime !== null && idleTime > this.#timeoutMs) {
        // Session expired
        this.cleanupSession(sessionKey);
      }
    }
  }

  /**
   * Stop the timeout watcher.
   */
  stopTimeoutWatcher() {
    if (this.#timeoutWatcherId) {
      clearInterval(this.#timeoutWatcherId);
      this.#timeoutWatcherId = null;
    }
  }

  /**
   * Check if the timeout watcher is running.
   * @returns {boolean}
   */
  isWatcherRunning() {
    return this.#timeoutWatcherId !== null;
  }
}

export const sessionContextService = new SessionContextServiceClass();
