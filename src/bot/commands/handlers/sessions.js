/**
 * Sessions Command Handler
 * F-013: Session and Context Manager
 *
 * Handles the /sessions command for viewing all active sessions.
 * Admin-only command.
 */

import { sessionStore } from '../../../services/session-store.js';

/**
 * Sessions command metadata.
 */
export const sessionsMeta = {
  name: 'sessions',
  aliases: [],
  description: '查看所有活跃会话（仅管理员）',
  usage: '/sessions',
  examples: ['/sessions'],
  params: [],
  requiresAuth: true,
  minRole: 'admin',
  helpText: '/sessions - 查看所有活跃会话的概要信息（仅管理员）'
};

/**
 * Format duration in human-readable form.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted string
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${Math.floor(ms / 1000)}s`;
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Truncate string to max length.
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLen) {
  if (!str) return '(none)';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Handle /sessions command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleSessions(handlerCtx) {
  const { reply } = handlerCtx;

  // Get all session keys
  const sessionKeys = sessionStore.getAllSessionKeys();

  if (sessionKeys.length === 0) {
    await reply('📋 当前没有活跃会话。');
    return;
  }

  // Build session list
  const lines = [`📋 活跃会话 (${sessionKeys.length})：`];

  for (const sessionKey of sessionKeys) {
    const info = sessionStore.getSessionInfo(sessionKey);
    if (!info) continue;

    const age = sessionStore.getSessionAge(sessionKey);
    const idle = sessionStore.getIdleTime(sessionKey);

    lines.push('');
    lines.push(`📌 ${sessionKey}`);
    lines.push(`   用户: ${info.userId || '未知'}`);
    lines.push(`   年龄: ${formatDuration(age)}`);
    lines.push(`   空闲: ${formatDuration(idle)}`);
    lines.push(`   目录: ${truncate(info.cwd, 40)}`);
    lines.push(`   命令数: ${info.commandCount}`);
  }

  // Add footer
  lines.push('');
  lines.push('💡 使用 /reset 清理会话');

  await reply(lines.join('\n'));
}

export default {
  sessionsMeta,
  handleSessions
};
