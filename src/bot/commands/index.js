/**
 * Command Router
 * Main entry point for command routing and dispatch.
 */

import { parseCommand } from './parser.js';
import { getCommand, getAliasMap, registerCommand } from './registry.js';
import { validateCommand } from './validator.js';
import { formatError, formatValidationErrors, ErrorCodes } from './formatter.js';
import { isAllowedUser } from '../../security/guard.js';
import { checkCommandPermission, getUserRole } from '../../security/permission-guard.js';
import { logAuditEntry } from '../../services/audit-log-service.js';

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 * @typedef {import('./registry.js').CommandMeta} CommandMeta
 * @typedef {import('./registry.js').CommandEntry} CommandEntry
 */

/**
 * Route and dispatch a command from Telegram context.
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<boolean>} True if command was handled
 */
export async function routeCommand(ctx) {
  const text = ctx.message?.text;

  if (!text || !text.startsWith('/')) {
    return false;
  }

  // Authorization check
  const userId = ctx.from?.id;
  if (!isAuthorized(userId)) {
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNAUTHORIZED)));
    return true;
  }

  // Parse command
  const aliasMap = getAliasMap();
  const parsed = parseCommand(text, aliasMap);

  if (!parsed) {
    await ctx.reply('无法解析命令。');
    return true;
  }

  // Lookup command
  const entry = getCommand(parsed.command);

  if (!entry) {
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNKNOWN_COMMAND, { command: parsed.command })));
    return true;
  }

  const { meta, handler } = entry;

  // T-101: Permission check
  const commandName = meta.name;
  const permResult = checkCommandPermission(userId, commandName);

  if (!permResult.allowed) {
    // Log denied access
    await logAuditEntry({
      userId,
      action: commandName,
      params: {},
      result: 'denied',
      reason: permResult.reason
    });

    await ctx.reply(`⛔ ${permResult.reason}`);
    return true;
  }

  // Validate command
  const validation = validateCommand(parsed, meta);

  if (!validation.valid) {
    const errorMsg = formatValidationErrors(validation.errors, meta.usage);
    await ctx.reply(errorMsg);
    return true;
  }

  // Create handler context
  const handlerContext = {
    ctx,
    parsed,
    meta,
    params: validation.normalized || {},
    userId,
    userRole: getUserRole(userId),
    requiresConfirmation: permResult.requiresConfirmation,
    reply: async (text) => ctx.reply(text),
    replyFile: async (content, filename) => {
      // Will be implemented with proper file handling
      await ctx.replyWithDocument({ source: Buffer.from(content), filename });
    }
  };

  // Dispatch to handler
  try {
    await handler(handlerContext);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.INTERNAL_ERROR, { reason: message })));
  }

  return true;
}

/**
 * Check if user is authorized.
 * @param {number|string|undefined} userId - User ID
 * @returns {boolean} True if authorized
 */
function isAuthorized(userId) {
  return isAllowedUser(userId);
}

/**
 * Format error response for display.
 * @param {Object} error - Error object
 * @returns {string} Formatted error
 */
function formatErrorResponse(error) {
  const lines = [`❌ ${error.message}`];

  if (error.suggestion) {
    lines.push(`💡 ${error.suggestion}`);
  }

  if (error.usage) {
    lines.push(`用法: ${error.usage}`);
  }

  return lines.join('\n');
}

/**
 * Register all default commands.
 */
export function registerDefaultCommands() {
  // Commands will be registered by individual handlers
  // This is called during initialization
}

/**
 * Create middleware for command routing.
 * @returns {Function} Middleware function
 */
export function createCommandMiddleware() {
  return async (ctx, next) => {
    const handled = await routeCommand(ctx);
    if (!handled) {
      return next();
    }
  };
}

// Re-export for convenience
export { registerCommand, getCommand, getAliasMap };
