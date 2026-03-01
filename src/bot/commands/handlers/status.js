/**
 * Status Command Handler
 * Handles /status command to show aggregated pipeline status.
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-1: Aggregated Status Query
 * F-008: T-120 - Added last commit display
 */

import { createStatusAggregator } from '../../../services/status-aggregator.js';
import { createGitService } from '../../../services/git-service.js';
import { sessionStore } from '../../../services/session-store.js';

/**
 * Status command metadata.
 */
export const statusMeta = {
  name: 'status',
  aliases: ['s'],
  description: '查看管道状态',
  usage: '/status [--type=feature|bugfix]',
  examples: ['/status', '/status --type=bugfix', '/status -t feature'],
  params: [
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'Pipeline 类型 (feature 或 bugfix)',
      default: 'feature',
      aliases: ['t']
    }
  ],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/status [--type=feature|bugfix] - 查看管道状态'
};

/**
 * Handle status command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleStatus(handlerCtx) {
  const { reply, params, ctx, userId } = handlerCtx;
  const pipelineType = params.type || params.t || 'feature';

  // Validate pipeline type
  if (pipelineType !== 'feature' && pipelineType !== 'bugfix') {
    await reply(`❌ 无效的 pipeline 类型: ${pipelineType}。请使用 'feature' 或 'bugfix'。`);
    return;
  }

  try {
    const aggregator = createStatusAggregator();
    const status = await aggregator.aggregateStatus(pipelineType);
    let formatted = aggregator.formatStatusForTelegram(status);

    // T-120: Add last commit info
    const gitService = createGitService();
    const lastCommit = await gitService.getLastCommit();

    if (lastCommit) {
      formatted += '\n\n📦 **最近提交**';
      formatted += `\n\`${lastCommit.shortHash}\` ${lastCommit.message.split('\n')[0]}`;
      formatted += `\n👤 ${lastCommit.author} | 📅 ${formatDate(lastCommit.date)}`;
    }

    // Also show session last commit if available
    const sessionId = ctx?.chat?.id?.toString() || `session-${userId}`;
    const sessionLastCommit = sessionStore.getLastCommit(sessionId);

    if (sessionLastCommit) {
      formatted += '\n\n📝 **会话最近提交**';
      formatted += `\n\`${sessionLastCommit.shortHash}\` ${sessionLastCommit.message?.split('\n')[0] || '(无消息)'}`;
      if (sessionLastCommit.featureId) {
        formatted += `\n🏷️ Feature: ${sessionLastCommit.featureId}`;
      }
    }

    await reply(formatted);
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

/**
 * Format date for display.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '未知';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default handleStatus;
