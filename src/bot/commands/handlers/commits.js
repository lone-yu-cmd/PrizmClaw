/**
 * Commits Command Handler
 * F-008: Commit Workflow Integration
 *
 * Handles /commits command to view session commit history.
 */

import { sessionStore } from '../../../services/session-store.js';

/**
 * Commits command metadata
 */
export const commitsMeta = {
  name: 'commits',
  aliases: ['history'],
  description: '查看会话提交历史',
  usage: '/commits [--count=10]',
  examples: [
    '/commits',
    '/commits --count=5'
  ],
  params: [
    {
      name: 'count',
      type: 'number',
      required: false,
      default: 10,
      description: '显示的提交数量'
    }
  ],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/commits [--count=N] - 查看会话提交历史'
};

/**
 * Handle commits command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCommits(handlerCtx) {
  const { ctx, params, reply, userId } = handlerCtx;

  // Get session ID from context
  const sessionId = ctx?.chat?.id?.toString() || `session-${userId}`;

  // Get count parameter
  const count = Math.min(params.count || 10, 20); // Max 20

  try {
    // Get commits from session store
    const commits = sessionStore.getCommits(sessionId);

    if (!commits || commits.length === 0) {
      await reply('📭 当前会话暂无提交记录。');
      return;
    }

    // Format commit history
    const formattedCommits = commits.slice(-count).reverse();
    const message = formatCommitsList(formattedCommits);

    await reply(message);
  } catch (error) {
    await reply(`❌ 获取提交历史失败: ${error.message}`);
  }
}

/**
 * Format commits list for Telegram
 * @param {Object[]} commits - Array of commit records
 * @returns {string} Formatted message
 */
function formatCommitsList(commits) {
  const lines = ['📋 **提交历史**', ''];

  for (const commit of commits) {
    const time = formatTimestamp(commit.timestamp);
    const shortMsg = commit.message?.split('\n')[0] || '(无消息)';

    lines.push(`\`${commit.shortHash}\` ${shortMsg}`);
    lines.push(`   📅 ${time} | 📁 ${commit.filesChanged || 0} 文件`);

    if (commit.featureId) {
      lines.push(`   🏷️ Feature: ${commit.featureId}`);
    }
    if (commit.bugfixId) {
      lines.push(`   🐛 Bugfix: ${commit.bugfixId}`);
    }

    lines.push('');
  }

  lines.push(`_共 ${commits.length} 条提交记录_`);

  return lines.join('\n');
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date string
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '未知时间';

  const date = new Date(timestamp);
  const now = new Date();
  // @ts-ignore — Date arithmetic is valid at runtime
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default handleCommits;
