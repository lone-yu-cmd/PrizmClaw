/**
 * Stop Command Handler
 * Handles /stop command to stop running pipelines.
 */

import { stopPipeline } from '../../../services/pipeline-control-service.js';

/**
 * Stop command metadata.
 */
export const stopMeta = {
  name: 'stop',
  aliases: [],
  description: '停止运行中的管道',
  usage: '/stop [target]',
  examples: ['/stop', '/stop my-feature'],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  helpText: '/stop [target] - 停止运行中的管道'
};

/**
 * Handle stop command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleStop(handlerCtx) {
  const { params, reply, parsed } = handlerCtx;

  // Get target from positional args or params
  const target = params._args?.[0] || params.target;

  try {
    const result = await stopPipeline({ targetId: target });

    if (result.ok) {
      if (target) {
        await reply(`✅ 已停止管道: ${target}`);
      } else {
        await reply('✅ 已停止当前管道。');
      }

      // Show additional info if available
      if (result.stoppedCount !== undefined) {
        await reply(`共停止 ${result.stoppedCount} 个管道。`);
      }
    } else {
      // Check if it's a "not found" type error
      const error = result.stderr || result.error || '';
      if (error.includes('not found') || error.includes('没有') || error.includes('no pipeline')) {
        await reply('⚠️ 没有找到运行中的管道。');
      } else {
        await reply(`❌ 停止失败: ${error || '未知错误'}`);
      }
    }
  } catch (error) {
    await reply(`❌ 停止失败: ${error.message}`);
  }
}

export default handleStop;
