/**
 * Download Command Handler
 * F-010: File Manager
 *
 * Handles the /download command for sending files from disk to Telegram.
 */

import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { validatePath } from '../../../services/file-service.js';
import { getFileExtension, isImageExtension } from '../../../utils/file-utils.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import { getUserRole } from '../../../security/permission-guard.js';

const TELEGRAM_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TELEGRAM_MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const PHOTO_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/**
 * Download command metadata.
 */
export const downloadMeta = {
  name: 'download',
  aliases: ['dl'],
  description: '下载文件到 Telegram',
  usage: '/download <文件路径>',
  examples: ['/download /tmp/test.txt', '/download ~/Downloads/report.pdf'],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/download <文件路径> - 发送文件到 Telegram（最大50MB）'
};

/**
 * Handle /download command.
 * @param {Object} handlerCtx - Handler context
 * @param {Object} handlerCtx.ctx - Telegraf context
 * @param {Object} handlerCtx.reply - Reply function
 * @param {string} handlerCtx.sessionId - Session identifier
 * @param {string} handlerCtx.userId - User ID
 * @param {string[]} handlerCtx.args - Command arguments
 */
export async function handleDownload(handlerCtx) {
  const { ctx, reply, sessionId, userId, args = [] } = handlerCtx;

  // Get the file path
  const filePath = args[0];

  if (!filePath) {
    await reply('❌ 请提供文件路径，例如: /download /tmp/test.txt');
    return;
  }

  // Validate path
  const validation = await validatePath(filePath, sessionId);
  if (!validation.ok) {
    await reply(`❌ ${validation.error}`);
    return;
  }

  try {
    const resolvedPath = validation.resolved;

    // Check if file exists and get stats
    const stats = await stat(resolvedPath);

    if (stats.isDirectory()) {
      await reply(`❌ 是目录，不是文件: ${resolvedPath}`);
      return;
    }

    // Check file size
    const fileSize = stats.size;
    const ext = getFileExtension(resolvedPath);
    const isPhoto = PHOTO_EXTENSIONS.has(ext);
    const maxSize = isPhoto ? TELEGRAM_MAX_PHOTO_BYTES : TELEGRAM_MAX_DOCUMENT_BYTES;

    if (fileSize > maxSize) {
      const sizeMB = Math.ceil(fileSize / 1024 / 1024);
      const limitMB = Math.floor(maxSize / 1024 / 1024);
      await reply(`❌ 文件过大: ${sizeMB}MB，限制 ${limitMB}MB`);
      return;
    }

    // Send file
    const fileName = path.basename(resolvedPath);

    if (isPhoto) {
      await ctx.replyWithPhoto(
        { source: createReadStream(resolvedPath) },
        { caption: fileName }
      );
    } else {
      await ctx.replyWithDocument(
        { source: createReadStream(resolvedPath), filename: fileName }
      );
    }

    // Log audit entry
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'download',
      params: { path: resolvedPath, size: fileSize },
      result: 'success',
      sessionId
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Log failed attempt
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'download',
      params: { path: validation.resolved },
      result: 'failed',
      reason: message,
      sessionId
    }).catch(() => {});

    if (error.code === 'ENOENT') {
      await reply(`❌ 文件不存在: ${validation.resolved}`);
    } else {
      await reply(`❌ 发送失败: ${message}`);
    }
  }
}

export default {
  downloadMeta,
  handleDownload
};
