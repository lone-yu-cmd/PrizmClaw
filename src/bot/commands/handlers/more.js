/**
 * More Command Handler
 * F-009: General Command Executor
 *
 * Handles the /more command for viewing paginated command output.
 */

import { getNextPage, hasMorePages } from '../../../services/output-pager-service.js';

/**
 * More command metadata.
 */
export const moreMeta = {
  name: 'more',
  aliases: [],
  description: '查看更多输出内容',
  usage: '/more',
  examples: ['/more'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/more - 查看更多输出内容（用于长输出的分页显示）'
};

/**
 * Handle /more command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleMore(handlerCtx) {
  const { reply, sessionId } = handlerCtx;

  // Check if there are more pages
  if (!hasMorePages(sessionId)) {
    await reply('没有更多输出内容。');
    return;
  }

  // Get the next page
  const page = getNextPage(sessionId);

  if (page === null) {
    await reply('没有更多输出内容。');
    return;
  }

  // Send the page
  await reply(page);
}

export default {
  moreMeta,
  handleMore
};
