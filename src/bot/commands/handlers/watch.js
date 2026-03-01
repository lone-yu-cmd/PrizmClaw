/**
 * /watch Command Handler
 * F-014: Notification and Scheduled Tasks
 *
 * Handles file system monitoring with /watch and /unwatch commands.
 */

import { fileWatcherService } from '../../../services/file-watcher-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';
import { config } from '../../../config.js';
import { resolve, relative } from 'node:path';

export const watchMeta = {
  name: 'watch',
  aliases: [],
  description: '监听文件或目录变更',
  usage: '/watch <路径> | /unwatch <路径|ID>',
  examples: [
    '/watch /path/to/file.txt',
    '/watch /path/to/directory',
    '/unwatch /path/to/file.txt',
    '/unwatch abc123'
  ],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/watch <路径>  监听文件或目录变更\n' +
    '/unwatch <路径|ID>  取消监听\n' +
    '\n' +
    '监听的路径必须在允许的根目录范围内。'
};

/**
 * Handle /watch command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleWatch(handlerCtx) {
  const { reply, args = [], from, chat } = handlerCtx;

  if (args.length === 0) {
    await reply([
      '📁 *文件监听命令用法*',
      '',
      '```',
      '/watch <路径>    监听文件或目录',
      '/unwatch <路径>  取消监听',
      '```',
      '',
      '监听的路径必须在允许的根目录范围内。',
      '',
      '使用 /watch list 查看当前所有监听'
    ].join('\n'));
    return;
  }

  // Handle list subcommand
  if (args[0].toLowerCase() === 'list') {
    await handleList(reply, String(chat.id));
    return;
  }

  // Handle unwatch
  if (args[0].toLowerCase() === 'unwatch' || args[0].toLowerCase() === 'remove') {
    await handleUnwatch(args.slice(1).join(' '), reply, String(chat.id));
    return;
  }

  // Handle watch add
  const watchPath = args.join(' ');

  try {
    const chatId = String(chat.id);
    const userId = String(from.id);

    // Resolve relative path if needed
    const resolvedPath = resolve(watchPath);

    // Use config allowed roots if available, otherwise allow all
    const allowedRoots = config.telegramFileAllowedRoots.length > 0
      ? config.telegramFileAllowedRoots
      : null;

    // Initialize service if needed
    if (!fileWatcherService.isInitialized()) {
      fileWatcherService.initFileWatcherService({
        dataDir: config.systemMonitorDataDir,
        watchersFile: config.fileWatchersPath,
        maxWatchers: config.maxFileWatchers,
        debounceMs: config.taskDebounceMs,
        allowedRoots: allowedRoots || [process.cwd()]
      });
    }

    const watcher = await fileWatcherService.addWatch({
      path: resolvedPath,
      chatId,
      userId,
      recursive: true
    });

    // Save watchers
    await fileWatcherService.saveWatches();

    // Start watching
    fileWatcherService.startWatching(watcher.id);

    await reply([
      '✅ *文件监听已添加*',
      '',
      `ID: \`${watcher.id.substring(0, 8)}...\``,
      `路径: \`${escapeMarkdownV2(resolvedPath)}\``,
      `状态: 活跃`,
      '',
      '当文件或目录发生变更时，你将收到通知。'
    ].join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 添加监听失败: ${escapeMarkdownV2(message)}`);
  }
}

/**
 * Handle list subcommand
 * @param {Function} reply
 * @param {string} chatId
 */
async function handleList(reply, chatId) {
  if (!fileWatcherService.isInitialized()) {
    await reply('📋 当前没有任何文件监听。');
    return;
  }

  const watchers = fileWatcherService.listWatches({ chatId });

  if (watchers.length === 0) {
    await reply('📋 当前没有配置任何文件监听。');
    return;
  }

  const lines = [
    `📋 *文件监听列表* (${watchers.length})`,
    ''
  ];

  for (const watcher of watchers) {
    const status = watcher.enabled ? (fileWatcherService.isWatcherActive(watcher.id) ? '✅' : '⏸️') : '⏸️';
    const lastEvent = watcher.lastEventAt
      ? `${watcher.lastEventType} at ${new Date(watcher.lastEventAt).toLocaleString()}`
      : '无事件';

    lines.push(`${status} \`${watcher.id.substring(0, 8)}...\``);
    lines.push(`   路径: \`${truncate(watcher.path, 40)}\``);
    lines.push(`   最近事件: ${lastEvent}`);
    lines.push('');
  }

  lines.push('使用 /unwatch <路径|ID> 取消监听');

  await reply(lines.join('\n'));
}

/**
 * Handle unwatch command
 * @param {string} pathOrId
 * @param {Function} reply
 * @param {string} chatId
 */
async function handleUnwatch(pathOrId, reply, chatId) {
  if (!pathOrId) {
    await reply('❌ 请提供路径或 ID。用法: /unwatch <路径|ID>');
    return;
  }

  if (!fileWatcherService.isInitialized()) {
    await reply('❌ 当前没有任何文件监听。');
    return;
  }

  const trimmedInput = pathOrId.trim();

  // Try to find by ID first
  const watchers = fileWatcherService.listWatches({ chatId });
  let watcher = watchers.find(w => w.id === trimmedInput || w.id.startsWith(trimmedInput));

  // If not found by ID, try by path
  if (!watcher) {
    const resolvedPath = resolve(trimmedInput);
    watcher = watchers.find(w => w.path === resolvedPath);
  }

  if (!watcher) {
    await reply(`❌ 未找到监听: \`${trimmedInput}\``);
    return;
  }

  const removed = fileWatcherService.removeWatch(watcher.id);

  if (removed) {
    await fileWatcherService.saveWatches();
    await reply([
      '✅ *文件监听已取消*',
      '',
      `路径: \`${escapeMarkdownV2(watcher.path)}\``
    ].join('\n'));
  } else {
    await reply('❌ 取消监听失败。');
  }
}

/**
 * Truncate string to max length
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

export default {
  watchMeta,
  handleWatch
};
