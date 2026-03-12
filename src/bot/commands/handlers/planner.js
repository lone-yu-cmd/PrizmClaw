/**
 * Planner Command Handler
 * Handles /planner command for planner-type pipelines.
 */

import { handlePipeline } from './pipeline.js';

/**
 * Planner command metadata.
 */
export const plannerMeta = {
  name: 'planner',
  aliases: [],
  description: '管理 planner 管道',
  usage: '/planner <action> [target]',
  examples: ['/planner run my-feature', '/planner status', '/planner logs'],
  subcommands: [
    { name: 'run', description: '启动 planner 管道' },
    { name: 'status', description: '查询状态' },
    { name: 'logs', description: '查看日志' }
  ],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/planner <action> [target] - 管理 planner 管道'
};

/**
 * Handle planner command.
 * Delegates to pipeline handler with type=planner.
 * @param {Object} handlerCtx - Handler context
 */
export async function handlePlanner(handlerCtx) {
  const { parsed, params } = handlerCtx;

  // Determine action
  const _action = parsed.subcommand || 'status';

  // For non-run actions, just use pipeline handler with planner type
  const modifiedCtx = {
    ...handlerCtx,
    params: {
      ...params,
      type: 'planner'
    }
  };

  // If no subcommand and no target, default to status
  if (!parsed.subcommand) {
    modifiedCtx.parsed = {
      ...parsed,
      subcommand: 'status'
    };
  }

  return handlePipeline(modifiedCtx);
}

export default handlePlanner;
