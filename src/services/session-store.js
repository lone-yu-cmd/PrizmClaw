import { config } from '../config.js';

class SessionStore {
  #messagesBySessionKey = new Map();
  #commitsBySessionKey = new Map();

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
}

export const sessionStore = new SessionStore();
