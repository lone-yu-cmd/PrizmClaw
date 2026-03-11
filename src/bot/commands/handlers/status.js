/**
 * Status Command Handler
 * Handles /status command to show all running pipelines.
 */

import { getStatus } from '../../../services/pipeline-controller.js';

/**
 * Status command metadata.
 */
export const statusMeta = {
  name: 'status',
  aliases: ['s'],
  description: '查看管道状态',
  usage: '/status',
  examples: ['/status'],
  params: [],
  requiresAuth: true,
  helpText: '/status - 查看所有运行中的管道'
};

/**
 * Handle status command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleStatus(handlerCtx) {
  const { reply, params } = handlerCtx;
  const pipelineType = params.type || 'feature';

  try {
    const result = await getStatus({ type: pipelineType });

    if (result.ok) {
      const status = formatStatusOutput(result);
      await reply(status);
    } else {
      await reply(`❌ 查询失败: ${result.message || '未知错误'}`);
    }
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

/**
 * Format status output.
 * @param {Object} result - Status result
 * @returns {string} Formatted status
 */
function formatStatusOutput(result) {
  if (!result.isRunning) {
    const lastResultInfo = result.lastResult
      ? `\n\n最后一次运行:\n• 状态: ${result.lastResult.status}\n• 完成: ${result.lastResult.featuresCompleted}/${result.lastResult.featuresTotal}`
      : '';
    return `✅ ${result.message}${lastResultInfo}`;
  }

  const lines = [`📊 ${result.message}`, ''];

  if (result.pid) {
    lines.push(`• PID: ${result.pid}`);
  }

  if (result.currentFeature) {
    lines.push(`• 当前目标: ${result.currentFeature}`);
  }

  if (result.startedAt) {
    lines.push(`• 开始时间: ${result.startedAt}`);
  }

  if (result.lockInfo) {
    lines.push(`• 锁持有者 PID: ${result.lockInfo.pid}`);
  }

  return lines.join('\n');
}

/**
 * Get status icon.
 * @param {string} status - Pipeline status
 * @returns {string} Icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'running':
      return '🔄';
    case 'pending':
      return '⏳';
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '📦';
  }
}

export default handleStatus;
