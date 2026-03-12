/**
 * Tree Command Handler
 * F-010: File Manager
 *
 * Handles the /tree command for displaying directory tree structure.
 */

import { buildTree } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages } from '../../../services/output-pager-service.js';
import { config } from '../../../config.js';

/**
 * Tree command metadata.
 */
export const treeMeta = {
  name: 'tree',
  aliases: [],
  description: '显示目录树结构',
  usage: '/tree [路径] [--depth=N]',
  examples: ['/tree', '/tree /tmp', '/tree --depth=5'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/tree [路径] [--depth=N] - 显示目录树结构（默认深度3层）'
};

/**
 * Parse --depth=N option from args
 * @param {string[]} args - Command arguments
 * @returns {{ depth: number | null, pathArgs: string[] }}
 */
function parseTreeArgs(args) {
  let depth = null;
  const pathArgs = [];

  for (const arg of args) {
    if (arg.startsWith('--depth=')) {
      const depthValue = parseInt(arg.slice(8), 10);
      if (!isNaN(depthValue) && depthValue > 0) {
        depth = depthValue;
      }
    } else {
      pathArgs.push(arg);
    }
  }

  return { depth, pathArgs };
}

/**
 * Handle /tree command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleTree(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Parse arguments
  const { depth, pathArgs } = parseTreeArgs(args);
  const dirPath = pathArgs[0];

  // Build tree options
  const options = {
    maxDepth: depth || config.fileMaxTreeDepth || 3,
    maxItems: config.fileMaxTreeItems || 100
  };

  // Build tree
  const result = await buildTree(dirPath, options, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Format output
  const lines = [
    `📂 目录树: ${result.path}`,
    `深度: ${result.depth}, 项目数: ${result.itemCount}${result.truncated ? ' (已截断)' : ''}`,
    ''
  ];

  lines.push(result.tree);

  const output = lines.join('\n');

  // Paginate if needed
  const pages = paginateOutput(output);
  await reply(pages[0]);

  if (pages.length > 1) {
    storeOutputPages(sessionId, pages.slice(1));
    await reply(`📄 输出已截断。使用 /more 查看更多内容。`);
  }
}

export default {
  treeMeta,
  handleTree
};
