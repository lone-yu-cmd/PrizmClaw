/**
 * Output Command Handler
 * F-020: Enhanced Terminal Output Streaming
 *
 * Handles the /output [N] command — shows last N AI CLI command outputs
 * from the session output history.
 *
 * Usage: /output [count]
 *   count — number of recent entries to show (default: 5, max: 20)
 */

import { createOutputHistoryService } from '../../../services/output-history-service.js';

// Singleton output history service (shared with telegram.js integration)
export const outputHistoryService = createOutputHistoryService(10);

const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;
const OUTPUT_PREVIEW_CHARS = 200;

/**
 * Output command metadata.
 */
export const outputMeta = {
  name: 'output',
  aliases: [],
  description: '查看最近命令的完整输出历史',
  usage: '/output [N]',
  examples: ['/output', '/output 3', '/output 10'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/output [N] - 查看最近 N 条 AI CLI 命令的完整输出历史（默认 5，最多 20）'
};

/**
 * Handle /output command.
 * @param {Object} handlerCtx - Handler context
 * @param {string} handlerCtx.sessionId - Session ID
 * @param {Function} handlerCtx.reply - Reply function
 * @param {string[]} [handlerCtx.args] - Command arguments
 * @param {Object} [handlerCtx.outputHistoryService] - Output history service (injectable for tests)
 */
export async function handleOutput(handlerCtx) {
  const { sessionId, reply, args = [] } = handlerCtx;

  // Allow injecting a mock service for tests
  const historyService = handlerCtx.outputHistoryService ?? outputHistoryService;

  // Parse count from args
  let count = DEFAULT_COUNT;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10);
    if (!isNaN(parsed) && parsed > 0) {
      count = Math.min(parsed, MAX_COUNT);
    }
    // If parse fails, silently fall back to default
  }

  // Build the session key — telegram sessions use the telegram: prefix
  // sessionId here is the raw chat ID (e.g., "123456789")
  const sessionKey = sessionId.startsWith('telegram:') ? sessionId : `telegram:${sessionId}`;

  const entries = historyService.getHistory(sessionKey, count);

  if (entries.length === 0) {
    await reply('暂无输出历史。请先发送 AI 消息，再使用 /output 查看历史。');
    return;
  }

  // Format entries as a numbered list with prompt + timestamp + truncated output preview
  const lines = [`📋 最近 ${entries.length} 条命令输出历史：\n`];

  entries.forEach((entry, i) => {
    const num = i + 1;
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const preview = entry.output.length > OUTPUT_PREVIEW_CHARS
      ? entry.output.slice(0, OUTPUT_PREVIEW_CHARS) + '...'
      : entry.output;

    lines.push(`${num}. [${time}] ${entry.prompt}`);
    lines.push(preview.trim() || '(空输出)');
    if (i < entries.length - 1) {
      lines.push(''); // blank line between entries
    }
  });

  await reply(lines.join('\n'));
}

export default {
  outputMeta,
  handleOutput,
  outputHistoryService
};
