/**
 * Audit Command Handler
 * Handles /audit command to query audit logs.
 * F-006: Safety and Permission Guard - US-5: Audit Logging
 */

import { queryAuditLogs, initAuditLogService } from '../../../services/audit-log-service.js';
import { isAdmin } from '../../../security/permission-guard.js';
import { sanitizeParam } from '../../../security/param-sanitizer.js';

/**
 * Audit command metadata.
 * T-108: Admin-only audit log query
 */
export const auditMeta = {
  name: 'audit',
  aliases: [],
  description: '查询审计日志 (仅限管理员)',
  usage: '/audit [--user=<userId>] [--action=<action>] [--limit=<N>]',
  examples: [
    '/audit',
    '/audit --user=123456789',
    '/audit --action=stop',
    '/audit --limit=20'
  ],
  params: [
    {
      name: 'user',
      type: 'string',
      required: false,
      description: '按用户 ID 过滤'
    },
    {
      name: 'action',
      type: 'string',
      required: false,
      description: '按操作类型过滤'
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: '返回条数限制 (最大 100)',
      default: 20
    }
  ],
  requiresAuth: true,
  minRole: 'admin',
  helpText: '/audit [--user=<userId>] [--action=<action>] [--limit=<N>] - 查询审计日志'
};

/**
 * Handle audit command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleAudit(handlerCtx) {
  const { reply, params, userId, requiresConfirmation: _requiresConfirmation } = handlerCtx;

  // Double-check admin permission (defense in depth)
  if (!isAdmin(userId)) {
    await reply('⛔ 此命令仅限管理员使用。');
    return;
  }

  // Parse and sanitize parameters
  const limit = Math.min(parseInt(params.limit, 10) || 20, 100);

  let userFilter = null;
  if (params.user) {
    const userResult = sanitizeParam(params.user, { maxLength: 50 });
    if (!userResult.ok) {
      await reply(`❌ 用户参数无效: ${userResult.error}`);
      return;
    }
    userFilter = userResult.value;
  }

  let actionFilter = null;
  if (params.action) {
    const actionResult = sanitizeParam(params.action, { maxLength: 50 });
    if (!actionResult.ok) {
      await reply(`❌ 操作参数无效: ${actionResult.error}`);
      return;
    }
    actionFilter = actionResult.value;
  }

  try {
    // Initialize service if needed
    await initAuditLogService();

    // Query logs
    const entries = await queryAuditLogs({
      userId: userFilter,
      action: actionFilter,
      limit
    });

    if (entries.length === 0) {
      await reply('📭 没有找到匹配的审计日志。');
      return;
    }

    // Format entries for display
    const formatted = formatAuditEntries(entries);
    await reply(formatted);
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

/**
 * Format audit entries for Telegram display.
 * @param {Object[]} entries
 * @returns {string}
 */
function formatAuditEntries(entries) {
  const lines = [`📋 审计日志 (${entries.length} 条)\n`];

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });
    const resultEmoji = entry.result === 'success' ? '✅' : entry.result === 'denied' ? '⛔' : '❌';

    lines.push(`${resultEmoji} ${time}`);
    lines.push(`   用户: ${entry.userId}`);
    lines.push(`   操作: ${entry.action}`);
    if (entry.params && Object.keys(entry.params).length > 0) {
      lines.push(`   参数: ${JSON.stringify(entry.params)}`);
    }
    lines.push(`   结果: ${entry.result}`);
    if (entry.reason) {
      lines.push(`   原因: ${entry.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export default handleAudit;
