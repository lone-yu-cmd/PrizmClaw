/**
 * Tail Command Handler
 * F-010: File Manager
 *
 * Handles the /tail command for viewing the last N lines of a file.
 */

import { readFile } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages } from '../../../services/output-pager-service.js';

/**
 * Tail command metadata.
 */
export const tailMeta = {
  name: 'tail',
  aliases: [],
  description: '查看文件尾部内容',
  usage: '/tail [行数] <文件路径>',
  examples: ['/tail /tmp/test.txt', '/tail 20 /tmp/test.txt'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/tail [行数] <文件路径> - 查看文件后N行（默认10行）'
};

const DEFAULT_LINES = 10;

/**
 * Parse tail arguments
 * @param {string[]} args - Command arguments
 * @returns {{ lines: number, filePath: string | null }}
 */
function parseTailArgs(args) {
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
 * Handle /tail command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleTail(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Parse arguments
  const { lines, filePath } = parseTailArgs(args);

  if (!filePath) {
    await reply('❌ 请提供文件路径，例如: /tail /tmp/test.txt 或 /tail 20 /tmp/test.txt');
    return;
  }

  // Read file with tailLines option
  const result = await readFile(filePath, { tailLines: lines }, sessionId);

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
    `📄 文件: ${result.path} (后 ${lines} 行)`,
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
  tailMeta,
  handleTail
};
