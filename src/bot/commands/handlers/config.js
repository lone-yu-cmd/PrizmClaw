/**
 * Config Command Handler
 * F-017: Runtime Config Manager
 *
 * Handles the /config command for viewing and modifying runtime configuration.
 */

import { configService } from '../../../services/config-service.js';
import { isAdmin } from '../../../security/permission-guard.js';

/**
 * Config command metadata.
 */
export const configMeta = {
  name: 'config',
  aliases: ['cfg', 'settings'],
  description: '查看和修改运行时配置',
  usage: '/config [get|set|reset] [key] [value]',
  examples: [
    '/config',
    '/config get LOG_LEVEL',
    '/config set LOG_LEVEL=debug',
    '/config reset REQUEST_TIMEOUT_MS'
  ],
  subcommands: [
    { name: 'get', description: '获取指定配置值' },
    { name: 'set', description: '设置配置值（仅限安全配置项）' },
    { name: 'reset', description: '重置为原始值' }
  ],
  requiresAuth: true,
  minRole: 'admin',
  helpText: '/config - 查看和修改运行时配置（需要管理员权限）'
};

/**
 * Handle /config command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleConfig(handlerCtx) {
  const { reply, sessionId, args = [], userId } = handlerCtx;

  // Check admin permissions
  if (!isAdmin(userId)) {
    await reply('❌ 权限不足。此命令需要管理员权限。');
    return;
  }

  // Handle different subcommands
  if (args.length === 0) {
    await handleListConfig(reply);
  } else if (args[0] === 'get' && args.length >= 2) {
    await handleGetConfig(args[1], reply);
  } else if (args[0] === 'set' && args.length >= 2) {
    await handleSetConfig(args.slice(1).join(' '), reply, userId);
  } else if (args[0] === 'reset' && args.length >= 2) {
    await handleResetConfig(args[1], reply, userId);
  } else {
    await handleHelp(reply);
  }
}

/**
 * Handle listing all config values.
 * @param {Function} reply - Reply function
 */
async function handleListConfig(reply) {
  try {
    const allConfig = await configService.getAllConfig();

    // Format output
    const lines = ['📋 **当前配置值**', ''];

    // Group configs by category
    const categories = {
      '📊 日志设置': ['LOG_LEVEL'],
      '⏱️ 超时设置': ['REQUEST_TIMEOUT_MS', 'SESSION_TIMEOUT_MS', 'SYSTEM_MONITOR_INTERVAL_MS', 'TASK_DEBOUNCE_MS'],
      '🤖 AI CLI 设置': ['AI_CLI_HEARTBEAT_MS', 'MAX_PROMPT_CHARS', 'MAX_HISTORY_TURNS'],
      '🔒 安全设置': ['TELEGRAM_BOT_TOKEN', 'CODEBUDDY_BIN', 'WEB_HOST', 'WEB_PORT']
    };

    for (const [category, keys] of Object.entries(categories)) {
      lines.push(`**${category}**`);

      for (const key of keys) {
        if (allConfig[key] !== undefined) {
          const value = allConfig[key];
          lines.push(`  ${key}: \`${value}\``);
        }
      }

      lines.push('');
    }

    lines.push('💡 使用 `/config get <KEY>` 查看单个配置值');
    lines.push('⚙️ 使用 `/config set <KEY>=<VALUE>` 修改安全配置项');
    lines.push('🔄 使用 `/config reset <KEY>` 重置为原始值');

    await reply(lines.join('\n'));

  } catch (error) {
    await reply(`❌ 获取配置失败: ${error.message}`);
  }
}

/**
 * Handle getting specific config value.
 * @param {string} key - Config key
 * @param {Function} reply - Reply function
 */
async function handleGetConfig(key, reply) {
  try {
    const value = await configService.getConfig(key);

    if (value === null) {
      await reply(`❌ 未知的配置项: \`${key}\``);
      return;
    }

    await reply(`🔍 **${key}**: \`${value}\``);

  } catch (error) {
    await reply(`❌ 获取配置失败: ${error.message}`);
  }
}

/**
 * Handle setting config value.
 * @param {string} input - Input string in format "KEY=VALUE"
 * @param {Function} reply - Reply function
 * @param {string} userId - User ID for audit logging
 */
async function handleSetConfig(input, reply, userId) {
  try {
    // Parse key=value format
    const equalsIndex = input.indexOf('=');
    if (equalsIndex === -1) {
      await reply('❌ 格式错误。请使用: `/config set KEY=VALUE`');
      return;
    }

    const key = input.substring(0, equalsIndex).trim();
    const value = input.substring(equalsIndex + 1).trim();

    if (!key || !value) {
      await reply('❌ 配置项和值不能为空。');
      return;
    }

    // Check if key is safe to modify
    const isSafe = await configService.isSafeConfigKey(key);
    if (!isSafe) {
      await reply(`❌ 配置项 \`${key}\` 不允许在运行时修改。`);
      return;
    }

    const result = await configService.setConfig(key, value);

    if (result.success) {
      const message = [
        '✅ **配置修改成功**',
        `**配置项**: \`${key}\``,
        `**新值**: \`${result.newValue}\``,
        `**审计日志**: ${result.auditLog}`,
        '',
        '💡 修改已立即生效，无需重启服务。'
      ].join('\n');

      await reply(message);
    } else {
      await reply(`❌ 配置修改失败: ${result.error}`);
    }

  } catch (error) {
    await reply(`❌ 配置修改失败: ${error.message}`);
  }
}

/**
 * Handle resetting config to original value.
 * @param {string} key - Config key
 * @param {Function} reply - Reply function
 * @param {string} userId - User ID for audit logging
 */
async function handleResetConfig(key, reply, userId) {
  try {
    // Check if key is safe to modify
    const isSafe = await configService.isSafeConfigKey(key);
    if (!isSafe) {
      await reply(`❌ 配置项 \`${key}\` 不允许在运行时修改。`);
      return;
    }

    const result = await configService.resetConfig(key);

    if (result.success) {
      const message = [
        '🔄 **配置重置成功**',
        `**配置项**: \`${key}\``,
        `**恢复值**: \`${result.newValue}\``,
        `**审计日志**: ${result.auditLog}`
      ].join('\n');

      await reply(message);
    } else {
      await reply(`❌ 配置重置失败: ${result.error}`);
    }

  } catch (error) {
    await reply(`❌ 配置重置失败: ${error.message}`);
  }
}

/**
 * Show command help.
 * @param {Function} reply - Reply function
 */
async function handleHelp(reply) {
  const helpText = [
    '📋 **配置管理命令**',
    '',
    '**基本用法**:',
    '• `/config` - 查看所有配置值',
    '• `/config get <KEY>` - 查看指定配置值',
    '• `/config set <KEY>=<VALUE>` - 修改配置值',
    '• `/config reset <KEY>` - 重置为原始值',
    '',
    '**安全配置项**（可修改）:',
    '• `LOG_LEVEL` - 日志级别',
    '• `REQUEST_TIMEOUT_MS` - 请求超时时间',
    '• `AI_CLI_HEARTBEAT_MS` - AI CLI 心跳间隔',
    '• `MAX_PROMPT_CHARS` - 最大提示字符数',
    '• `MAX_HISTORY_TURNS` - 最大历史轮数',
    '• `SESSION_TIMEOUT_MS` - 会话超时时间',
    '• `SYSTEM_MONITOR_INTERVAL_MS` - 系统监控间隔',
    '• `TASK_DEBOUNCE_MS` - 任务防抖时间',
    '',
    '**敏感配置项**（仅查看）:',
    '• `TELEGRAM_BOT_TOKEN` - Telegram Bot Token',
    '• `CODEBUDDY_BIN` - CodeBuddy 路径',
    '• `WEB_HOST`, `WEB_PORT` - Web 服务设置',
    '',
    '💡 所有修改立即生效，无需重启服务。'
  ].join('\n');

  await reply(helpText);
}

export default {
  configMeta,
  handleConfig
};