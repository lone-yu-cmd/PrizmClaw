/**
 * /ps Command Handler
 * F-012: System Monitor
 *
 * Returns process list with sorting and filtering options.
 */

import { systemMonitorService } from '../../../services/system-monitor-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const psMeta = {
  name: 'ps',
  aliases: [],
  description: '查看进程列表（支持排序和过滤）',
  usage: '/ps [--sort=cpu|memory] [--limit=N] [filter]',
  examples: ['/ps', '/ps --sort=memory', '/ps node', '/ps --sort=cpu --limit=10'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/ps [选项] [关键词] - 查看进程列表\n选项:\n  --sort=cpu|memory  按CPU或内存排序\n  --limit=N          限制显示数量'
};

const DEFAULT_LIMIT = 20;

/**
 * Parse command arguments into options
 * @param {string[]} args
 * @returns {{sortBy: string, limit: number, filter: string}}
 */
export function parseOptions(args) {
  let sortBy = 'cpu';
  let limit = DEFAULT_LIMIT;
  const filterParts = [];

  for (const arg of args) {
    if (arg.startsWith('--sort=')) {
      const value = arg.slice(7).toLowerCase();
      if (['cpu', 'memory'].includes(value)) {
        sortBy = value;
      }
    } else if (arg.startsWith('--limit=')) {
      const value = parseInt(arg.slice(8), 10);
      if (!isNaN(value) && value > 0 && value <= 100) {
        limit = value;
      }
    } else {
      filterParts.push(arg);
    }
  }

  return {
    sortBy,
    limit,
    filter: filterParts.join(' ')
  };
}

/**
 * Handle /ps command
 * @param {Object} handlerCtx - Handler context
 */
export async function handlePs(handlerCtx) {
  const { reply, args = [] } = handlerCtx;

  try {
    const options = parseOptions(args);
    const processes = await systemMonitorService.getProcessList(options);

    if (processes.length === 0) {
      if (options.filter) {
        await reply(`🔍 未找到匹配 "${escapeMarkdownV2(options.filter)}" 的进程。`);
      } else {
        await reply('📋 未找到任何进程。');
      }
      return;
    }

    // Format as table
    const lines = [
      `📋 *进程列表* ${options.filter ? `\(过滤: "${escapeMarkdownV2(options.filter)}")` : ''}`,
      `排序: ${options.sortBy === 'cpu' ? 'CPU' : '内存'} | 显示: ${processes.length}`,
      '',
      '```\nPID      CPU%   MEM%   NAME',
      '-'.repeat(40)
    ];

    for (const proc of processes) {
      const pid = String(proc.pid).padEnd(8);
      const cpu = `${proc.cpu.toFixed(1)}%`.padEnd(6);
      const mem = `${proc.memory.toFixed(1)}%`.padEnd(6);
      const name = proc.name.substring(0, 20);
      lines.push(`${pid}${cpu}${mem}${name}`);
    }

    lines.push('```');

    await reply(lines.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 获取进程列表失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  psMeta,
  handlePs,
  parseOptions
};
