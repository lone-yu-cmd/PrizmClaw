/**
 * Head Command Handler
 * F-010: File Manager
 *
 * Handles the /head command for viewing the first N lines of a file.
 */

import { readFile } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages } from '../../../services/output-pager-service.js';

/**
 * Head command metadata.
 */
export const headMeta = {
  name: 'head',
  aliases: [],
  description: '查看文件头部内容',
  usage: '/head [行数] <文件路径>',
  examples: ['/head /tmp/test.txt', '/head 20 /tmp/test.txt'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/head [行数] <文件路径> - 查看文件前N行（默认10行）'
};

const DEFAULT_LINES = 10;

/**
 * Parse head arguments
 * @param {string[]} args - Command arguments
 * @returns {{ lines: number, filePath: string | null }}
 */
function parseHeadArgs(args) {
  let lines = DEFAULT_LINES;
  let filePath = null;

  for (const arg of args) {
    // Check if it's a number (line count)
    const num = parseInt(arg, 10);
    if (!isNaN(num) && num > 0 && !filePath) {
      lines = num;
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  return { lines, filePath };
}

/**
 * Handle /head command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleHead(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Parse arguments
  const { lines, filePath } = parseHeadArgs(args);

  if (!filePath) {
    await reply('❌ 请提供文件路径，例如: /head /tmp/test.txt 或 /head 20 /tmp/test.txt');
    return;
  }

  // Read file with headLines option
  const result = await readFile(filePath, { headLines: lines }, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Check for binary
  if (result.isBinary) {
    await reply(`❌ 二进制文件，无法显示文本内容。`);
    return;
  }

  // Format output
  const outputLines = [
    `📄 文件: ${result.path} (前 ${lines} 行)`,
    ''
  ];

  outputLines.push(result.content);

  const output = outputLines.join('\n');

  // Paginate if needed
  const pages = paginateOutput(output);
  await reply(pages[0]);

  if (pages.length > 1) {
    storeOutputPages(sessionId, pages.slice(1));
    await reply(`📄 内容已截断。使用 /more 查看更多内容。`);
  }
}

export default {
  headMeta,
  handleHead
};
