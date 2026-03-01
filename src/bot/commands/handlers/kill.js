/**
 * /kill Command Handler
 * F-012: System Monitor
 *
 * Terminates a process by PID. Requires admin permission and confirmation.
 */

import { systemMonitorService } from '../../../services/system-monitor-service.js';
import { createConfirmation } from '../../../security/confirmation-manager.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const killMeta = {
  name: 'kill',
  aliases: [],
  description: '终止指定进程（需要管理员权限和确认）',
  usage: '/kill <PID>',
  examples: ['/kill 12345'],
  params: [],
  requiresAuth: true,
  minRole: 'admin',
  helpText: '/kill <PID> - 终止指定进程（需要管理员权限）'
};

/**
 * Parse PID from argument
 * @param {string} arg
 * @returns {number|null}
 */
export function parsePid(arg) {
  if (!arg) return null;

  const pid = parseInt(arg, 10);

  if (isNaN(pid) || pid <= 0) {
    return null;
  }

  return pid;
}

/**
 * Handle /kill command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleKill(handlerCtx) {
  const { reply, args = [], userId, sessionId, confirmationId, skipConfirmation } = handlerCtx;

  // Parse PID from arguments
  const pidArg = args[0];
  const pid = parsePid(pidArg);

  if (!pid) {
    await reply('❌ 请提供有效的 PID。用法: /kill <PID>');
    return;
  }

  // If confirmation ID provided, this is a confirmation callback
  if (confirmationId && skipConfirmation) {
    await executeKill(pid, userId, reply);
    return;
  }

  // Request confirmation
  const { confirmId, message } = createConfirmation(
    userId,
    'kill',
    { pid },
    60000 // 60 second timeout
  );

  await reply([
    `⚠️ *确认终止进程*`,
    '',
    `PID: ${pid}`,
    '',
    message,
    '',
    `确认 ID: \`${confirmId}\``
  ].join('\n'));
}

/**
 * Execute the kill operation
 * @param {number} pid
 * @param {string|number} userId
 * @param {Function} reply
 */
async function executeKill(pid, userId, reply) {
  try {
    const result = await systemMonitorService.killProcess(pid);

    if (result.success) {
      // Log audit entry
      await logAuditEntry({
        timestamp: new Date().toISOString(),
        action: 'kill',
        userId: String(userId),
        params: { pid },
        result: 'success'
      });

      await reply(`✅ 进程 ${pid} 已终止。`);
    } else {
      await reply(`❌ 终止进程 ${pid} 失败: ${escapeMarkdownV2(result.error)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 终止进程 ${pid} 失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  killMeta,
  handleKill,
  parsePid
};
