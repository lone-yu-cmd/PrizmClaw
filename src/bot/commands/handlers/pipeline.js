/**
 * Pipeline Command Handler
 * Handles /pipeline command with run/status/logs/stop subcommands.
 * F-006: Integrated with security guard
 */

import {
  startPipeline,
  stopPipeline,
  getStatus,
  getLogs,
  forceUnlock
} from '../../../services/pipeline-controller.js';
import { formatValidationErrors, formatError, ErrorCodes } from '../formatter.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import { sanitizeParam } from '../../../security/param-sanitizer.js';
import { isAdmin } from '../../../security/permission-guard.js';
import {
  createConfirmation,
  checkConfirmation,
  confirmAction,
  cancelConfirmation
} from '../../../security/confirmation-manager.js';

// Store pending confirmations for text-based flow
const pendingConfirmations = new Map();

/**
 * Pipeline command metadata.
 * T-102: minRole added
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
    '/pipeline stop my-feature',
    '/pipeline force-unlock'
  ],
  subcommands: [
    { name: 'run', description: '启动管道' },
    { name: 'status', description: '查询状态' },
    { name: 'logs', description: '查看日志' },
    { name: 'stop', description: '停止管道' },
    { name: 'force-unlock', description: '强制释放锁' }
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
  minRole: 'operator',
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
      return handlePipelineStop(handlerCtx);
    case 'force-unlock':
      return handleForceUnlock(handlerCtx);
    default:
      await reply(`未知操作 '${action}'。可用: run, status, logs, stop, force-unlock`);
  }
}

/**
 * Handle run subcommand.
 * T-103: Added parameter sanitization and audit logging
 */
async function handleRun({ params, reply, parsed, userId, userRole }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  // T-103: Sanitize target parameter
  if (target) {
    const targetResult = sanitizeParam(target, { maxLength: 100 });
    if (!targetResult.ok) {
      await reply(`❌ 目标参数无效: ${targetResult.error}`);
      return;
    }
  }

  // T-103: Sanitize type parameter
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  try {
    const result = await startPipeline({
      type: typeResult.value,
      targetId: target,
      daemon: true
    });

    if (result.ok) {
      // T-107: Audit logging
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_run',
        params: { type: typeResult.value, target },
        result: 'success'
      });

      const pidInfo = result.pid ? ` (PID: ${result.pid})` : '';
      await reply(`✅ 已启动 ${typeResult.value} 管道${target ? `: ${target}` : ''}${pidInfo}`);
    } else {
      const errorMsg = result.message || result.stderr || '未知错误';
      const hint = result.hint ? `\n💡 提示: ${result.hint}` : '';

      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_run',
        params: { type: typeResult.value, target },
        result: 'failed',
        reason: errorMsg
      });

      await reply(`❌ 启动失败: ${errorMsg}${hint}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'pipeline_run',
      params: { type: pipelineType, target },
      result: 'failed',
      reason: error.message
    });
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
 * Handle stop subcommand (pipeline stop).
 * T-104, T-106: Added confirmation flow
 * T-107: Added audit logging
 */
async function handlePipelineStop(handlerCtx) {
  const { params, reply, parsed, userId, userRole, requiresConfirmation } = handlerCtx;

  // Sanitize type parameter (T-103)
  const pipelineType = params.type || 'feature';
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  // Check if force flag is set
  const forceFlag = params.force === true || parsed?.flags?.force === true;
  const canSkipConfirmation = isAdmin(userId) && forceFlag;

  // Handle confirmation flow
  if (requiresConfirmation && !canSkipConfirmation) {
    const rawTarget = params._args?.[0] || params.target;

    // Check if this is a CONFIRM response
    if (rawTarget === 'CONFIRM') {
      const pendingKey = `pipeline-stop:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);

      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(pendingKey);
          await executePipelineStop(handlerCtx, result.params.type, userId, userRole, reply);
        } else {
          await reply(`❌ 确认失败: ${result.error}`);
        }
        return;
      } else {
        await reply('❌ 没有待确认的 stop 操作，或操作已过期。');
        return;
      }
    }

    // Check if this is a CANCEL response
    if (rawTarget === 'CANCEL') {
      const pendingKey = `pipeline-stop:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);
      if (confirmId) {
        cancelConfirmation(confirmId, userId);
        pendingConfirmations.delete(pendingKey);
        await reply('✅ 已取消 stop 操作。');
      } else {
        await reply('没有待确认的 stop 操作。');
      }
      return;
    }

    // Create new confirmation
    const { confirmId, message } = createConfirmation(userId, 'pipeline-stop', { type: typeResult.value });
    pendingConfirmations.set(`pipeline-stop:${userId}`, confirmId);

    await reply(`⚠️ 高风险操作确认\n\n${message}\n\n请回复 /pipeline stop CONFIRM 确认，或 /pipeline stop CANCEL 取消。`);
    return;
  }

  // Execute directly
  await executePipelineStop(handlerCtx, typeResult.value, userId, userRole, reply);
}

/**
 * Execute pipeline stop operation
 */
async function executePipelineStop(handlerCtx, pipelineType, userId, userRole, reply) {
  try {
    const result = await stopPipeline({ type: pipelineType });

    if (result.ok) {
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_stop',
        params: { type: pipelineType },
        result: 'success'
      });

      if (result.errorCode === 'ALREADY_STOPPED') {
        await reply(`⚠️ ${pipelineType} 管道未在运行。`);
      } else {
        const pidInfo = result.previousPid ? ` (原 PID: ${result.previousPid})` : '';
        await reply(`✅ 已停止 ${pipelineType} 管道${pidInfo}`);
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_stop',
        params: { type: pipelineType },
        result: 'failed',
        reason: errorMsg
      });
      await reply(`❌ 停止失败: ${errorMsg}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'pipeline_stop',
      params: { type: pipelineType },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 停止失败: ${error.message}`);
  }
}

/**
 * Handle force-unlock subcommand.
 * T-105: Force-unlock command handler
 * T-104: Confirmation flow
 * T-107: Audit logging
 */
async function handleForceUnlock(handlerCtx) {
  const { params, reply, parsed, userId, userRole, requiresConfirmation } = handlerCtx;

  // Sanitize type parameter (T-103)
  const pipelineType = params.type || 'feature';
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  // Check if force flag is set
  const forceFlag = params.force === true || parsed?.flags?.force === true;
  const canSkipConfirmation = isAdmin(userId) && forceFlag;

  // Handle confirmation flow
  if (requiresConfirmation && !canSkipConfirmation) {
    const rawTarget = params._args?.[0] || params.target;

    // Check if this is a CONFIRM response
    if (rawTarget === 'CONFIRM') {
      const pendingKey = `force-unlock:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);

      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(pendingKey);
          await executeForceUnlock(handlerCtx, result.params.type, userId, userRole, reply);
        } else {
          await reply(`❌ 确认失败: ${result.error}`);
        }
        return;
      } else {
        await reply('❌ 没有待确认的 force-unlock 操作，或操作已过期。');
        return;
      }
    }

    // Check if this is a CANCEL response
    if (rawTarget === 'CANCEL') {
      const pendingKey = `force-unlock:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);
      if (confirmId) {
        cancelConfirmation(confirmId, userId);
        pendingConfirmations.delete(pendingKey);
        await reply('✅ 已取消 force-unlock 操作。');
      } else {
        await reply('没有待确认的 force-unlock 操作。');
      }
      return;
    }

    // Create new confirmation
    const { confirmId, message } = createConfirmation(userId, 'force-unlock', { type: typeResult.value });
    pendingConfirmations.set(`force-unlock:${userId}`, confirmId);

    await reply(`⚠️ 高风险操作确认\n\n${message}\n\n请回复 /pipeline force-unlock CONFIRM 确认，或 /pipeline force-unlock CANCEL 取消。`);
    return;
  }

  // Execute directly
  await executeForceUnlock(handlerCtx, typeResult.value, userId, userRole, reply);
}

/**
 * Execute force-unlock operation
 */
async function executeForceUnlock(handlerCtx, pipelineType, userId, userRole, reply) {
  try {
    const result = await forceUnlock({ type: pipelineType });

    if (result.ok) {
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'force-unlock',
        params: { type: pipelineType },
        result: 'success'
      });

      if (result.wasLocked) {
        await reply(`✅ 已强制释放 ${pipelineType} 管道的锁 (原 PID: ${result.previousPid || '未知'})`);
      } else {
        await reply(`⚠️ ${pipelineType} 管道未被锁定。`);
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'force-unlock',
        params: { type: pipelineType },
        result: 'failed',
        reason: errorMsg
      });
      await reply(`❌ 释放锁失败: ${errorMsg}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'force-unlock',
      params: { type: pipelineType },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 释放锁失败: ${error.message}`);
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
