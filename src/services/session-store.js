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
}

export const sessionStore = new SessionStore();
