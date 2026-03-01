/**
 * LS Command Handler
 * F-010: File Manager
 *
 * Handles the /ls command for listing directory contents.
 */

import { listDirectory, formatFileInfo } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages, hasMorePages } from '../../../services/output-pager-service.js';
import { sessionStore } from '../../../services/session-store.js';

/**
 * LS command metadata.
 */
export const lsMeta = {
  name: 'ls',
  aliases: ['dir'],
  description: '列出目录内容',
  usage: '/ls [路径]',
  examples: ['/ls', '/ls /tmp', '/dir'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/ls [路径] - 列出目录内容（默认当前目录）'
};

/**
 * Handle /ls command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleLs(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Get the path argument (optional)
  const dirPath = args[0];

  // List directory
  const result = await listDirectory(dirPath, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Format output
  const lines = [
    `📂 目录: ${result.path}`,
    `共 ${result.totalCount} 项`,
    ''
  ];

  // Add each item
  for (const item of result.items) {
    lines.push(formatFileInfo(item));
  }

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
  lsMeta,
  handleLs
};
