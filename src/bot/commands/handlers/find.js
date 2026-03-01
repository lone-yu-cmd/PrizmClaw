/**
 * Find Command Handler
 * F-010: File Manager
 *
 * Handles the /find command for searching files by glob pattern.
 */

import { searchFiles, formatFileInfo } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages } from '../../../services/output-pager-service.js';
import { sessionStore } from '../../../services/session-store.js';
import { config } from '../../../config.js';

/**
 * Find command metadata.
 */
export const findMeta = {
  name: 'find',
  aliases: [],
  description: '搜索文件',
  usage: '/find <模式> [路径]',
  examples: ['/find *.txt', '/find *.js /tmp', '/find **/*.test.js'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/find <模式> [路径] - 按文件名或glob模式搜索文件'
};

/**
 * Parse find arguments
 * @param {string[]} args - Command arguments
 * @returns {{ pattern: string | null, cwd: string | null }}
 */
function parseFindArgs(args) {
  if (!args || args.length === 0) {
    return { pattern: null, cwd: null };
  }

  // First arg is pattern, second is optional directory
  const pattern = args[0];
  const cwd = args.length > 1 ? args[1] : null;

  return { pattern, cwd };
}

/**
 * Handle /find command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleFind(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Parse arguments
  const { pattern, cwd } = parseFindArgs(args);

  if (!pattern) {
    await reply('❌ 请提供搜索模式，例如: /find *.txt 或 /find **/*.js');
    return;
  }

  // Search options
  const options = {
    maxDepth: config.fileMaxSearchDepth || 10,
    maxResults: config.fileMaxSearchResults || 100,
    cwd
  };

  // Perform search
  const result = await searchFiles(pattern, options, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Store results in session for pagination
  if (result.results.length > 0) {
    sessionStore.setSearchResults(sessionId, result.results);
  }

  // Format output
  const lines = [
    `🔍 搜索: ${pattern}`,
    `找到 ${result.totalCount} 个结果${result.truncated ? ' (已截断)' : ''}`,
    ''
  ];

  // Show first page of results
  const perPage = config.fileSearchResultsPerPage || 20;
  const displayResults = result.results.slice(0, perPage);

  for (const item of displayResults) {
    lines.push(`${item.isDirectory ? '📁' : '📄'} ${item.relativePath} (${item.size} 字节)`);
  }

  if (result.results.length > perPage) {
    lines.push('');
    lines.push(`显示前 ${perPage} 个结果。使用 /more 查看更多。`);
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
  findMeta,
  handleFind
};
