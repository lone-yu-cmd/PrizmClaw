/**
 * Cat Command Handler
 * F-010: File Manager
 *
 * Handles the /cat command for viewing file contents.
 */

import { readFile } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages } from '../../../services/output-pager-service.js';

/**
 * Cat command metadata.
 */
export const catMeta = {
  name: 'cat',
  aliases: [],
  description: '查看文件内容',
  usage: '/cat <文件路径>',
  examples: ['/cat /tmp/test.txt', '/cat ./README.md'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/cat <文件路径> - 查看文件内容（长文件自动分页）'
};

/**
 * Handle /cat command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCat(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Get the file path
  const filePath = args[0];

  if (!filePath) {
    await reply('❌ 请提供文件路径，例如: /cat /tmp/test.txt');
    return;
  }

  // Read file
  const result = await readFile(filePath, {}, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Format output
  const lines = [
    `📄 文件: ${result.path}`,
    `大小: ${result.size} 字节${result.lineCount ? `, ${result.lineCount} 行` : ''}`,
    ''
  ];

  // Check for binary
  if (result.isBinary) {
    lines.push('⚠️ 二进制文件，无法显示文本内容。');
    await reply(lines.join('\n'));
    return;
  }

  // Check for truncation
  if (result.truncated) {
    lines.push(`⚠️ 文件过大，仅显示前部分内容。`);
    lines.push('');
  }

  lines.push(result.content);

  const output = lines.join('\n');

  // Paginate if needed
  const pages = paginateOutput(output);
  await reply(pages[0]);

  if (pages.length > 1) {
    storeOutputPages(sessionId, pages.slice(1));
    await reply(`📄 内容已截断。使用 /more 查看更多内容。`);
  }
}

export default {
  catMeta,
  handleCat
};
