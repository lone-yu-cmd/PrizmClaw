/**
 * Command Router
 * Main entry point for command routing and dispatch.
 */

import { parseCommand } from './parser.js';
import { getCommand, getAliasMap, registerCommand } from './registry.js';
import { validateCommand } from './validator.js';
import { formatError, formatValidationErrors, formatNLSuggestions, ErrorCodes } from './formatter.js';
import { routeIntent, enhanceSlashCommand } from './intent-router.js';
import { isAllowedUser } from '../../security/guard.js';
import { checkCommandPermission, getUserRole } from '../../security/permission-guard.js';
import { logAuditEntry } from '../../services/audit-log-service.js';
import { aliasStore } from '../../services/alias-store.js';
import { sessionStore } from '../../services/session-store.js';

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 * @typedef {import('./registry.js').CommandMeta} CommandMeta
 * @typedef {import('./registry.js').CommandEntry} CommandEntry
 */

/**
 * Build session ID from context.
 * @param {Object} ctx - Telegraf context
 * @returns {string} Session ID
 */
function buildSessionId(ctx) {
  return String(ctx.chat.id);
}

/**
 * Build prefixed session key for session store operations.
 * @param {Object} ctx - Telegraf context
 * @returns {string} Prefixed session key
 */
function buildSessionKey(ctx) {
  return `telegram:${ctx.chat.id}`;
}

/**
 * Route and dispatch a command from Telegram context.
 *
 * Supports three input modes:
 *  1. Structured slash command:      /pipeline run my-feature  → parse + validate + dispatch
 *  2. Slash + NL supplement:         /pipeline 帮我看日志         → intent-router enhances subcommand
 *  3. Pure natural language (no /):  帮我看看 pipeline 状态       → intent-router routes + dispatch
 *
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<boolean>} True if command was handled
 */
export async function routeCommand(ctx) {
  let text = ctx.message?.text;

  if (!text) {
    return false;
  }

  const isPureNL = !text.startsWith('/');

  // ── Authorization check (both slash and pure-NL paths) ───────────────────
  const userId = ctx.from?.id;
  if (!isAuthorized(userId)) {
    if (!isPureNL) {
      // Only block slash commands with auth error; pure NL falls through to chat
      await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNAUTHORIZED)));
      return true;
    }
    return false;
  }

  // ── Pure Natural Language path ────────────────────────────────────────────
  if (isPureNL) {
    return routePureNL(ctx, text, userId);
  }

  // ── Slash command path ────────────────────────────────────────────────────
  const sessionId = buildSessionKey(ctx);
  const userIdStr = String(userId);

  // F-013: Touch session on each command
  sessionStore.touchSession(sessionId, userIdStr);

  // F-013: Resolve alias if the command name is an alias
  const commandMatch = text.match(/^\/(\S+)/);
  if (commandMatch) {
    const potentialAlias = commandMatch[1].toLowerCase();
    const resolvedCommand = aliasStore.resolveAlias(userIdStr, potentialAlias);
    if (resolvedCommand) {
      // Replace the alias with the resolved command
      const args = text.slice(commandMatch[0].length);
      text = `/${resolvedCommand}${args}`;
    }
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
    // F-015: Unknown command — try intent routing on the full text
    const nlResult = routeIntent(text);
    if (nlResult.matched && !nlResult.needsConfirmation && nlResult.primary) {
      // High confidence: synthesize and dispatch
      return dispatchParsedIntent(ctx, nlResult.primary, userId, sessionId);
    } else if (nlResult.matched) {
      // Low confidence: present suggestions instead of bare "unknown command"
      await ctx.reply(formatNLSuggestions(nlResult));
      return true;
    }

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

  // F-015: Slash + NL Enhancement
  // When the subcommand is present but does not match any declared subcommand,
  // attempt to infer the intended subcommand via the intent router.
  let effectiveParsed = parsed;
  if (
    meta.subcommands?.length > 0 &&
    parsed.subcommand &&
    !meta.subcommands.some((s) => s.name === parsed.subcommand)
  ) {
    // The subcommand token appears to be natural language
    const nlText = `${parsed.subcommand} ${parsed.args.join(' ')}`.trim();
    const nlResult = enhanceSlashCommand(parsed.command, nlText);

    if (nlResult.matched && nlResult.primary?.subcommand) {
      if (!nlResult.needsConfirmation) {
        // High confidence: silently correct the subcommand
        effectiveParsed = {
          ...parsed,
          subcommand: nlResult.primary.subcommand,
          args: nlResult.primary.args || parsed.args
        };
      } else {
        // Low confidence: show candidates and let user decide
        await ctx.reply(formatNLSuggestions(nlResult));
        return true;
      }
    }
    // If no match, fall through to normal validation (which will produce an error)
  }

  // Validate command
  const validation = validateCommand(effectiveParsed, meta);

  if (!validation.valid) {
    // F-015: If validation fails due to invalid subcommand and we haven't tried NL yet,
    // try enhancing and give suggestion
    const hasSubcommandError = validation.errors.some((e) => e.param === 'subcommand');
    if (hasSubcommandError && meta.subcommands?.length > 0 && parsed.subcommand) {
      const nlText = `${parsed.subcommand} ${parsed.args.join(' ')}`.trim();
      const nlResult = enhanceSlashCommand(parsed.command, nlText);
      if (nlResult.matched) {
        await ctx.reply(formatNLSuggestions(nlResult));
        return true;
      }
    }

    const errorMsg = formatValidationErrors(validation.errors, meta.usage);
    await ctx.reply(errorMsg);
    return true;
  }

  // Create handler context
  const handlerContext = {
    ctx,
    parsed: effectiveParsed,
    meta,
    params: validation.normalized || {},
    userId,
    userRole: getUserRole(userId),
    sessionId,
    requiresConfirmation: permResult.requiresConfirmation,
    reply: async (text) => ctx.reply(text),
    replyFile: async (content, filename) => {
      // Will be implemented with proper file handling
      await ctx.replyWithDocument({ source: Buffer.from(content), filename });
    },
    args: effectiveParsed.args || []
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
 * Handle pure natural language input (no leading slash).
 * Routes via intent-router and dispatches if confidence is high enough.
 *
 * @param {Object} ctx - Telegraf context
 * @param {string} text - Message text
 * @param {number|string|undefined} userId - User ID
 * @returns {Promise<boolean>} True if handled
 */
async function routePureNL(ctx, text, userId) {
  const nlResult = routeIntent(text);

  if (!nlResult.matched) {
    // No recognizable intent — fall through to chat
    return false;
  }

  const sessionId = buildSessionKey(ctx);

  if (!nlResult.needsConfirmation && nlResult.primary) {
    // High confidence: dispatch directly
    return dispatchParsedIntent(ctx, nlResult.primary, userId, sessionId);
  }

  // Low confidence or ambiguous: present candidates
  await ctx.reply(formatNLSuggestions(nlResult));
  return true;
}

/**
 * Synthesize a ParsedCommand from an IntentCandidate and dispatch through the normal chain.
 *
 * @param {Object} ctx - Telegraf context
 * @param {import('./intent-router.js').IntentCandidate} candidate - Intent candidate
 * @param {number|string|undefined} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Always true (handled)
 */
async function dispatchParsedIntent(ctx, candidate, userId, sessionId) {
  const entry = getCommand(candidate.command);
  if (!entry) {
    // Command not registered — present error
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNKNOWN_COMMAND, { command: candidate.command })));
    return true;
  }

  const { meta, handler } = entry;

  // Permission check
  const permResult = checkCommandPermission(userId, meta.name);
  if (!permResult.allowed) {
    await logAuditEntry({
      userId,
      action: meta.name,
      params: {},
      result: 'denied',
      reason: permResult.reason
    });
    await ctx.reply(`⛔ ${permResult.reason}`);
    return true;
  }

  // Build synthetic parsed command
  /** @type {import('./parser.js').ParsedCommand} */
  const syntheticParsed = {
    command: candidate.command,
    subcommand: candidate.subcommand,
    args: candidate.args || [],
    options: {},
    raw: ctx.message?.text || ''
  };

  const validation = validateCommand(syntheticParsed, meta);

  if (!validation.valid) {
    const errorMsg = formatValidationErrors(validation.errors, meta.usage);
    await ctx.reply(errorMsg);
    return true;
  }

  const handlerContext = {
    ctx,
    parsed: syntheticParsed,
    meta,
    params: validation.normalized || {},
    userId,
    userRole: getUserRole(userId),
    sessionId,
    requiresConfirmation: permResult.requiresConfirmation,
    reply: async (text) => ctx.reply(text),
    replyFile: async (content, filename) => {
      await ctx.replyWithDocument({ source: Buffer.from(content), filename });
    },
    args: syntheticParsed.args || []
  };

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
