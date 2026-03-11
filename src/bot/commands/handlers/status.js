/**
 * Status Command Handler
 * Handles /status command to show aggregated pipeline status.
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-1: Aggregated Status Query
 */

import { createStatusAggregator } from '../../../services/status-aggregator.js';

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
  helpText: '/status [--type=feature|bugfix] - 查看管道状态'
};

/**
 * Handle status command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleStatus(handlerCtx) {
  const { reply, params } = handlerCtx;
  const pipelineType = params.type || params.t || 'feature';

  // Validate pipeline type
  if (pipelineType !== 'feature' && pipelineType !== 'bugfix') {
    await reply(`❌ 无效的 pipeline 类型: ${pipelineType}。请使用 'feature' 或 'bugfix'。`);
    return;
  }

  try {
    const aggregator = createStatusAggregator();
    const status = await aggregator.aggregateStatus(pipelineType);
    const formatted = aggregator.formatStatusForTelegram(status);

    await reply(formatted);
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

export default handleStatus;
