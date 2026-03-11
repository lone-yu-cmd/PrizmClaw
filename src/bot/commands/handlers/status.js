/**
 * Status Command Handler
 * Handles /status command to show all running pipelines.
 */

import { getPipelineStatus } from '../../../services/pipeline-control-service.js';

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
  const { reply } = handlerCtx;

  try {
    const result = await getPipelineStatus({});

    if (result.ok) {
      const status = formatStatusOutput(result);
      await reply(status);
    } else {
      await reply(`❌ 查询失败: ${result.stderr || result.error || '未知错误'}`);
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
  // Check if there are any pipelines
  const pipelines = result.pipelines || [];

  if (pipelines.length === 0) {
    return '✅ 当前没有运行中的管道。';
  }

  const lines = ['📊 运行中的管道：', ''];

  for (const p of pipelines) {
    const icon = getStatusIcon(p.status);
    lines.push(`${icon} ${p.type || 'pipeline'}: ${p.target || 'unknown'}`);
    lines.push(`   状态: ${p.status || 'running'}`);
    if (p.startTime) {
      lines.push(`   开始: ${p.startTime}`);
    }
    lines.push('');
  }

  lines.push(`共 ${pipelines.length} 个管道运行中。`);

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
