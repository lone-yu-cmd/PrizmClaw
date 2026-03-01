/**
 * /sysinfo Command Handler
 * F-012: System Monitor
 *
 * Returns system overview including CPU, memory, disk, and network status.
 */

import { systemMonitorService } from '../../../services/system-monitor-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const sysinfoMeta = {
  name: 'sysinfo',
  aliases: ['si'],
  description: '查看系统状态概览（CPU、内存、磁盘、网络）',
  usage: '/sysinfo',
  examples: ['/sysinfo'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/sysinfo - 查看系统状态概览（CPU、内存、磁盘、网络）'
};

/**
 * Handle /sysinfo command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleSysinfo(handlerCtx) {
  const { reply } = handlerCtx;

  try {
    const info = await systemMonitorService.getSystemInfo();

    // Format as table
    const lines = [
      '📊 *系统状态概览*',
      '',
      `🖥️ *主机*: ${escapeMarkdownV2(info.hostname)}`,
      `⏱️ *运行时间*: ${systemMonitorService.formatUptime(info.uptime)}`,
      `💻 *平台*: ${escapeMarkdownV2(info.platform)}`,
      '',
      '*CPU*',
      `├ 型号: ${escapeMarkdownV2(info.cpu.model)}`,
      `├ 核心数: ${info.cpu.cores}`,
      `└ 使用率: ${info.cpu.usage.toFixed(1)}%`,
      '',
      '*内存*',
      `├ 总量: ${systemMonitorService.formatBytes(info.memory.total)}`,
      `├ 已用: ${systemMonitorService.formatBytes(info.memory.used)}`,
      `├ 空闲: ${systemMonitorService.formatBytes(info.memory.free)}`,
      `└ 使用率: ${info.memory.usagePercent.toFixed(1)}%`,
      '',
      '*磁盘*',
      `├ 总量: ${systemMonitorService.formatBytes(info.disk.total)}`,
      `├ 已用: ${systemMonitorService.formatBytes(info.disk.used)}`,
      `├ 空闲: ${systemMonitorService.formatBytes(info.disk.free)}`,
      `└ 使用率: ${info.disk.usagePercent.toFixed(1)}%`,
      '',
      '*网络*',
      `└ 接口: ${info.network.interfaces.join(', ') || 'N/A'}`
    ];

    await reply(lines.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 获取系统信息失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  sysinfoMeta,
  handleSysinfo
};
