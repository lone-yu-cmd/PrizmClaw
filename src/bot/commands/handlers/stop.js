/**
 * Stop Command Handler
 * Handles /stop command to stop running pipelines and AI CLI tasks.
 * F-006: Integrated with security guard
 * F-011: Extended to handle AI CLI task interruption
 */

import { stopPipeline } from '../../../services/pipeline-controller.js';
import { interruptAiCli, isAiCliRunning, canInterruptAiCli } from '../../../services/ai-cli-service.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import {
  createConfirmation,
  checkConfirmation as _checkConfirmation,
  confirmAction,
  cancelConfirmation
} from '../../../security/confirmation-manager.js';
import { sanitizeParam } from '../../../security/param-sanitizer.js';
import { isAdmin } from '../../../security/permission-guard.js';

// Store pending confirmations for text-based flow
const pendingConfirmations = new Map();

/**
 * Stop command metadata.
 * T-102: minRole added
 * F-011: Extended for AI CLI tasks
 */
export const stopMeta = {
  name: 'stop',
  aliases: [],
  description: '停止运行中的管道或 AI CLI 任务',
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
  minRole: 'admin',
  helpText: '/stop [target] - 停止运行中的管道或 AI CLI 任务'
};

/**
 * Handle stop command.
 * T-104, T-106: Added confirmation flow
 * F-011: Check for AI CLI tasks first
 * @param {Object} handlerCtx - Handler context
 */
export async function handleStop(handlerCtx) {
  const { params, reply, userId, userRole: _userRole, requiresConfirmation, parsed, sessionId } = handlerCtx;

  // F-011: Check for AI CLI task first
  if (sessionId && isAiCliRunning(sessionId)) {
    // T-033: Permission check - only task owner or admin can interrupt
    const permissionCheck = canInterruptAiCli(sessionId, userId, isAdmin);
    if (!permissionCheck.canInterrupt) {
      await logAuditEntry({
        userId,
        action: 'stop-ai-cli',
        params: {},
        result: 'denied',
        reason: permissionCheck.reason,
        sessionId
      });
      await reply(`❌ ${permissionCheck.reason}`);
      return;
    }

    const result = interruptAiCli(sessionId);

    if (result.ok) {
      await logAuditEntry({
        userId,
        action: 'stop-ai-cli',
        params: { pid: result.pid },
        result: 'success',
        sessionId
      });

      await reply(`✅ AI CLI 任务已中断 (PID: ${result.pid})。`);
      return;
    } else {
      await logAuditEntry({
        userId,
        action: 'stop-ai-cli',
        params: {},
        result: 'failed',
        reason: result.error,
        sessionId
      });
      await reply(`❌ 中断失败: ${result.error}`);
      return;
    }
  }

  // Sanitize target parameter
  const rawTarget = params._args?.[0] || params.target;
  const typeResult = sanitizeParam(params.type || 'feature', { maxLength: 50, isTargetId: false });
  if (!typeResult.ok) {
    await reply(`❌ 参数无效: ${typeResult.error}`);
    return;
  }
  const pipelineType = typeResult.value;

  // Check if force flag is set (AC-4.4: --force skips confirmation for admin)
  const forceFlag = params.force === true || parsed?.flags?.force === true;
  const canSkipConfirmation = isAdmin(userId) && forceFlag;

  // Handle confirmation flow (AC-4.1)
  if (requiresConfirmation && !canSkipConfirmation) {
    // Check if this is a CONFIRM response
    if (rawTarget === 'CONFIRM') {
      const pendingKey = `stop:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);

      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(pendingKey);
          await executeStop(handlerCtx, result.params.type, userId, reply);
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
      const pendingKey = `stop:${userId}`;
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
    const { confirmId, message } = createConfirmation(userId, 'stop', { type: pipelineType });
    pendingConfirmations.set(`stop:${userId}`, confirmId);

    await reply(`⚠️ 高风险操作确认\n\n${message}\n\n请回复 /stop CONFIRM 确认，或 /stop CANCEL 取消。`);
    return;
  }

  // Execute directly (admin with --force or no confirmation required)
  await executeStop(handlerCtx, pipelineType, userId, reply);
}

/**
 * Execute stop operation
 */
async function executeStop(handlerCtx, pipelineType, userId, reply) {
  try {
    const result = await stopPipeline({ type: pipelineType });

    if (result.ok) {
      await logAuditEntry({
        userId,
        action: 'stop',
        params: { type: pipelineType },
        result: 'success'
      });

      if (result.errorCode === 'ALREADY_STOPPED') {
        await reply('⚠️ 没有运行中的管道。');
      } else {
        const pidInfo = result.previousPid ? ` (原 PID: ${result.previousPid})` : '';
        await reply(`✅ 已停止管道${pidInfo}。`);
      }
    } else {
      await logAuditEntry({
        userId,
        action: 'stop',
        params: { type: pipelineType },
        result: 'failed',
        reason: result.message
      });
      await reply(`❌ 停止失败: ${result.message || '未知错误'}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      action: 'stop',
      params: { type: pipelineType },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 停止失败: ${error.message}`);
  }
}

export default handleStop;
