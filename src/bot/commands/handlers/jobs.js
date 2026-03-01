/**
 * /jobs Command Handler
 * F-014: Notification and Scheduled Tasks
 *
 * Manages scheduled tasks - list, pause, resume, delete.
 */

import { scheduledTaskService } from '../../../services/scheduled-task-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const jobsMeta = {
  name: 'jobs',
  aliases: [],
  description: '管理定时任务',
  usage: '/jobs <list|pause|resume|delete> [ID]',
  examples: [
    '/jobs list',
    '/jobs pause abc123',
    '/jobs resume abc123',
    '/jobs delete abc123'
  ],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/jobs <子命令> [参数]\n' +
    '子命令:\n' +
    '  list           列出所有任务\n' +
    '  pause <ID>     暂停任务\n' +
    '  resume <ID>    恢复任务\n' +
    '  delete <ID>    删除任务'
};

/**
 * Parse subcommand from arguments
 * @param {string[]} args
 * @returns {{subcommand: string, arg?: string}}
 */
export function parseJobsSubcommand(args) {
  if (!args || args.length === 0) {
    return { subcommand: 'list' };
  }

  const subcommand = args[0].toLowerCase();
  const arg = args.slice(1).join(' ');

  return { subcommand, arg };
}

/**
 * Handle /jobs command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleJobs(handlerCtx) {
  const { reply, args = [], chat } = handlerCtx;

  const { subcommand, arg } = parseJobsSubcommand(args);

  switch (subcommand) {
    case 'list':
      await handleList(reply, String(chat.id));
      break;
    case 'pause':
      await handlePause(arg, reply);
      break;
    case 'resume':
      await handleResume(arg, reply);
      break;
    case 'delete':
    case 'remove':
      await handleDelete(arg, reply);
      break;
    default:
      await reply([
        '📋 *定时任务命令用法*',
        '',
        '```',
        '/jobs list           列出所有任务',
        '/jobs pause <ID>     暂停任务',
        '/jobs resume <ID>    恢复任务',
        '/jobs delete <ID>    删除任务',
        '```'
      ].join('\n'));
  }
}

/**
 * Handle list subcommand
 * @param {Function} reply
 * @param {string} chatId
 */
async function handleList(reply, chatId) {
  const tasks = scheduledTaskService.listTasks({ chatId });

  if (tasks.length === 0) {
    await reply('📋 当前没有配置任何定时任务。');
    return;
  }

  const lines = [
    `📋 *定时任务列表* (${tasks.length})`,
    ''
  ];

  for (const task of tasks) {
    const status = task.enabled ? '✅' : '⏸️';
    const type = task.type === 'cron' ? '周期' : '一次';
    const lastRun = task.lastRunAt
      ? new Date(task.lastRunAt).toLocaleString()
      : '从未';
    const nextRun = task.nextRunAt
      ? new Date(task.nextRunAt).toLocaleString()
      : '-';

    lines.push(`${status} \`${task.id.substring(0, 8)}...\``);
    lines.push(`   类型: ${type} | 调度: \`${task.schedule}\``);
    lines.push(`   命令: \`${truncate(task.command, 30)}\``);
    lines.push(`   上次: ${lastRun} | 下次: ${nextRun}`);
    lines.push('');
  }

  lines.push('使用 /jobs pause|resume|delete <ID> 管理任务');

  await reply(lines.join('\n'));
}

/**
 * Handle pause subcommand
 * @param {string} taskId
 * @param {Function} reply
 */
async function handlePause(taskId, reply) {
  if (!taskId) {
    await reply('❌ 请提供任务 ID。用法: /jobs pause <任务ID>');
    return;
  }

  const trimmedId = taskId.trim();
  const task = findTaskById(trimmedId);

  if (!task) {
    await reply(`❌ 任务 \`${trimmedId}\` 不存在。`);
    return;
  }

  const success = scheduledTaskService.pauseTask(task.id);

  if (success) {
    await scheduledTaskService.saveTasks();
    await reply(`✅ 任务 \`${trimmedId}\` 已暂停。`);
  } else {
    await reply(`❌ 暂停任务失败。`);
  }
}

/**
 * Handle resume subcommand
 * @param {string} taskId
 * @param {Function} reply
 */
async function handleResume(taskId, reply) {
  if (!taskId) {
    await reply('❌ 请提供任务 ID。用法: /jobs resume <任务ID>');
    return;
  }

  const trimmedId = taskId.trim();
  const task = findTaskById(trimmedId);

  if (!task) {
    await reply(`❌ 任务 \`${trimmedId}\` 不存在。`);
    return;
  }

  const success = scheduledTaskService.resumeTask(task.id);

  if (success) {
    await scheduledTaskService.saveTasks();
    await reply(`✅ 任务 \`${trimmedId}\` 已恢复。`);
  } else {
    await reply(`❌ 恢复任务失败。`);
  }
}

/**
 * Handle delete subcommand
 * @param {string} taskId
 * @param {Function} reply
 */
async function handleDelete(taskId, reply) {
  if (!taskId) {
    await reply('❌ 请提供任务 ID。用法: /jobs delete <任务ID>');
    return;
  }

  const trimmedId = taskId.trim();
  const task = findTaskById(trimmedId);

  if (!task) {
    await reply(`❌ 任务 \`${trimmedId}\` 不存在。`);
    return;
  }

  const removed = scheduledTaskService.deleteTask(task.id);

  if (removed) {
    await scheduledTaskService.saveTasks();
    await reply(`✅ 任务 \`${trimmedId}\` 已删除。`);
  } else {
    await reply(`❌ 删除任务失败。`);
  }
}

/**
 * Find task by partial ID
 * @param {string} partialId
 * @returns {Object|null}
 */
function findTaskById(partialId) {
  const tasks = scheduledTaskService.listTasks();
  // First try exact match
  const exact = tasks.find(t => t.id === partialId);
  if (exact) return exact;
  // Then try prefix match
  return tasks.find(t => t.id.startsWith(partialId));
}

/**
 * Truncate string to max length
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

export default {
  jobsMeta,
  handleJobs,
  parseJobsSubcommand
};
