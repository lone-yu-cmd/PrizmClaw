import { config } from '../config.js';

class SessionStore {
  #messagesBySessionKey = new Map();
  #commitsBySessionKey = new Map();
  // F-009: Command executor extensions
  #cwdBySessionKey = new Map();
  #outputPagesBySessionKey = new Map();
  // F-010: File search results state for pagination
  #searchResultsBySessionKey = new Map();
  // F-011: AI CLI process tracking
  #activeProcessBySessionKey = new Map();
  // F-013: Session and Context Manager
  #commandHistoryBySessionKey = new Map();
  #envOverridesBySessionKey = new Map();
  #lastActivityBySessionKey = new Map();
  #userIdBySessionKey = new Map();
  #sessionCreatedAtBySessionKey = new Map();
  // F-015: AI CLI Backend Switcher
  #currentBackendBySessionKey = new Map();

  get(sessionKey) {
    if (!this.#messagesBySessionKey.has(sessionKey)) {
      this.#messagesBySessionKey.set(sessionKey, []);
    }
    return this.#messagesBySessionKey.get(sessionKey);
  }

  append(sessionKey, role, content) {
    const messages = this.get(sessionKey);
    messages.push({ role, content });

    const maxMessages = config.maxHistoryTurns * 2;
    if (messages.length > maxMessages) {
      messages.splice(0, messages.length - maxMessages);
    }
  }

  clear(sessionKey) {
    this.#messagesBySessionKey.delete(sessionKey);
    this.#commitsBySessionKey.delete(sessionKey);
    // F-009: Clear cwd and output pages
    this.#cwdBySessionKey.delete(sessionKey);
    this.#outputPagesBySessionKey.delete(sessionKey);
    // F-010: Clear search results
    this.#searchResultsBySessionKey.delete(sessionKey);
    // F-011: Clear active process
    this.#activeProcessBySessionKey.delete(sessionKey);
    // F-013: Clear session context data
    this.#commandHistoryBySessionKey.delete(sessionKey);
    this.#envOverridesBySessionKey.delete(sessionKey);
    this.#lastActivityBySessionKey.delete(sessionKey);
    this.#userIdBySessionKey.delete(sessionKey);
    this.#sessionCreatedAtBySessionKey.delete(sessionKey);
    // F-015: Clear backend selection
    this.#currentBackendBySessionKey.delete(sessionKey);
  }

  toPrompt(sessionKey, channel = 'unknown') {
    const messages = this.get(sessionKey);

    return [
      `你正在通过 ${channel} 渠道提供电脑助手服务。`,
      '请使用自然、简洁、可执行的表达。',
      '如果用户请求系统操作或截图，明确说明步骤与结果。',
      '当你产出本地文件（截图/文档）时，必须额外输出独立行：SEND_FILE:<绝对路径>。',
      '禁止仅输出 @image:xxx 或相对路径；路径必须是绝对路径（例如 /var/folders/... 或 /home/...）。',
      '以下是最近对话上下文：',
      ...messages.map((msg) => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`),
      '请继续回答最后一条用户消息。'
    ].join('\n');
  }

  /**
   * Add a commit record to a session.
   * @param {string} sessionKey - Session identifier
   * @param {Object} commitInfo - Commit information
   */
  addCommit(sessionKey, commitInfo) {
    if (!this.#commitsBySessionKey.has(sessionKey)) {
      this.#commitsBySessionKey.set(sessionKey, []);
    }
    const commits = this.#commitsBySessionKey.get(sessionKey);
    commits.push({
      ...commitInfo,
      timestamp: commitInfo.timestamp || Date.now()
    });
  }

  /**
   * Get commits for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {Object[]} Array of commit records
   */
  getCommits(sessionKey) {
    return this.#commitsBySessionKey.get(sessionKey) || [];
  }

  /**
   * Get the last commit for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {Object|null} Last commit record or null
   */
  getLastCommit(sessionKey) {
    const commits = this.getCommits(sessionKey);
    return commits.length > 0 ? commits[commits.length - 1] : null;
  }

  // F-009: Command executor methods

  /**
   * Get current working directory for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {string|null} Current working directory or null
   */
  getCwd(sessionKey) {
    return this.#cwdBySessionKey.get(sessionKey) || null;
  }

  /**
   * Set current working directory for a session.
   * @param {string} sessionKey - Session identifier
   * @param {string} cwd - Working directory path
   */
  setCwd(sessionKey, cwd) {
    this.#cwdBySessionKey.set(sessionKey, cwd);
  }

  /**
   * Get output pages for a session (for /more pagination).
   * @param {string} sessionKey - Session identifier
   * @returns {string[]|null} Array of output pages or null
   */
  getOutputPages(sessionKey) {
    return this.#outputPagesBySessionKey.get(sessionKey) || null;
  }

  /**
   * Set output pages for a session.
   * @param {string} sessionKey - Session identifier
   * @param {string[]} pages - Array of output page strings
   */
  setOutputPages(sessionKey, pages) {
    this.#outputPagesBySessionKey.set(sessionKey, pages);
  }

  /**
   * Clear output pages for a session.
   * @param {string} sessionKey - Session identifier
   */
  clearOutputPages(sessionKey) {
    this.#outputPagesBySessionKey.delete(sessionKey);
  }

  // F-010: File search results methods

  /**
   * Get search results for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {Object[]|null} Array of search results or null
   */
  getSearchResults(sessionKey) {
    return this.#searchResultsBySessionKey.get(sessionKey) || null;
  }

  /**
   * Set search results for a session.
   * @param {string} sessionKey - Session identifier
   * @param {Object[]} results - Array of search result objects
   */
  setSearchResults(sessionKey, results) {
    this.#searchResultsBySessionKey.set(sessionKey, results);
  }

  /**
   * Clear search results for a session.
   * @param {string} sessionKey - Session identifier
   */
  clearSearchResults(sessionKey) {
    this.#searchResultsBySessionKey.delete(sessionKey);
  }

  // F-011: AI CLI process tracking methods

  /**
   * Get active AI CLI process info.
   * @param {string} sessionKey - Session identifier
   * @returns {{ pid: number, startedAt: number, stdoutBytes?: number, childProcess: Object, interrupted?: boolean, timedOut?: boolean, userId?: string } | null}
   */
  getActiveProcess(sessionKey) {
    return this.#activeProcessBySessionKey.get(sessionKey) || null;
  }

  /**
   * Set active AI CLI process.
   * @param {string} sessionKey - Session identifier
   * @param {{ pid: number, startedAt: number, childProcess: Object, stdoutBytes?: number, userId?: string, interrupted?: boolean, timedOut?: boolean }} info
   */
  setActiveProcess(sessionKey, info) {
    this.#activeProcessBySessionKey.set(sessionKey, {
      ...info,
      stdoutBytes: info.stdoutBytes ?? 0
    });
  }

  /**
   * Update stdout bytes for active process.
   * @param {string} sessionKey - Session identifier
   * @param {number} bytes - Additional bytes received
   */
  updateProcessBytes(sessionKey, bytes) {
    const info = this.#activeProcessBySessionKey.get(sessionKey);
    if (info) {
      info.stdoutBytes = (info.stdoutBytes ?? 0) + bytes;
    }
  }

  /**
   * Clear active process.
   * @param {string} sessionKey - Session identifier
   */
  clearActiveProcess(sessionKey) {
    this.#activeProcessBySessionKey.delete(sessionKey);
  }

  // F-013: Session and Context Manager methods

  /**
   * Record a command execution in history.
   * @param {string} sessionKey - Session identifier
   * @param {string} command - Command that was executed
   * @param {number} exitCode - Exit code of the command
   */
  recordCommand(sessionKey, command, exitCode) {
    if (!this.#commandHistoryBySessionKey.has(sessionKey)) {
      this.#commandHistoryBySessionKey.set(sessionKey, []);
    }
    const history = this.#commandHistoryBySessionKey.get(sessionKey);
    history.push({
      command,
      exitCode,
      timestamp: Date.now()
    });

    // Trim to max history size
    const maxHistory = config.sessionHistoryMax;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Get command history for a session.
   * @param {string} sessionKey - Session identifier
   * @param {number} [limit] - Maximum number of entries to return
   * @returns {Object[]} Array of { command, exitCode, timestamp }
   */
  getCommandHistory(sessionKey, limit) {
    const history = this.#commandHistoryBySessionKey.get(sessionKey) || [];
    if (limit !== undefined && limit > 0) {
      const start = Math.max(0, history.length - limit);
      return history.slice(start);
    }
    return [...history];
  }

  /**
   * Set an environment variable override for a session.
   * @param {string} sessionKey - Session identifier
   * @param {string} key - Environment variable name
   * @param {string} value - Environment variable value
   */
  setEnvOverride(sessionKey, key, value) {
    if (!this.#envOverridesBySessionKey.has(sessionKey)) {
      this.#envOverridesBySessionKey.set(sessionKey, {});
    }
    this.#envOverridesBySessionKey.get(sessionKey)[key] = value;
  }

  /**
   * Get all environment variable overrides for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {Object} Environment variable key-value pairs
   */
  getEnvOverrides(sessionKey) {
    return { ...this.#envOverridesBySessionKey.get(sessionKey) } || {};
  }

  /**
   * Update session activity timestamp and user ID.
   * @param {string} sessionKey - Session identifier
   * @param {string} userId - Telegram user ID
   */
  touchSession(sessionKey, userId) {
    const now = Date.now();
    this.#lastActivityBySessionKey.set(sessionKey, now);
    if (userId !== undefined) {
      this.#userIdBySessionKey.set(sessionKey, userId);
    }
    // Set creation time if this is a new session
    if (!this.#sessionCreatedAtBySessionKey.has(sessionKey)) {
      this.#sessionCreatedAtBySessionKey.set(sessionKey, now);
    }
  }

  /**
   * Get last activity timestamp for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {number|null} Timestamp or null if not set
   */
  getLastActivity(sessionKey) {
    return this.#lastActivityBySessionKey.get(sessionKey) || null;
  }

  /**
   * Get comprehensive session information.
   * @param {string} sessionKey - Session identifier
   * @returns {Object|null} Session info object or null if not found
   */
  getSessionInfo(sessionKey) {
    const userId = this.#userIdBySessionKey.get(sessionKey);
    const createdAt = this.#sessionCreatedAtBySessionKey.get(sessionKey);
    const lastActivityAt = this.#lastActivityBySessionKey.get(sessionKey);

    // Return null if session has no tracking data
    if (!createdAt && !lastActivityAt) {
      return null;
    }

    return {
      sessionKey,
      userId: userId || null,
      cwd: this.#cwdBySessionKey.get(sessionKey) || null,
      envOverrides: { ...this.#envOverridesBySessionKey.get(sessionKey) } || {},
      commandCount: (this.#commandHistoryBySessionKey.get(sessionKey) || []).length,
      createdAt: createdAt || null,
      lastActivityAt: lastActivityAt || null,
      // F-015: Add backend information
      currentBackend: this.#currentBackendBySessionKey.get(sessionKey) || null
    };
  }

  /**
   * Get all active session keys.
   * @returns {string[]} Array of session keys
   */
  getAllSessionKeys() {
    // Return keys from sessions that have activity tracking
    return Array.from(this.#lastActivityBySessionKey.keys());
  }

  /**
   * Get the age of a session in milliseconds.
   * @param {string} sessionKey - Session identifier
   * @returns {number|null} Age in ms or null if not found
   */
  getSessionAge(sessionKey) {
    const createdAt = this.#sessionCreatedAtBySessionKey.get(sessionKey);
    if (!createdAt) {
      return null;
    }
    return Date.now() - createdAt;
  }

  /**
   * Get idle time for a session in milliseconds.
   * @param {string} sessionKey - Session identifier
   * @returns {number|null} Idle time in ms or null if not found
   */
  getIdleTime(sessionKey) {
    const lastActivity = this.#lastActivityBySessionKey.get(sessionKey);
    if (!lastActivity) {
      return null;
    }
    return Date.now() - lastActivity;
  }

  /**
   * Set user ID for a session.
   * @param {string} sessionKey - Session identifier
   * @param {string} userId - Telegram user ID
   */
  setUserId(sessionKey, userId) {
    this.#userIdBySessionKey.set(sessionKey, userId);
  }

  /**
   * Get user ID for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {string|null} User ID or null if not set
   */
  getUserId(sessionKey) {
    return this.#userIdBySessionKey.get(sessionKey) || null;
  }

  // F-015: AI CLI Backend Switcher methods

  /**
   * Get current backend for a session.
   * @param {string} sessionKey - Session identifier
   * @returns {string|null} Backend name or null if not set
   */
  getCurrentBackend(sessionKey) {
    return this.#currentBackendBySessionKey.get(sessionKey) || null;
  }

  /**
   * Set current backend for a session.
   * @param {string} sessionKey - Session identifier
   * @param {string} backendName - Backend name to set
   */
  setCurrentBackend(sessionKey, backendName) {
    this.#currentBackendBySessionKey.set(sessionKey, backendName);
  }

  /**
   * Reset backend to default for a session.
   * @param {string} sessionKey - Session identifier
   */
  resetBackend(sessionKey) {
    this.#currentBackendBySessionKey.delete(sessionKey);
  }
}

export const sessionStore = new SessionStore();
export { SessionStore };
