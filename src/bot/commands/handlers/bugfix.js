/**
 * Bugfix Command Handler
 * Handles /bugfix shortcut command.
 */

import { handlePipeline } from './pipeline.js';

/**
 * Bugfix command metadata.
 */
export const bugfixMeta = {
  name: 'bugfix',
  aliases: ['b'],
  description: '启动 bugfix 管道',
  usage: '/bugfix <target>',
  examples: ['/bugfix session-123', '/bugfix F-001-login-bug'],
  params: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/bugfix <target> - 快捷启动 bugfix 管道'
};

/**
 * Handle bugfix command.
 * Delegates to pipeline handler with type=bugfix.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleBugfix(handlerCtx) {
  const { parsed, params } = handlerCtx;

  // Get target from positional args or params
  const target = params._args?.[0] || params.target;

  if (!target) {
    await handlerCtx.reply('❌ 缺少参数 \'target\'。\n用法: /bugfix <target>');
    return;
  }

  // Delegate to pipeline handler with type=bugfix
  const modifiedCtx = {
    ...handlerCtx,
    parsed: {
      ...parsed,
      subcommand: 'run'
    },
    params: {
      ...params,
      type: 'bugfix',
      target
    }
  };

  return handlePipeline(modifiedCtx);
}

export default handleBugfix;
