/**
 * Commit Command Handler
 * F-008: Commit Workflow Integration
 *
 * Handles /commit command with optional --message, --amend, --force flags.
 * Integrated with F-006 security layer for permission checks and confirmations.
 */

import { createCommitService } from '../../../services/commit-service.js';
import { createGitService } from '../../../services/git-service.js';
import { sessionStore } from '../../../services/session-store.js';
import { isAdmin } from '../../../security/permission-guard.js';
import {
  createConfirmation,
  confirmAction,
  cancelConfirmation
} from '../../../security/confirmation-manager.js';
import { sanitizeParam } from '../../../security/param-sanitizer.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';

// Store pending confirmations for amend/force operations
const pendingConfirmations = new Map();

// Create commit service instance
const commitService = createCommitService({
  sessionStore: {
    addCommit: (sessionId, commitInfo) => sessionStore.addCommit(sessionId, commitInfo),
    getCommits: (sessionId) => sessionStore.getCommits(sessionId)
  }
});

/**
 * Commit command metadata
 */
export const commitMeta = {
  name: 'commit',
  aliases: ['c'],
  description: '提交代码变更',
  usage: '/commit [--message="..."] [--amend] [--force]',
  examples: [
    '/commit',
    '/commit --message="feat: add new feature"',
    '/commit --amend',
    '/commit --force'
  ],
  params: [
    {
      name: 'message',
      type: 'string',
      required: false,
      description: '提交信息',
      aliases: ['m']
    },
    {
      name: 'amend',
      type: 'boolean',
      required: false,
      description: '修改最近一次提交（仅 admin）'
    },
    {
      name: 'force',
      type: 'boolean',
      required: false,
      description: '跳过前置校验（仅 admin）'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/commit [--message="..."] [--amend] [--force] - 提交代码变更'
};

/**
 * Handle commit command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCommit(handlerCtx) {
  const { ctx, parsed, params, reply, userId, userRole, requiresConfirmation } = handlerCtx;

  // Parse parameters
  const message = params.message || params.m || getDefaultCommitMessage();
  const amend = params.amend === true || parsed?.flags?.amend === true;
  const force = params.force === true || parsed?.flags?.force === true;

  // Validate message length
  if (message.length > 500) {
    await reply('❌ 提交信息过长，请限制在 500 字符以内。');
    return;
  }

  // Sanitize message
  const messageResult = sanitizeParam(message, { maxLength: 500 });
  if (!messageResult.ok) {
    await reply(`❌ 提交信息无效: ${messageResult.error}`);
    return;
  }

  // Check amend/force permissions
  if (amend && !isAdmin(userId)) {
    await reply('❌ --amend 需要 admin 权限。');
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'commit:amend',
      params: { message: messageResult.value },
      result: 'denied',
      reason: 'Insufficient permissions'
    });
    return;
  }

  if (force && !isAdmin(userId)) {
    await reply('❌ --force 需要 admin 权限。');
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'commit:force',
      params: { message: messageResult.value },
      result: 'denied',
      reason: 'Insufficient permissions'
    });
    return;
  }

  // Handle confirmation flow for amend/force
  if ((amend || force) && requiresConfirmation) {
    const confirmKey = `commit:${amend ? 'amend' : 'force'}:${userId}`;

    // Check if this is a CONFIRM response
    const rawArg = params._args?.[0];
    if (rawArg === 'CONFIRM') {
      const confirmId = pendingConfirmations.get(confirmKey);
      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(confirmKey);
          await executeCommit(handlerCtx, messageResult.value, amend, force);
        } else {
          await reply(`❌ 确认失败: ${result.error}`);
        }
        return;
      } else {
        await reply('❌ 没有待确认的 commit 操作，或操作已过期。');
        return;
      }
    }

    // Check if this is a CANCEL response
    if (rawArg === 'CANCEL') {
      const confirmId = pendingConfirmations.get(confirmKey);
      if (confirmId) {
        cancelConfirmation(confirmId, userId);
        pendingConfirmations.delete(confirmKey);
        await reply('✅ 已取消 commit 操作。');
      } else {
        await reply('没有待确认的 commit 操作。');
      }
      return;
    }

    // Create new confirmation
    const actionType = amend ? 'commit --amend' : 'commit --force';
    const { confirmId, message: confirmMessage } = createConfirmation(
      userId,
      actionType,
      { message: messageResult.value, amend, force }
    );
    pendingConfirmations.set(confirmKey, confirmId);

    const flagDesc = amend ? '--amend' : '--force';
    await reply(`⚠️ 高风险操作确认\n\n${confirmMessage}\n\n请回复 /commit ${flagDesc} CONFIRM 确认，或 /commit ${flagDesc} CANCEL 取消。`);
    return;
  }

  // Execute commit directly
  await executeCommit(handlerCtx, messageResult.value, amend, force);
}

/**
 * Execute commit operation
 */
async function executeCommit(handlerCtx, message, amend, force) {
  const { reply, userId, userRole, ctx } = handlerCtx;

  // Get session ID from context or use default
  const sessionId = ctx?.chat?.id?.toString() || `session-${userId}`;

  // Get feature/bugfix ID from session if available
  const sessionState = ctx?.state?.session || {};
  const featureId = sessionState.featureId || null;
  const bugfixId = sessionState.bugfixId || null;

  try {
    const result = await commitService.commit({
      sessionId,
      userId: String(userId),
      message,
      amend,
      force,
      featureId,
      bugfixId,
      userRole
    });

    if (result.success) {
      // Format success message
      const successMsg = formatSuccessResult(result);
      await reply(successMsg);
    } else {
      // Format error message
      const errorMsg = formatErrorResult(result);
      await reply(errorMsg);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: amend ? 'commit:amend' : 'commit',
      params: { message, amend, force },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 提交失败: ${error.message}`);
  }
}

/**
 * Get default commit message
 */
function getDefaultCommitMessage() {
  return `chore: update ${new Date().toISOString().split('T')[0]}`;
}

/**
 * Format success result for Telegram
 */
function formatSuccessResult(result) {
  const lines = [
    '✅ 提交成功',
    '',
    `📦 Hash: \`${result.shortHash}\``,
    `📝 消息: ${result.message?.split('\n')[0] || '(无)'}`,
    `📁 变更文件: ${result.filesChanged || 0} 个`
  ];

  return lines.join('\n');
}

/**
 * Format error result for Telegram
 */
function formatErrorResult(result) {
  const lines = ['❌ 提交失败', ''];

  if (result.errors && result.errors.length > 0) {
    lines.push('**错误详情:**');
    for (const error of result.errors) {
      lines.push(`• ${error.message}`);
      if (error.suggestion) {
        lines.push(`  💡 ${error.suggestion}`);
      }
    }
  } else if (result.error) {
    lines.push(`原因: ${result.error}`);
    if (result.suggestion) {
      lines.push(`💡 建议: ${result.suggestion}`);
    }
  }

  return lines.join('\n');
}

export default handleCommit;
