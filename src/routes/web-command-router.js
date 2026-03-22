/**
 * Web Command Router
 * F-019: Routes slash commands from Web chat to existing command handlers.
 * Adapts the Telegram-centric handler context for web usage.
 */

import { parseCommand } from '../bot/commands/parser.js';
import { getCommand, getAllCommands, getAliasMap } from '../bot/commands/registry.js';
import { validateCommand } from '../bot/commands/validator.js';
import { executeSystemCommand } from '../services/system-exec-service.js';

/**
 * Escape HTML special characters for safe web display.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format command output for web display.
 * Wraps multi-line output in <pre> blocks.
 * @param {string} text
 * @returns {string}
 */
function formatForWeb(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  // If multi-line or looks like code output, wrap in pre
  if (text.includes('\n') || text.includes('\t')) {
    return `<pre>${escaped}</pre>`;
  }
  return escaped;
}

/**
 * Handle the /exec command for web — executes a system command.
 * @param {string[]} args - Command arguments (rest after /exec)
 * @returns {Promise<string>} HTML-formatted output
 */
async function handleExecCommand(args) {
  if (!args || args.length === 0) {
    return escapeHtml('用法: /exec <command>');
  }

  const command = args.join(' ');

  try {
    const result = await executeSystemCommand(command);
    const parts = [];

    if (result.stdout?.trim()) {
      parts.push(`<pre>${escapeHtml(result.stdout)}</pre>`);
    }
    if (result.stderr?.trim()) {
      parts.push(`<pre class="stderr">${escapeHtml(result.stderr)}</pre>`);
    }

    const exitInfo = `<span class="exit-code">Exit: ${result.exitCode}</span>`;
    parts.push(exitInfo);

    return parts.join('\n') || escapeHtml('(no output)');
  } catch (error) {
    return escapeHtml(`❌ 执行失败: ${error.message}`);
  }
}

/**
 * Route and dispatch a web slash command.
 * Returns HTML-formatted result string, or null if not a slash command.
 *
 * @param {string} message - User message text
 * @param {string} sessionId - Web session ID
 * @returns {Promise<string|null>} HTML result or null if not a command
 */
export async function routeWebCommand(message, sessionId) {
  if (!message || !message.startsWith('/')) {
    return null;
  }

  const text = message.trim();
  const aliasMap = getAliasMap();
  const parsed = parseCommand(text, aliasMap);

  if (!parsed) {
    return null;
  }

  // Handle /exec specially — maps to system exec service
  if (parsed.command === 'exec') {
    const args = [
      ...(parsed.subcommand ? [parsed.subcommand] : []),
      ...parsed.args
    ];
    return handleExecCommand(args);
  }

  // Look up registered command
  const entry = getCommand(parsed.command);

  if (!entry) {
    return escapeHtml(`❌ 未知命令: /${parsed.command}。输入 / 查看可用命令。`);
  }

  const { meta, handler } = entry;

  // Validate command
  const validation = validateCommand(parsed, meta);
  if (!validation.valid) {
    const errors = validation.errors.map((e) => e.message || e.param).join(', ');
    return escapeHtml(`❌ 命令参数错误: ${errors}\n用法: ${meta.usage}`);
  }

  // Collect output via reply collector
  const outputParts = [];

  const webHandlerCtx = {
    ctx: null, // No Telegram context for web
    parsed,
    meta,
    params: validation.normalized || {},
    userId: null, // No Telegram user for web
    userRole: 'operator', // Default role for web users
    sessionId,
    requiresConfirmation: false,
    reply: async (text) => {
      outputParts.push(formatForWeb(text));
    },
    replyFile: async (content, filename) => {
      outputParts.push(escapeHtml(`[文件: ${filename}]`));
    },
    args: parsed.args || []
  };

  try {
    await handler(webHandlerCtx);
  } catch (error) {
    return escapeHtml(`❌ 命令执行错误: ${error.message}`);
  }

  return outputParts.join('\n') || escapeHtml('(命令已执行，无输出)');
}

/**
 * Get the list of available commands for autocomplete.
 * @returns {Array<{name: string, aliases: string[], description: string, usage: string}>}
 */
export function getAvailableCommands() {
  const registered = getAllCommands().map((entry) => ({
    name: entry.meta.name,
    aliases: entry.meta.aliases || [],
    description: entry.meta.description || '',
    usage: entry.meta.usage || `/${entry.meta.name}`
  }));

  // Add /exec which is handled directly (not in registry)
  const execCommand = {
    name: 'exec',
    aliases: [],
    description: '执行系统命令',
    usage: '/exec <command>'
  };

  return [execCommand, ...registered];
}
