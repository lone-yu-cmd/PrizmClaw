import { Telegraf } from 'telegraf';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { isAllowedUser } from '../security/guard.js';
import { chatWithSession, resetSession } from '../services/chat-service.js';
import { executeAiCli, interruptAiCli, isAiCliRunning } from '../services/ai-cli-service.js';
import { captureScreenshot } from '../services/screenshot-service.js';
import { executeCommand, confirmHighRiskCommand } from '../services/command-executor-service.js';
import { createPlanIngestionService } from '../services/plan-ingestion-service.js';
import { loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';
import { registerCommand } from './commands/index.js';
import { routeCommand } from './commands/index.js';
import { pipelineMeta, handlePipeline } from './commands/handlers/pipeline.js';
import { bugfixMeta, handleBugfix } from './commands/handlers/bugfix.js';
import { plannerMeta, handlePlanner } from './commands/handlers/planner.js';
import { statusMeta, handleStatus } from './commands/handlers/status.js';
import { logsMeta, handleLogs } from './commands/handlers/logs.js';
import { stopMeta, handleStop } from './commands/handlers/stop.js';
import { planMeta, handlePlan } from './commands/handlers/plan.js';
import { auditMeta, handleAudit } from './commands/handlers/audit.js';
import { commitMeta, handleCommit } from './commands/handlers/commit.js';
import { commitsMeta, handleCommits } from './commands/handlers/commits.js';
// F-009: New command handlers
import { cdMeta, handleCd } from './commands/handlers/cd.js';
import { moreMeta, handleMore } from './commands/handlers/more.js';
// F-010: File Manager command handlers
import { lsMeta, handleLs } from './commands/handlers/ls.js';
import { treeMeta, handleTree } from './commands/handlers/tree.js';
import { catMeta, handleCat } from './commands/handlers/cat.js';
import { headMeta, handleHead } from './commands/handlers/head.js';
import { tailMeta, handleTail } from './commands/handlers/tail.js';
import { findMeta, handleFind } from './commands/handlers/find.js';
import { uploadMeta, handleUpload } from './commands/handlers/upload.js';
import { downloadMeta, handleDownload } from './commands/handlers/download.js';
// F-012: System Monitor command handlers
import { sysinfoMeta, handleSysinfo } from './commands/handlers/sysinfo.js';
import { psMeta, handlePs } from './commands/handlers/ps.js';
import { killMeta, handleKill } from './commands/handlers/kill.js';
import { monitorMeta, handleMonitor } from './commands/handlers/monitor.js';
// F-013: Session and Context Manager command handlers
import { historyMeta, handleHistory } from './commands/handlers/history.js';
import { aliasMeta, handleAlias } from './commands/handlers/alias.js';
import { sessionsMeta, handleSessions } from './commands/handlers/sessions.js';
import { generateHelp } from './commands/help.js';
import { sessionStore } from '../services/session-store.js';
import { sessionContextService } from '../services/session-context-service.js';
import { aliasStore } from '../services/alias-store.js';
import { convertToMarkdownV2 } from '../utils/markdown-v2-formatter.js';

const TELEGRAM_MSG_CHUNK_SIZE = 3800;
const STREAM_MIN_CHARS = 220;
const STREAM_FLUSH_INTERVAL_MS = 1200;
const TYPING_INTERVAL_MS = 3500;
const PHOTO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.txt', '.json', '.md', '.csv', '.log']);
const ALLOWED_FILE_EXTENSIONS = new Set([...PHOTO_EXTENSIONS, ...DOCUMENT_EXTENSIONS]);
const TELEGRAM_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TELEGRAM_MAX_DOCUMENT_BYTES = 45 * 1024 * 1024;
const TELEGRAM_HANDLER_TIMEOUT_MS = 10 * 60 * 1000;
const TMP_DIR = path.resolve(os.tmpdir());
const HOME_DIR = path.resolve(os.homedir());
const DESKTOP_DIR = path.join(HOME_DIR, 'Desktop');
const DOWNLOADS_DIR = path.join(HOME_DIR, 'Downloads');
const DEFAULT_ALLOWED_FILE_ROOTS = [path.resolve(process.cwd()), DESKTOP_DIR, DOWNLOADS_DIR, TMP_DIR];
const DEFAULT_FILE_CANDIDATE_DIRS = [path.resolve(process.cwd()), DESKTOP_DIR, DOWNLOADS_DIR, TMP_DIR];

function resolveConfiguredDirs(configuredDirs = [], fallbackDirs = []) {
  const normalized = configuredDirs
    .map((dir) => String(dir ?? '').trim())
    .filter(Boolean)
    .map((dir) => path.resolve(dir));

  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }

  return [...new Set(fallbackDirs.map((dir) => path.resolve(String(dir))))];
}

const ALLOWED_FILE_ROOTS = resolveConfiguredDirs(config.telegramFileAllowedRoots, DEFAULT_ALLOWED_FILE_ROOTS);
const FILE_CANDIDATE_DIRS = resolveConfiguredDirs(config.telegramFileCandidateDirs, DEFAULT_FILE_CANDIDATE_DIRS);

function splitMessage(text, chunkSize = TELEGRAM_MSG_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function sanitizeMarkerPath(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^['"`]+/, '')
    .replace(/['"`]+$/, '');
}

function extractFileMarkers(text = '') {
  const fileRefs = [];

  const withSendFileRemoved = text.replace(
    /(?:^|\n)\s*(?:[-*]\s*)?`?SEND_FILE:([^\n`]+)`?\s*(?=\n|$)/g,
    (_full, rawRef) => {
      const ref = sanitizeMarkerPath(rawRef);
      if (ref) {
        fileRefs.push(ref);
      }
      return '\n';
    }
  );

  const withImageRemoved = withSendFileRemoved.replace(/@image:([^\s`]+)/g, (_full, rawRef) => {
    const ref = sanitizeMarkerPath(rawRef);
    if (ref) {
      fileRefs.push(ref);
    }
    return '';
  });

  const withBacktickPathRemoved = withImageRemoved.replace(
    /`((?:\/[^`\n\r]+)+\.(?:png|jpg|jpeg|webp|pdf|txt|json|md|csv|log))`/gi,
    (_full, rawRef) => {
      const ref = sanitizeMarkerPath(rawRef);
      if (ref) {
        fileRefs.push(ref);
      }
      return '';
    }
  );

  const withLabeledPathRemoved = withBacktickPathRemoved.replace(
    /(?:文件路径|path)\s*[:：]\s*((?:\/[^\n`\r]+)+\.(?:png|jpg|jpeg|webp|pdf|txt|json|md|csv|log))/gi,
    (_full, rawRef) => {
      const ref = sanitizeMarkerPath(rawRef);
      if (ref) {
        fileRefs.push(ref);
      }
      return '';
    }
  );

  const withAbsolutePathLineRemoved = withLabeledPathRemoved.replace(
    /(?:^|\n)\s*(?:[-*]\s*)?((?:\/[^\n`\r]+)+\.(?:png|jpg|jpeg|webp|pdf|txt|json|md|csv|log))\s*(?=\n|$)/gi,
    (_full, rawRef) => {
      const ref = sanitizeMarkerPath(rawRef);
      if (ref) {
        fileRefs.push(ref);
      }
      return '\n';
    }
  );

  return {
    fileRefs: [...new Set(fileRefs)],
    cleanedText: withAbsolutePathLineRemoved.replace(/\n{3,}/g, '\n\n').trim()
  };
}

function isPathWithinRoot(targetPath, rootPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isAllowedFilePath(filePath) {
  const resolved = path.resolve(filePath);
  return ALLOWED_FILE_ROOTS.some((root) => isPathWithinRoot(resolved, root));
}

function buildFileCandidates(normalizedPath) {
  if (path.isAbsolute(normalizedPath)) {
    return [normalizedPath];
  }

  const baseName = path.basename(normalizedPath);
  const candidates = [
    path.resolve(process.cwd(), normalizedPath),
    ...FILE_CANDIDATE_DIRS.map((dir) => path.resolve(dir, baseName))
  ];

  return [...new Set(candidates)];
}

async function resolveLocalFilePath(fileRef) {
  const normalized = sanitizeMarkerPath(fileRef);
  if (!normalized) {
    return { filePath: null, triedPaths: [], rejectReason: 'empty_path' };
  }

  if (!path.isAbsolute(normalized)) {
    return { filePath: null, triedPaths: [], rejectReason: 'relative_path_not_allowed' };
  }

  const candidates = buildFileCandidates(normalized);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return { filePath: candidate, triedPaths: candidates };
    } catch {
      // ignore
    }
  }

  return { filePath: null, triedPaths: candidates, rejectReason: 'not_found' };
}

async function validateFileForTelegram(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!isAllowedFilePath(resolvedPath)) {
    return { ok: false, reason: `路径不在允许范围：${resolvedPath}` };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `不支持的文件类型：${ext || '(unknown)'}` };
  }

  const fileStat = await stat(resolvedPath);
  const isPhoto = PHOTO_EXTENSIONS.has(ext);
  const maxSize = isPhoto ? TELEGRAM_MAX_PHOTO_BYTES : TELEGRAM_MAX_DOCUMENT_BYTES;

  if (fileStat.size > maxSize) {
    return {
      ok: false,
      reason: `文件过大：${Math.ceil(fileStat.size / 1024 / 1024)}MB，限制 ${Math.floor(maxSize / 1024 / 1024)}MB`
    };
  }

  return { ok: true, isPhoto, resolvedPath };
}

function isTimeoutLikeError(message = '') {
  const normalized = String(message).toLowerCase();
  return normalized.includes('timed out') || normalized.includes('etimedout') || normalized.includes('timeout');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTelegramFileByType(ctx, filePath, isPhoto) {
  if (isPhoto) {
    await ctx.replyWithPhoto({ source: createReadStream(filePath) }, { caption: path.basename(filePath) });
    return;
  }

  await ctx.replyWithDocument({ source: createReadStream(filePath), filename: path.basename(filePath) });
}

async function replyFiles(ctx, fileRefs = []) {
  const results = [];

  for (const fileRef of fileRefs) {
    const { filePath, triedPaths, rejectReason } = await resolveLocalFilePath(fileRef);
    if (!filePath) {
      const reason = rejectReason || 'not_found';
      results.push({ fileRef, sent: false, reason, triedPaths });
      logger.warn({ fileRef, reason, triedPaths }, 'File unavailable for telegram upload');
      continue;
    }

    try {
      const validation = await validateFileForTelegram(filePath);
      if (!validation.ok) {
        results.push({ fileRef, sent: false, reason: validation.reason, filePath, triedPaths });
        logger.warn({ fileRef, filePath, reason: validation.reason }, 'File validation failed for telegram upload');
        continue;
      }

      const actualPath = validation.resolvedPath;
      let sent = false;
      let lastReason = '';

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await sendTelegramFileByType(ctx, actualPath, validation.isPhoto);
          sent = true;
          logger.info(
            { fileRef, filePath: actualPath, as: validation.isPhoto ? 'photo' : 'document', attempt },
            'Telegram file sent'
          );
          break;
        } catch (error) {
          lastReason = error instanceof Error ? error.message : String(error);
          logger.warn(
            { fileRef, filePath: actualPath, err: lastReason, attempt },
            'Telegram file send attempt failed'
          );

          if (attempt < 2 && isTimeoutLikeError(lastReason)) {
            await sleep(600);
            continue;
          }

          break;
        }
      }

      if (!sent) {
        results.push({ fileRef, sent: false, reason: lastReason || 'unknown_error', filePath: actualPath, triedPaths });
        logger.error({ fileRef, filePath: actualPath, err: lastReason }, 'Failed to send file to telegram');
        continue;
      }

      results.push({ fileRef, sent: true, filePath: actualPath, triedPaths });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({ fileRef, sent: false, reason, filePath, triedPaths });
      logger.error({ fileRef, filePath, err: reason }, 'Failed to send file to telegram');
    }
  }

  return results;
}

async function safeReply(ctx, text) {
  try {
    await ctx.reply(text);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ err: reason }, 'Failed to send telegram text reply');
    return false;
  }
}

async function replyLargeText(ctx, text) {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    const ok = await safeReply(ctx, chunk);
    if (!ok) {
      break;
    }
  }
}

async function safeEditMessageText(ctx, messageId, text) {
  const nextText = text && text.trim() ? text : ' ';

  try {
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, nextText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('message is not modified')) {
      return;
    }
    throw error;
  }
}

function createEditableStreamPublisher(ctx) {
  let fullText = '';
  let renderedText = '';
  let pendingChars = 0;
  let lastFlushAt = 0;
  let flushChain = Promise.resolve();
  let activeMessage = null;
  let activeSegmentIndex = 0;
  let publishedMessageCount = 0;

  async function ensureActiveMessage() {
    if (activeMessage) {
      return;
    }
    activeMessage = await ctx.reply('处理中...');
    activeSegmentIndex = 0;
    publishedMessageCount += 1;
  }

  async function render(force = false) {
    const now = Date.now();

    if (!force && pendingChars < STREAM_MIN_CHARS && now - lastFlushAt < STREAM_FLUSH_INTERVAL_MS) {
      return;
    }

    if (fullText === renderedText) {
      pendingChars = 0;
      return;
    }

    await ensureActiveMessage();

    const segments = splitMessage(fullText);
    const targetLastIndex = Math.max(segments.length - 1, 0);

    while (activeSegmentIndex < targetLastIndex) {
      const text = segments[activeSegmentIndex] ?? ' ';
      await safeEditMessageText(ctx, activeMessage.message_id, text);

      activeMessage = await ctx.reply('继续输出中...');
      activeSegmentIndex += 1;
      publishedMessageCount += 1;
    }

    const activeText = segments[targetLastIndex] ?? ' ';
    await safeEditMessageText(ctx, activeMessage.message_id, activeText);

    renderedText = fullText;
    pendingChars = 0;
    lastFlushAt = now;
  }

  function enqueueRender(force = false) {
    flushChain = flushChain.then(() => render(force));
  }

  return {
    push(text) {
      const appendText = text ?? '';
      if (!appendText) {
        return;
      }
      fullText += appendText;
      pendingChars += appendText.length;
      enqueueRender(false);
    },
    setFinalText(text) {
      fullText = text ?? '';
      pendingChars = Math.max(pendingChars, STREAM_MIN_CHARS);
      enqueueRender(true);
    },
    async finish() {
      enqueueRender(true);
      await flushChain;
      return {
        outputLength: renderedText.length,
        messageCount: publishedMessageCount
      };
    }
  };
}

function buildSessionId(ctx) {
  return String(ctx.chat.id);
}

function ensureAllowed(ctx) {
  const userId = ctx.from?.id;
  if (!isAllowedUser(userId)) {
    throw new Error('当前账号未被授权使用该机器人。');
  }
}

/**
 * Register all pipeline-related commands.
 */
function registerPipelineCommands() {
  registerCommand(pipelineMeta, handlePipeline);
  registerCommand(bugfixMeta, handleBugfix);
  registerCommand(plannerMeta, handlePlanner);
  registerCommand(statusMeta, handleStatus);
  registerCommand(logsMeta, handleLogs);
  registerCommand(stopMeta, handleStop);
  registerCommand(planMeta, handlePlan);
  registerCommand(auditMeta, handleAudit);
  registerCommand(commitMeta, handleCommit);
  registerCommand(commitsMeta, handleCommits);
  // F-009: New commands
  registerCommand(cdMeta, handleCd);
  registerCommand(moreMeta, handleMore);
  // F-010: File Manager commands
  registerCommand(lsMeta, handleLs);
  registerCommand(treeMeta, handleTree);
  registerCommand(catMeta, handleCat);
  registerCommand(headMeta, handleHead);
  registerCommand(tailMeta, handleTail);
  registerCommand(findMeta, handleFind);
  registerCommand(uploadMeta, handleUpload);
  registerCommand(downloadMeta, handleDownload);
  // F-012: System Monitor commands
  registerCommand(sysinfoMeta, handleSysinfo);
  registerCommand(psMeta, handlePs);
  registerCommand(killMeta, handleKill);
  registerCommand(monitorMeta, handleMonitor);
  // F-013: Session and Context Manager commands
  registerCommand(historyMeta, handleHistory);
  registerCommand(aliasMeta, handleAlias);
  registerCommand(sessionsMeta, handleSessions);
}

export async function createTelegramBot() {
  const bot = new Telegraf(config.telegramBotToken, {
    handlerTimeout: TELEGRAM_HANDLER_TIMEOUT_MS
  });

  // F-013: Initialize session context service
  await sessionContextService.initSessionContext({ dataDir: config.sessionPersistenceDir });
  await aliasStore.initAliasStore({ filePath: config.aliasPersistencePath });

  // F-013: Restore sessions from disk
  await sessionContextService.restoreSessions();

  // F-013: Set up notification callback for session timeout
  sessionContextService.setNotificationCallback(async (sessionKey, userId) => {
    try {
      // Extract chat ID from session key (format: telegram:123456789)
      const chatId = sessionKey.replace('telegram:', '');
      await bot.telegram.sendMessage(chatId, '⏰ 会话因长时间未活动已超时，相关状态已清理。');
    } catch (error) {
      logger.warn({ sessionKey, userId, error: error.message }, 'Failed to send session timeout notification');
    }
  });

  // F-013: Start timeout watcher
  sessionContextService.startTimeoutWatcher();

  // Register pipeline commands
  registerPipelineCommands();

  bot.catch((error, ctx) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message, chatId: ctx?.chat?.id, updateType: ctx?.updateType }, 'Unhandled error while processing telegram update');
  });

  bot.start(async (ctx) => {
    await ctx.reply('PrizmClaw 已启动。可直接聊天，也可用 /help 查看可用命令。');
  });

  bot.help(async (ctx) => {
    const helpText = generateHelp();
    await ctx.reply(helpText);
  });

  bot.command('reset', async (ctx) => {
    try {
      ensureAllowed(ctx);
      const sessionId = buildSessionId(ctx);

      // F-011: Interrupt any running AI CLI task
      if (isAiCliRunning(sessionId)) {
        interruptAiCli(sessionId);
      }

      resetSession({ channel: 'telegram', sessionId });
      await ctx.reply('已清空当前会话上下文。');
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : String(error));
    }
  });

  bot.command('screenshot', async (ctx) => {
    try {
      ensureAllowed(ctx);
      await ctx.reply('正在获取截图。');
      const { buffer } = await captureScreenshot();
      await ctx.replyWithPhoto({ source: buffer }, { caption: '当前本地屏幕截图' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to capture screenshot in telegram');
      await ctx.reply(`截图失败：${message}`);
    }
  });

  bot.command('exec', async (ctx) => {
    try {
      ensureAllowed(ctx);
      const payload = ctx.message.text.replace('/exec', '').trim();
      if (!payload) {
        await ctx.reply('请提供命令，例如 /exec pwd');
        return;
      }

      const sessionId = buildSessionId(ctx);
      const userId = ctx.from?.id;

      await ctx.reply('正在执行命令...');
      const result = await executeCommand({
        command: payload,
        sessionId,
        userId
      });

      // Handle confirmation required
      if (result.needsConfirmation) {
        await ctx.reply(result.confirmationMessage);
        return;
      }

      // Send output
      await replyLargeText(ctx, result.output);

      // Indicate if more pages available
      if (result.hasMorePages) {
        await ctx.reply('📄 输出已截断。使用 /more 查看更多内容。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to exec command in telegram');
      await ctx.reply(`执行失败：${message}`);
    }
  });

  // F-009: /cd command handler
  bot.command('cd', async (ctx) => {
    try {
      ensureAllowed(ctx);
      const payload = ctx.message.text.replace('/cd', '').trim();
      const sessionId = buildSessionId(ctx);

      await handleCd({
        ctx,
        reply: (msg) => ctx.reply(msg),
        params: {},
        userId: ctx.from?.id,
        sessionId,
        args: payload ? [payload] : []
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to cd in telegram');
      await ctx.reply(`切换目录失败：${message}`);
    }
  });

  // F-009: /more command handler
  bot.command('more', async (ctx) => {
    try {
      ensureAllowed(ctx);
      const sessionId = buildSessionId(ctx);

      await handleMore({
        ctx,
        reply: (msg) => ctx.reply(msg),
        params: {},
        userId: ctx.from?.id,
        sessionId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to get more output in telegram');
      await ctx.reply(`获取更多输出失败：${message}`);
    }
  });

  // T-100: Document upload handler for plan files
  bot.on('document', async (ctx) => {
    try {
      ensureAllowed(ctx);

      const document = ctx.message?.document;
      if (!document) {
        return;
      }

      // Check file extension
      const fileName = document.file_name || '';
      const ext = path.extname(fileName).toLowerCase();

      if (ext !== '.json') {
        // Not a JSON file, ignore silently (other handlers may process it)
        return;
      }

      // Check file size
      const fileSize = document.file_size || 0;
      if (fileSize > 1024 * 1024) { // 1MB limit
        await ctx.reply('❌ 文件过大，限制 1MB。');
        return;
      }

      await ctx.reply('正在处理上传的计划文件...');

      // Download file content
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      const fileUrl = fileLink.href || fileLink.toString();

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status}`);
      }

      const content = await response.text();

      // Validate and save using plan-ingestion-service
      const infraConfig = loadPipelineInfraConfig();
      const planService = createPlanIngestionService({ plansDir: infraConfig.plansDir });

      const validationResult = planService.validate(content);

      if (!validationResult.valid) {
        const errorMsg = planService.formatValidationErrors(validationResult.errors);
        await ctx.reply(errorMsg);
        return;
      }

      // Save the plan
      const saveResult = await planService.save(
        validationResult.type,
        content,
        { uploadedBy: ctx.from?.id }
      );

      if (!saveResult.success) {
        await ctx.reply('❌ 保存失败，请稍后重试。');
        return;
      }

      // Set as current version
      await planService.setCurrent(validationResult.type, saveResult.version);

      // Format success message
      const typeDisplay = validationResult.type === 'feature-list' ? '特性列表' : 'Bug修复列表';
      const summary = validationResult.summary;

      await ctx.reply([
        `✅ ${typeDisplay}已保存并激活`,
        `版本: ${saveResult.version}`,
        `名称: ${summary?.name || '未知'}`,
        `项目数: ${summary?.itemCount || 0}`,
        '',
        summary?.statusBreakdown ? '状态分布:' : '',
        ...Object.entries(summary?.statusBreakdown || {}).map(([status, count]) => `  ${status}: ${count}`)
      ].filter(Boolean).join('\n'));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to process document upload');
      await ctx.reply(`❌ 处理失败：${message}`);
    }
  });

  bot.on('text', async (ctx) => {
    // Check for pipeline commands first
    const handled = await routeCommand(ctx);
    if (handled) {
      return;
    }

    const sessionId = buildSessionId(ctx);
    const userId = ctx.from?.id;

    // F-009: Direct exec mode - treat plain text as command when enabled
    if (config.directExecMode && config.enableSystemExec) {
      try {
        ensureAllowed(ctx);
        const command = ctx.message.text;

        // Skip if it looks like a chat message (contains Chinese or Japanese characters, etc.)
        const isLikelyChat = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(command);

        if (!isLikelyChat) {
          await ctx.reply('正在执行命令...');
          const result = await executeCommand({
            command,
            sessionId,
            userId
          });

          if (result.needsConfirmation) {
            await ctx.reply(result.confirmationMessage);
            return;
          }

          await replyLargeText(ctx, result.output);

          if (result.hasMorePages) {
            await ctx.reply('📄 输出已截断。使用 /more 查看更多内容。');
          }
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // If exec fails, fall through to chat mode
        logger.warn({ err: message }, 'Direct exec mode failed, falling back to chat');
      }
    }

    // F-011: Check if AI CLI is already running
    if (isAiCliRunning(sessionId)) {
      await ctx.reply('⏳ 有任务正在执行，请等待完成或使用 /stop 中断。');
      return;
    }

    let typingTimer = null;

    try {
      ensureAllowed(ctx);
      await ctx.sendChatAction('typing');

      const streamPublisher = createEditableStreamPublisher(ctx);
      typingTimer = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => undefined);
      }, TYPING_INTERVAL_MS);

      // F-011: Use ai-cli-service for execution with process tracking
      const sessionKey = `telegram:${sessionId}`;

      // Append user message to session history
      sessionStore.append(sessionKey, 'user', ctx.message.text);

      // Build prompt with context
      const prompt = sessionStore.toPrompt(sessionKey, 'telegram');

      // Track last heartbeat message for updates
      /** @type {{ message_id: number } | null} */
      let lastHeartbeatMsg = null;

      const result = await executeAiCli({
        sessionId,
        prompt,
        hooks: {
          onChunk: (text) => {
            streamPublisher.push(text);
          },
          onHeartbeat: config.aiCliEnableHeartbeat ? (info) => {
            // Send/update heartbeat progress message
            const elapsedSec = Math.floor(info.elapsedMs / 1000);
            const progressText = `⏳ 任务执行中... (${elapsedSec}s, ${Math.floor(info.stdoutBytes / 1024)}KB)`;

            // Don't await - fire and forget
            if (lastHeartbeatMsg) {
              ctx.telegram.editMessageText(ctx.chat.id, lastHeartbeatMsg.message_id, undefined, progressText)
                .catch(() => {});
            } else {
              ctx.reply(progressText)
                .then((msg) => { lastHeartbeatMsg = msg; })
                .catch(() => {});
            }
          } : undefined,
          onStatus: (status) => {
            if (status === 'running') {
              ctx.sendChatAction('typing').catch(() => undefined);
            }
          }
        }
      });

      // Delete heartbeat message if exists
      if (lastHeartbeatMsg) {
        ctx.telegram.deleteMessage(ctx.chat.id, lastHeartbeatMsg.message_id).catch(() => {});
      }

      // Append assistant reply to session history
      sessionStore.append(sessionKey, 'assistant', result.output);

      // F-011: Format output with MarkdownV2
      const formattedOutput = convertToMarkdownV2(result.output);

      // Handle result states
      if (result.interrupted) {
        await ctx.reply('⏹️ 任务已被中断。');
      } else if (result.timedOut) {
        await ctx.reply(`⏰ 任务执行超时。\n建议：使用 /stop 中断或增加 REQUEST_TIMEOUT_MS 配置。`);
      }

      // Extract file markers and send
      const { fileRefs, cleanedText } = extractFileMarkers(result.output);
      logger.info({ sessionId, fileRefsCount: fileRefs.length, fileRefs }, 'Parsed file markers from assistant reply');
      const finalText = cleanedText || (fileRefs.length > 0 ? '已执行，正在发送文件。' : '已执行。');

      streamPublisher.setFinalText(finalText);
      const streamed = await streamPublisher.finish();
      if (streamed.outputLength === 0) {
        await replyLargeText(ctx, finalText);
      }

      if (fileRefs.length > 0) {
        const fileSendResults = await replyFiles(ctx, fileRefs);
        const failed = fileSendResults.filter((item) => !item.sent);

        if (failed.length === 0) {
          await safeReply(ctx, `已发送 ${fileSendResults.length} 个文件。`);
        } else {
          const failedList = failed
            .map((item) => {
              const reason =
                item.reason === 'relative_path_not_allowed'
                  ? '仅允许绝对路径，拒绝相对路径（请使用 SEND_FILE:/var/folders/.../xxx.png）'
                  : item.reason === 'not_found'
                    ? '文件不存在或不可访问（建议返回绝对路径，例如 SEND_FILE:/var/folders/.../xxx.png）'
                    : item.reason;
              const tried = Array.isArray(item.triedPaths) && item.triedPaths.length > 0 ? `；尝试路径：${item.triedPaths.join(' | ')}` : '';
              return `- SEND_FILE:${item.fileRef}${reason ? `（${reason}）` : ''}${tried}`;
            })
            .join('\n');
          await safeReply(ctx, `以下文件发送失败，已附回原始引用：\n${failedList}`);
          logger.warn({ sessionId, failed }, 'Some files failed to send to telegram');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message, sessionId }, 'Failed to process telegram message');
      await safeReply(ctx, `处理失败：${message}`);
    } finally {
      if (typingTimer) {
        clearInterval(typingTimer);
      }
    }
  });

  return bot;
}
