/**
 * CD Command Handler
 * F-009: General Command Executor
 *
 * Handles the /cd command for changing the session's working directory.
 */

import { access } from 'node:fs/promises';
import path from 'node:path';
import { sessionStore } from '../../../services/session-store.js';

/**
 * CD command metadata.
 */
export const cdMeta = {
  name: 'cd',
  aliases: [],
  description: '切换工作目录',
  usage: '/cd <路径>',
  examples: ['/cd /tmp', '/cd ~', '/cd ..'],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/cd <路径> - 切换工作目录（不带参数显示当前目录）'
};

/**
 * Handle /cd command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCd(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Get the path argument
  const targetPath = args[0];

  // If no path provided, show current directory
  if (!targetPath) {
    const currentCwd = sessionStore.getCwd(sessionId) || process.cwd();
    await reply(`当前工作目录: ${currentCwd}`);
    return;
  }

  // Resolve the path (handle ~, relative paths)
  let resolvedPath = targetPath;

  // Handle home directory expansion
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || process.env.USERPROFILE || '', resolvedPath.slice(1));
  }

  // Make absolute path if relative
  if (!path.isAbsolute(resolvedPath)) {
    const currentCwd = sessionStore.getCwd(sessionId) || process.cwd();
    resolvedPath = path.resolve(currentCwd, resolvedPath);
  }

  // Normalize the path
  resolvedPath = path.normalize(resolvedPath);

  // Check if directory exists
  try {
    await access(resolvedPath);
  } catch {
    await reply(`❌ 目录不存在或无法访问: ${resolvedPath}`);
    return;
  }

  // Update session cwd
  sessionStore.setCwd(sessionId, resolvedPath);

  await reply(`✅ 工作目录已切换至: ${resolvedPath}`);
}

export default {
  cdMeta,
  handleCd
};
