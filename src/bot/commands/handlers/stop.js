/**
 * Stop Command Handler
 * Handles /stop command to stop running pipelines.
 */

import { stopPipeline } from '../../../services/pipeline-controller.js';

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
  const pipelineType = params.type || 'feature';

  try {
    const result = await stopPipeline({ type: pipelineType });

    if (result.ok) {
      if (result.errorCode === 'ALREADY_STOPPED') {
        await reply('⚠️ 没有运行中的管道。');
      } else {
        const pidInfo = result.previousPid ? ` (原 PID: ${result.previousPid})` : '';
        await reply(`✅ 已停止管道${pidInfo}。`);
      }
    } else {
      await reply(`❌ 停止失败: ${result.message || '未知错误'}`);
    }
  } catch (error) {
    await reply(`❌ 停止失败: ${error.message}`);
  }
}

export default handleStop;
