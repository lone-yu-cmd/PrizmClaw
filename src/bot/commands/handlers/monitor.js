/**
 * /monitor Command Handler
 * F-012: System Monitor
 *
 * Manages alert rules for system monitoring.
 */

import { alertManagerService } from '../../../services/alert-manager-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const monitorMeta = {
  name: 'monitor',
  aliases: [],
  description: '管理系统监控告警规则',
  usage: '/monitor <set|list|remove|enable|disable> [参数]',
  examples: [
    '/monitor set cpu>80',
    '/monitor set memory>=90',
    '/monitor list',
    '/monitor remove <规则ID>',
    '/monitor enable <规则ID>',
    '/monitor disable <规则ID>'
  ],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/monitor <子命令> [参数]\n' +
    '子命令:\n' +
    '  set <规则>      添加告警规则 (如 cpu>80, memory>=90)\n' +
    '  list           列出所有告警规则\n' +
    '  remove <ID>    删除规则\n' +
    '  enable <ID>    启用规则\n' +
    '  disable <ID>   禁用规则'
};

/**
 * Parse subcommand from arguments
 * @param {string[]} args
 * @returns {{subcommand: string, arg?: string}}
 */
export function parseSubcommand(args) {
  if (!args || args.length === 0) {
    return { subcommand: '' };
  }

  const subcommand = args[0].toLowerCase();
  const arg = args.slice(1).join(' ');

  return { subcommand, arg };
}

/**
 * Handle /monitor command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleMonitor(handlerCtx) {
  const { reply, args = [] } = handlerCtx;

  const { subcommand, arg } = parseSubcommand(args);

  switch (subcommand) {
    case 'set':
      await handleSet(arg, reply);
      break;
    case 'list':
      await handleList(reply);
      break;
    case 'remove':
      await handleRemove(arg, reply);
      break;
    case 'enable':
      await handleToggle(arg, true, reply);
      break;
    case 'disable':
      await handleToggle(arg, false, reply);
      break;
    default:
      await reply([
        '📋 *监控告警命令用法*',
        '',
        '```',
        '/monitor set <规则>    添加告警规则',
        '/monitor list          列出所有规则',
        '/monitor remove <ID>   删除规则',
        '/monitor enable <ID>   启用规则',
        '/monitor disable <ID>  禁用规则',
        '```',
        '',
        '规则格式: <指标><操作符><阈值>',
        '指标: cpu, memory, disk',
        '操作符: >, <, >=, <=',
        '示例: cpu>80, memory>=90, disk<10'
      ].join('\n'));
  }
}

/**
 * Handle set subcommand
 * @param {string} ruleString
 * @param {Function} reply
 */
async function handleSet(ruleString, reply) {
  if (!ruleString) {
    await reply('❌ 请提供规则。用法: /monitor set cpu>80');
    return;
  }

  try {
    const ruleData = alertManagerService.parseRuleString(ruleString);
    const rule = alertManagerService.addRule({
      ...ruleData,
      enabled: true
    });

    // Save rules
    await alertManagerService.saveRules();

    await reply([
      '✅ *告警规则已添加*',
      '',
      `ID: \`${rule.id}\``,
      `规则: ${rule.metric}${rule.operator}${rule.threshold}`,
      `状态: 启用`
    ].join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 添加规则失败: ${escapeMarkdownV2(message)}`);
  }
}

/**
 * Handle list subcommand
 * @param {Function} reply
 */
async function handleList(reply) {
  const rules = alertManagerService.listRules();

  if (rules.length === 0) {
    await reply('📋 当前没有配置任何告警规则。');
    return;
  }

  const lines = [
    `📋 *告警规则列表* (${rules.length})`,
    ''
  ];

  for (const rule of rules) {
    const status = rule.enabled ? '✅' : '⏸️';
    const lastTriggered = rule.lastTriggered
      ? new Date(rule.lastTriggered).toLocaleString()
      : '从未';
    lines.push(`${status} \`${rule.id}\``);
    lines.push(`   规则: ${rule.metric}${rule.operator}${rule.threshold}`);
    lines.push(`   最近触发: ${lastTriggered}`);
  }

  await reply(lines.join('\n'));
}

/**
 * Handle remove subcommand
 * @param {string} ruleId
 * @param {Function} reply
 */
async function handleRemove(ruleId, reply) {
  if (!ruleId) {
    await reply('❌ 请提供规则 ID。用法: /monitor remove <规则ID>');
    return;
  }

  const removed = alertManagerService.removeRule(ruleId.trim());

  if (removed) {
    await alertManagerService.saveRules();
    await reply(`✅ 规则 \`${ruleId}\` 已删除。`);
  } else {
    await reply(`❌ 规则 \`${ruleId}\` 不存在。`);
  }
}

/**
 * Handle enable/disable subcommand
 * @param {string} ruleId
 * @param {boolean} enable
 * @param {Function} reply
 */
async function handleToggle(ruleId, enable, reply) {
  if (!ruleId) {
    await reply(`❌ 请提供规则 ID。用法: /monitor ${enable ? 'enable' : 'disable'} <规则ID>`);
    return;
  }

  const success = enable
    ? alertManagerService.enableRule(ruleId.trim())
    : alertManagerService.disableRule(ruleId.trim());

  if (success) {
    await alertManagerService.saveRules();
    await reply(`✅ 规则 \`${ruleId}\` 已${enable ? '启用' : '禁用'}。`);
  } else {
    await reply(`❌ 规则 \`${ruleId}\` 不存在。`);
  }
}

export default {
  monitorMeta,
  handleMonitor,
  parseSubcommand
};
