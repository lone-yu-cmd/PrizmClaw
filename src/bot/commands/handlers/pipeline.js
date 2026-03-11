/**
 * Pipeline Command Handler
 * Handles /pipeline command with run/status/logs/stop subcommands.
 */

import {
  startPipeline,
  stopPipeline,
  getStatus,
  getLogs
} from '../../../services/pipeline-controller.js';
import { formatValidationErrors, formatError, ErrorCodes } from '../formatter.js';

/**
 * Pipeline command metadata.
 */
export const pipelineMeta = {
  name: 'pipeline',
  aliases: ['p'],
  description: '管理管道任务',
  usage: '/pipeline <action> [target] [--type=<type>]',
  examples: [
    '/pipeline run my-feature',
    '/pipeline run my-feature --type=bugfix',
    '/pipeline status',
    '/pipeline logs my-feature',
    '/pipeline stop my-feature'
  ],
  subcommands: [
    { name: 'run', description: '启动管道' },
    { name: 'status', description: '查询状态' },
    { name: 'logs', description: '查看日志' },
    { name: 'stop', description: '停止管道' }
  ],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    },
    {
      name: 'type',
      type: 'enum',
      enum: ['feature', 'bugfix', 'planner'],
      required: false,
      default: 'feature',
      description: '管道类型'
    }
  ],
  requiresAuth: true,
  helpText: '/pipeline <action> [target] [--type=<type>] - 管理管道任务'
};

/**
 * Handle pipeline command.
 * @param {Object} handlerCtx - Handler context
 * @param {Object} handlerCtx.ctx - Telegraf context
 * @param {Object} handlerCtx.parsed - Parsed command
 * @param {Object} handlerCtx.params - Normalized parameters
 * @param {Function} handlerCtx.reply - Reply function
 */
export async function handlePipeline(handlerCtx) {
  const { ctx, parsed, params, reply } = handlerCtx;

  // Determine action from subcommand or default to status
  const action = parsed.subcommand || 'status';

  switch (action) {
    case 'run':
      return handleRun(handlerCtx);
    case 'status':
      return handleStatus(handlerCtx);
    case 'logs':
      return handleLogs(handlerCtx);
    case 'stop':
      return handleStop(handlerCtx);
    default:
      await reply(`未知操作 '${action}'。可用: run, status, logs, stop`);
  }
}

/**
 * Handle run subcommand.
 */
async function handleRun({ params, reply, parsed }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  try {
    const result = await startPipeline({
      type: pipelineType,
      targetId: target,
      daemon: true
    });

    if (result.ok) {
      const pidInfo = result.pid ? ` (PID: ${result.pid})` : '';
      await reply(`✅ 已启动 ${pipelineType} 管道${target ? `: ${target}` : ''}${pidInfo}`);
    } else {
      const errorMsg = result.message || result.stderr || '未知错误';
      const hint = result.hint ? `\n💡 提示: ${result.hint}` : '';
      await reply(`❌ 启动失败: ${errorMsg}${hint}`);
    }
  } catch (error) {
    await reply(`❌ 启动失败: ${error.message}`);
  }
}

/**
 * Handle status subcommand.
 */
async function handleStatus({ params, reply }) {
  const pipelineType = params.type || 'feature';

  try {
    const result = await getStatus({ type: pipelineType });

    if (result.ok) {
      const status = formatStatusOutput(result);
      await reply(status);
    } else {
      const errorMsg = result.message || result.stderr || '未知错误';
      await reply(`❌ 查询失败: ${errorMsg}`);
    }
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

/**
 * Handle logs subcommand.
 */
async function handleLogs({ params, reply, replyFile, parsed }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  try {
    const result = await getLogs({ type: pipelineType, lines: 100 });

    if (result.ok) {
      const logs = result.logs || '';

      if (logs.length >= 4000) {
        await replyFile(logs, `pipeline-logs-${target || 'latest'}.txt`);
      } else {
        await reply(logs || '暂无日志');
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await reply(`❌ 获取日志失败: ${errorMsg}`);
    }
  } catch (error) {
    await reply(`❌ 获取日志失败: ${error.message}`);
  }
}

/**
 * Handle stop subcommand.
 */
async function handleStop({ params, reply, parsed }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  try {
    const result = await stopPipeline({ type: pipelineType });

    if (result.ok) {
      if (result.errorCode === 'ALREADY_STOPPED') {
        await reply(`⚠️ ${pipelineType} 管道未在运行。`);
      } else {
        const pidInfo = result.previousPid ? ` (原 PID: ${result.previousPid})` : '';
        await reply(`✅ 已停止 ${pipelineType} 管道${pidInfo}`);
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await reply(`❌ 停止失败: ${errorMsg}`);
    }
  } catch (error) {
    await reply(`❌ 停止失败: ${error.message}`);
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
      ? `\n最后一次运行: ${result.lastResult.status} (${result.lastResult.featuresCompleted}/${result.lastResult.featuresTotal})`
      : '';
    return `✅ ${result.message}${lastResultInfo}`;
  }

  const lines = [`🔄 ${result.message}`, ''];

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

export default handlePipeline;
