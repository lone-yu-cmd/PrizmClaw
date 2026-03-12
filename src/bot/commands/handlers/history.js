/**
 * History Command Handler
 * F-013: Session and Context Manager
 *
 * Handles the /history command for viewing command execution history.
 */

import { sessionStore } from '../../../services/session-store.js';

/**
 * History command metadata.
 */
export const historyMeta = {
  name: 'history',
  aliases: ['h'],
  description: '查看命令执行历史',
  usage: '/history [N]',
  examples: ['/history', '/history 20'],
  params: [
    {
      name: 'count',
      required: false,
      description: '显示最近 N 条命令（默认 10 条）'
    }
  ],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/history [N] - 查看最近执行的命令历史'
};

/**
 * Format a timestamp for display.
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} Formatted string
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Handle /history command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleHistory(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Parse count argument
  let count = 10;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      await reply('❌ 参数必须是正整数。用法: /history [N]');
      return;
    }
    count = Math.min(parsed, 100); // Cap at 100
  }

  // Get command history
  const history = sessionStore.getCommandHistory(sessionId, count);

  if (history.length === 0) {
    await reply('📋 暂无命令历史记录。');
    return;
  }

  // Format output
  const lines = [`📋 最近 ${history.length} 条命令历史：`];

  // Show in reverse chronological order (most recent first)
  const reversedHistory = [...history].reverse();

  for (let i = 0; i < reversedHistory.length; i++) {
    const entry = reversedHistory[i];
    const index = history.length - i; // Original index (1-based)
    const exitCodeStr = entry.exitCode === 0 ? '✓' : `✗(${entry.exitCode})`;
    const timeStr = formatTimestamp(entry.timestamp);
    lines.push(`[${index}] ${timeStr} ${exitCodeStr} ${entry.command}`);
  }

  await reply(lines.join('\n'));
}

export default {
  historyMeta,
  handleHistory
};
