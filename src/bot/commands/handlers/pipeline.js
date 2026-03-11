/**
 * Pipeline Command Handler
 * Handles /pipeline command with run/status/logs/stop subcommands.
 */

import {
  startPipeline,
  getPipelineStatus,
  stopPipeline,
  getPipelineLogs
} from '../../../services/pipeline-control-service.js';
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
      pipelineType,
      targetId: target
    });

    if (result.ok) {
      await reply(`✅ 已启动 ${pipelineType} 管道${target ? `: ${target}` : ''}`);
    } else {
      await reply(`❌ 启动失败: ${result.stderr || result.error || '未知错误'}`);
    }
  } catch (error) {
    await reply(`❌ 启动失败: ${error.message}`);
  }
}

/**
 * Handle status subcommand.
 */
async function handleStatus({ params, reply }) {
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
 * Handle logs subcommand.
 */
async function handleLogs({ params, reply, replyFile, parsed }) {
  const target = params._args?.[0] || params.target;

  try {
    const result = await getPipelineLogs({ targetId: target });

    if (result.ok) {
      const logs = result.stdout || result.logs || '';

      if (logs.length >= 4000) {
        await replyFile(logs, `pipeline-logs-${target || 'latest'}.txt`);
      } else {
        await reply(logs || '暂无日志');
      }
    } else {
      await reply(`❌ 获取日志失败: ${result.stderr || result.error || '未知错误'}`);
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

  try {
    const result = await stopPipeline({ targetId: target });

    if (result.ok) {
      await reply(`✅ 已停止管道${target ? `: ${target}` : ''}`);
    } else {
      await reply(`❌ 停止失败: ${result.stderr || result.error || '未知错误'}`);
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
  if (!result.pipelines || result.pipelines.length === 0) {
    return '当前没有运行中的管道。';
  }

  const lines = ['运行中的管道：', ''];

  for (const p of result.pipelines) {
    lines.push(`• ${p.type || 'pipeline'}: ${p.target || 'unknown'}`);
    lines.push(`  状态: ${p.status || 'running'}`);
    if (p.startTime) {
      lines.push(`  开始: ${p.startTime}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default handlePipeline;
