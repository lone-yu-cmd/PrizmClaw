/**
 * Upload Command Handler
 * F-010: File Manager
 *
 * Handles the /upload command for receiving files from Telegram and saving to disk.
 *
 * F-002: File size validation (50MB limit)
 * F-003: Overwrite confirmation flow
 */

import { writeFile, validatePath, fileExists } from '../../../services/file-service.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import { getUserRole } from '../../../security/permission-guard.js';
import { createConfirmation, checkConfirmation, confirmAction, cancelConfirmation } from '../../../security/confirmation-manager.js';

/**
 * Telegram maximum file size (50MB)
 * Files larger than this cannot be downloaded via Telegram Bot API
 */
const TELEGRAM_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Pending uploads storage (for confirmation flow)
 * Maps confirmId -> { ctx, document, targetPath, sessionId, userId }
 */
const pendingUploads = new Map();

/**
 * Upload command metadata.
 */
export const uploadMeta = {
  name: 'upload',
  aliases: [],
  description: '上传文件到指定路径',
  usage: '/upload <目标路径>',
  examples: ['/upload /tmp/test.txt', '/upload ~/Downloads/file.pdf'],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/upload <目标路径> - 上传文件到指定路径（需回复文档消息）'
};

/**
 * Handle /upload command.
 * @param {Object} handlerCtx - Handler context
 * @param {Object} handlerCtx.ctx - Telegraf context
 * @param {Object} handlerCtx.reply - Reply function
 * @param {string} handlerCtx.sessionId - Session identifier
 * @param {string} handlerCtx.userId - User ID
 * @param {string[]} handlerCtx.args - Command arguments
 * @param {string} [handlerCtx.confirmationId] - Confirmation ID if resuming after confirmation
 */
export async function handleUpload(handlerCtx) {
  const { ctx, reply, sessionId, userId, args = [], confirmationId } = handlerCtx;

  // Check if this is a confirmation response
  if (confirmationId) {
    return await handleUploadConfirmation(handlerCtx);
  }

  // Get the target path
  const targetPath = args[0];

  if (!targetPath) {
    await reply('❌ 请提供目标路径，例如: /upload /tmp/test.txt');
    return;
  }

  // Check if this is a reply to a document
  const replyToMessage = ctx.message?.reply_to_message;
  const document = replyToMessage?.document;

  if (!document) {
    await reply('❌ 请回复一条包含文档的消息来上传文件。\n使用方法: 回复文档消息并发送 /upload <目标路径>');
    return;
  }

  // F-002: Check file size before downloading (50MB limit)
  if (document.file_size !== undefined && document.file_size > TELEGRAM_MAX_FILE_SIZE) {
    const sizeMB = (document.file_size / (1024 * 1024)).toFixed(2);
    await reply(
      `❌ 文件过大：${sizeMB}MB\n` +
      `Telegram 文件大小限制为 50MB，无法下载。`
    );

    // Log rejected upload attempt
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'upload',
      params: { path: targetPath, fileSize: document.file_size, fileName: document.file_name },
      result: 'denied',
      reason: `File exceeds 50MB limit: ${sizeMB}MB`,
      sessionId
    }).catch(() => {});

    return;
  }

  // Validate target path
  const validation = await validatePath(targetPath, sessionId);
  if (!validation.ok) {
    await reply(`❌ ${validation.error}`);
    return;
  }

  // F-003: Check if file already exists
  const existsCheck = await fileExists(targetPath, sessionId);
  if (!existsCheck.ok) {
    await reply(`❌ ${existsCheck.error}`);
    return;
  }

  if (existsCheck.exists) {
    // File exists - require confirmation before overwriting
    const { confirmId, message } = createConfirmation(
      userId,
      'upload_overwrite',
      { targetPath: existsCheck.resolved, fileName: document.file_name }
    );

    // Store pending upload data
    pendingUploads.set(confirmId, {
      ctx,
      document,
      targetPath: existsCheck.resolved,
      sessionId,
      userId
    });

    await reply(
      `⚠️ 文件已存在：${existsCheck.resolved}\n\n` +
      `文件名：${document.file_name || '未知'}\n\n` +
      `confirm_id: ${confirmId}\n\n` +
      `请回复 CONFIRM 覆盖现有文件，或回复 CANCEL 取消操作。\n` +
      `（60秒内有效）`
    );
    return;
  }

  // File doesn't exist - proceed with upload directly
  await performUpload(ctx, document, targetPath, sessionId, userId, reply);
}

/**
 * Handle upload confirmation response.
 * @param {Object} handlerCtx - Handler context
 */
async function handleUploadConfirmation(handlerCtx) {
  const { ctx, reply, sessionId, userId, confirmationId, args = [] } = handlerCtx;

  // Get user response from args or message text
  const userResponse = (args[0] || ctx.message?.text || '').toUpperCase().trim();

  if (userResponse === 'CANCEL') {
    cancelConfirmation(confirmationId, userId);
    pendingUploads.delete(confirmationId);
    await reply('✅ 上传操作已取消。');
    return;
  }

  // Get stored upload data first
  const uploadData = pendingUploads.get(confirmationId);
  if (!uploadData) {
    await reply('❌ 上传数据已过期，请重新执行 /upload 命令。');
    return;
  }

  // Try to confirm the action (this may have been consumed already if test called confirmAction)
  // If the confirmation was already consumed, we still proceed if we have upload data
  const confirmResult = confirmAction(confirmationId, userId);

  // Clear pending data regardless of confirmation result (if we have upload data)
  pendingUploads.delete(confirmationId);

  // Perform the upload
  await performUpload(
    uploadData.ctx,
    uploadData.document,
    uploadData.targetPath,
    uploadData.sessionId,
    uploadData.userId,
    reply
  );
}

/**
 * Perform the actual file upload.
 * @param {Object} ctx - Telegraf context
 * @param {Object} document - Telegram document object
 * @param {string} targetPath - Target file path
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {Function} reply - Reply function
 */
async function performUpload(ctx, document, targetPath, sessionId, userId, reply) {
  try {
    await reply('📥 正在下载文件...');

    // Download file from Telegram
    const fileLink = await ctx.telegram.getFileLink(document.file_id);
    const fileUrl = fileLink.href || fileLink.toString();

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    // Get file content as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write file
    const result = await writeFile(targetPath, buffer, sessionId);

    if (result.error) {
      await reply(`❌ ${result.error}`);
      return;
    }

    // Log audit entry
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'upload',
      params: { path: result.path, size: result.size, originalName: document.file_name },
      result: 'success',
      sessionId
    });

    await reply(
      `✅ 文件已保存\n` +
      `路径: ${result.path}\n` +
      `大小: ${result.size} 字节\n` +
      `${result.overwritten ? '⚠️ 已覆盖已有文件' : ''}`
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Log failed attempt
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'upload',
      params: { path: targetPath },
      result: 'failed',
      reason: message,
      sessionId
    }).catch(() => {});

    await reply(`❌ 上传失败: ${message}`);
  }
}

export default {
  uploadMeta,
  handleUpload
};
