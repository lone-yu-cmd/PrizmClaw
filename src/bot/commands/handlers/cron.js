/**
 * /cron Command Handler
 * F-014: Notification and Scheduled Tasks
 *
 * Handles scheduled task creation with cron expressions and one-time execution.
 */

import { scheduledTaskService } from '../../../services/scheduled-task-service.js';
import { sessionStore } from '../../../services/session-store.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const cronMeta = {
  name: 'cron',
  aliases: [],
  description: '创建定时任务',
  usage: '/cron add <cron表达式> <命令> | /cron add --once <时间> <命令>',
  examples: [
    '/cron add "*/5 * * * *" echo hello',
    '/cron add --once "2026-03-15 10:00" echo hello',
    '/cron add --once "2026-03-15 10:00" npm test'
  ],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/cron add <cron表达式> <命令>\n' +
    '/cron add --once <时间> <命令>\n' +
    '\n' +
    'Cron 表达式格式: 分 时 日 月 周\n' +
    '示例:\n' +
    '  */5 * * * *    每5分钟\n' +
    '  0 * * * *      每小时\n' +
    '  0 0 * * *      每天0点\n' +
    '  0 9 * * 1-5    工作日上午9点\n' +
    '\n' +
    '一次性任务时间格式:\n' +
    '  "2026-03-15 10:00" 或 ISO 格式'
};

/**
 * Parse cron add command
 * @param {string[]} args
 * @returns {{type: 'cron'|'once', schedule: string, command: string}|null}
 */
export function parseCronAddCommand(args) {
  if (!args || args.length < 3) {
    return null;
  }

  // Check for --once flag
  if (args[0].toLowerCase() === 'add' && args[1] === '--once') {
    // Format: add --once "datetime" <command>
    const schedule = args[2];
    const command = args.slice(3).join(' ');
    return { type: 'once', schedule, command };
  }

  // Format: add "cron" <command>
  if (args[0].toLowerCase() === 'add') {
    const schedule = args[1];
    const command = args.slice(2).join(' ');
    return { type: 'cron', schedule, command };
  }

  return null;
}

/**
 * Handle /cron command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCron(handlerCtx) {
  const { reply, args = [], from, chat, sessionId } = handlerCtx;

  if (args.length === 0) {
    await reply([
      '⏰ *定时任务命令用法*',
      '',
      '```',
      '/cron add <cron表达式> <命令>',
      '/cron add --once <时间> <命令>',
      '```',
      '',
      'Cron 表达式格式: 分 时 日 月 周',
      '示例:',
      '  `*/5 * * * *` 每5分钟',
      '  `0 * * * *` 每小时',
      '  `0 0 * * *` 每天0点',
      '',
      '一次性任务时间格式:',
      '  `"2026-03-15 10:00"`',
      '',
      '使用 /jobs 查看和管理已创建的任务'
    ].join('\n'));
    return;
  }

  const parsed = parseCronAddCommand(args);

  if (!parsed) {
    await reply('❌ 命令格式错误。用法: /cron add <cron表达式> <命令>');
    return;
  }

  if (!parsed.command) {
    await reply('❌ 请提供要执行的命令。');
    return;
  }

  try {
    const chatId = String(chat.id);
    const userId = String(from.id);
    const cwd = sessionStore.getCwd(sessionId) || process.cwd();

    let task;
    if (parsed.type === 'once') {
      task = scheduledTaskService.addOneTimeTask({
        schedule: parsed.schedule,
        command: parsed.command,
        chatId,
        userId,
        cwd
      });
    } else {
      task = scheduledTaskService.addCronTask({
        schedule: parsed.schedule,
        command: parsed.command,
        chatId,
        userId,
        cwd
      });
    }

    // Save tasks
    await scheduledTaskService.saveTasks();

    const nextRun = task.nextRunAt
      ? new Date(task.nextRunAt).toLocaleString()
      : '计算中...';

    await reply([
      '✅ *定时任务已创建*',
      '',
      `ID: \`${task.id}\``,
      `类型: ${task.type === 'cron' ? '周期任务' : '一次性任务'}`,
      `调度: \`${task.schedule}\``,
      `命令: \`${escapeMarkdownV2(task.command)}\``,
      `下次执行: ${nextRun}`
    ].join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 创建任务失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  cronMeta,
  handleCron,
  parseCronAddCommand
};
