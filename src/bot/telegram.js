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
import { createMessageRouter } from '../services/message-router.js';
import { realtimeHub } from '../services/realtime-hub.js';
import { createSessionBindService } from '../services/session-bind.js';
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
// F-014: Notification and Scheduled Tasks command handlers
import { cronMeta, handleCron } from './commands/handlers/cron.js';
import { jobsMeta, handleJobs } from './commands/handlers/jobs.js';
import { watchMeta, handleWatch } from './commands/handlers/watch.js';
// F-015: AI CLI Backend Switcher command handler
import { cliMeta, handleCli } from './commands/handlers/cli.js';
// F-021: Multi-Backend Profile Manager
import { profileStore } from '../services/profile-store.js';
import { backendRegistry } from '../services/backend-registry.js';
// F-017: Runtime Config Manager command handler
import { configMeta, handleConfig } from './commands/handlers/config.js';
// F-020: Enhanced Terminal Output Streaming
import { outputMeta, handleOutput, outputHistoryService } from './commands/handlers/output.js';
import { processChunk as ansiProcessChunk } from '../utils/ansi-adapter.js';
import { segmentOutput } from '../utils/output-segmenter.js';
import { generateHelp } from './commands/help.js';
import { sessionStore } from '../services/session-store.js';
import { sessionContextService } from '../services/session-context-service.js';
import { aliasStore } from '../services/alias-store.js';
import { scheduledTaskService } from '../services/scheduled-task-service.js';
import { fileWatcherService } from '../services/file-watcher-service.js';
import { convertToMarkdownV2 } from '../utils/markdown-v2-formatter.js';
import { escapeMarkdownV2 } from '../utils/markdown-v2-formatter.js';

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

function truncate(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
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

    const segments = segmentOutput(fullText);
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
  // F-014: Notification and Scheduled Tasks commands
  registerCommand(cronMeta, handleCron);
  registerCommand(jobsMeta, handleJobs);
  registerCommand(watchMeta, handleWatch);
  // F-015: AI CLI Backend Switcher command
  registerCommand(cliMeta, handleCli);
  // F-017: Runtime Config Manager command
  registerCommand(configMeta, handleConfig);
  // F-020: Enhanced Terminal Output Streaming
  registerCommand(outputMeta, handleOutput);
}

export async function createTelegramBot() {
  const bot = new Telegraf(config.telegramBotToken, {
    handlerTimeout: TELEGRAM_HANDLER_TIMEOUT_MS
  });

  // F-013: Initialize session context service
  await sessionContextService.initSessionContext({ dataDir: config.sessionPersistenceDir });
  await aliasStore.initAliasStore({ persistencePath: config.aliasPersistencePath });

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

  // F-014: Initialize scheduled task service
  scheduledTaskService.initScheduledTaskService({
    dataDir: config.systemMonitorDataDir,
    tasksFile: config.scheduledTasksPath,
    maxTasks: config.maxScheduledTasks
  });

  // F-014: Set up task execution callback
  scheduledTaskService.setExecuteCallback(async ({ command, cwd, sessionId, userId }) => {
    try {
      return await executeCommand({
        command,
        cwd,
        sessionId,
        userId,
        skipConfirmation: true // Skip confirmation for scheduled tasks
      });
    } catch (error) {
      return {
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        timedOut: false
      };
    }
  });

  // F-014: Set up task notification callback
  scheduledTaskService.setNotificationCallback(async (chatId, task) => {
    try {
      const result = task.lastResult || {};
      const lines = [
        '⏰ *定时任务完成*',
        '',
        `任务ID: \`${task.id.substring(0, 8)}...\``,
        `命令: \`${escapeMarkdownV2(task.command)}\``,
        `执行时间: ${escapeMarkdownV2(new Date(result.executedAt || Date.now()).toLocaleString())}`,
        '',
        `exitCode: ${result.exitCode}`,
        result.stdout ? `stdout:\n${escapeMarkdownV2(truncate(result.stdout, 500))}` : 'stdout: (empty)',
        result.stderr ? `stderr:\n${escapeMarkdownV2(truncate(result.stderr, 500))}` : 'stderr: (empty)'
      ];
      await bot.telegram.sendMessage(chatId, lines.join('\n'), { parse_mode: 'MarkdownV2' });
    } catch (error) {
      logger.warn({ taskId: task.id, error: error.message }, 'Failed to send task notification');
    }
  });

  // F-014: Load and start scheduled tasks
  await scheduledTaskService.loadTasks();
  scheduledTaskService.startScheduler();

  // F-014: Initialize file watcher service
  fileWatcherService.initFileWatcherService({
    dataDir: config.systemMonitorDataDir,
    watchersFile: config.fileWatchersPath,
    maxWatchers: config.maxFileWatchers,
    debounceMs: config.taskDebounceMs,
    allowedRoots: config.telegramFileAllowedRoots.length > 0
      ? config.telegramFileAllowedRoots
      : [process.cwd()]
  });

  // F-014: Set up file watcher notification callback
  fileWatcherService.setNotificationCallback(async (chatId, watcher) => {
    try {
      const lines = [
        '📁 *文件变更检测*',
        '',
        `路径: \`${escapeMarkdownV2(watcher.path)}\``,
        `事件: ${watcher.eventType}`,
        `文件: ${watcher.filename || '(未知)'}`,
        `时间: ${new Date().toLocaleString()}`
      ];
      await bot.telegram.sendMessage(chatId, lines.join('\n'), { parse_mode: 'MarkdownV2' });
    } catch (error) {
      logger.warn({ watcherId: watcher.id, error: error.message }, 'Failed to send file watcher notification');
    }
  });

  // F-014: Restore file watchers
  await fileWatcherService.restoreWatches();

  // F-021: Load persisted CLI profiles and register them in backendRegistry
  profileStore.setDefaultProfileName('default');
  await profileStore.init({ persistencePath: config.cliProfilesPath });
  // Seed default profile if not yet in store
  if (!profileStore.hasProfile('default')) {
    await profileStore.addProfile({
      name: 'default',
      binPath: config.codebuddyBin,
      permissionFlag: config.codebuddyPermissionFlag || null,
      timeoutMs: null,
      description: 'Default backend (CODEBUDDY_BIN)'
    });
  }
  // Register default profile in backendRegistry
  try {
    backendRegistry.registerBackend('default', config.codebuddyBin, {
      description: 'Default backend (CODEBUDDY_BIN)',
      permissionFlag: config.codebuddyPermissionFlag || null
    });
  } catch {
    // Already registered — ok
  }
  // Load and register persisted non-default profiles
  for (const p of profileStore.listProfiles()) {
    if (p.name === 'default') continue;
    if (!backendRegistry.getBackend(p.name)) {
      try {
        backendRegistry.registerBackend(p.name, p.binPath, {
          description: p.description,
          permissionFlag: p.permissionFlag,
          timeoutMs: p.timeoutMs
        });
        logger.info(`F-021: Loaded profile "${p.name}" from ${config.cliProfilesPath}`);
      } catch (err) {
        logger.warn(`F-021: Profile "${p.name}" could not be registered: ${err.message}`);
      }
    }
  }

  // Register pipeline commands
  registerPipelineCommands();

  // F-018: Create unified message router for bidirectional sync
  const messageRouter = createMessageRouter({
    aiCliExecutor: executeAiCli,
    sessionStore,
    realtimeHub
  });

  // F-018: Initialize session bind service for cross-channel push
  const sessionBind = createSessionBindService({
    bindingsPath: config.sessionBindingsPath
  });

  // F-018: Cross-channel push — forward web-originated AI replies to bound Telegram chats.
  // Track active subscriptions to avoid duplicates.
  const crossChannelSubs = new Map(); // sessionKey -> unsubscribe fn

  /**
   * Subscribe to realtimeHub for a specific Telegram chat session key.
   * When a web-originated assistant_done event arrives, push the reply to Telegram.
   */
  function subscribeCrossChannel(telegramChatId) {
    const sessionKey = `telegram:${telegramChatId}`;
    if (crossChannelSubs.has(sessionKey)) {
      return; // already subscribed
    }

    const unsubscribe = realtimeHub.subscribe(sessionKey, (event) => {
      // Only forward assistant_done events from web channel
      if (event.type === 'assistant_done' && event.payload?.channel === 'web') {
        const reply = event.payload.reply;
        if (reply) {
          const chunks = splitMessage(reply);
          for (const chunk of chunks) {
            bot.telegram.sendMessage(telegramChatId, chunk).catch((err) => {
              logger.warn(
                { telegramChatId, err: err.message },
                'F-018: Failed to push web-originated reply to Telegram'
              );
            });
          }
        }
      }

      // Forward user_message events from web channel to notify Telegram
      if (event.type === 'user_message' && event.payload?.channel === 'web') {
        const msg = event.payload.message;
        if (msg) {
          bot.telegram.sendMessage(
            telegramChatId,
            `[Web] ${msg.length > 200 ? msg.substring(0, 200) + '...' : msg}`
          ).catch((err) => {
            logger.warn(
              { telegramChatId, err: err.message },
              'F-018: Failed to push web user message notification to Telegram'
            );
          });
        }
      }
    });

    crossChannelSubs.set(sessionKey, unsubscribe);
    logger.info({ sessionKey }, 'F-018: Cross-channel push subscription active');
  }

  // Subscribe for all existing bindings on startup
  // Wait for sessionBind to initialize before reading bindings
  sessionBind.init().then(() => {
    const allBindings = sessionBind.getAllBindings();
    for (const telegramChatId of new Set(Object.values(allBindings))) {
      subscribeCrossChannel(telegramChatId);
    }
    logger.info(
      { boundChats: Object.keys(allBindings).length },
      'F-018: Cross-channel push initialized for existing bindings'
    );
  }).catch((err) => {
    logger.error({ err: err.message }, 'F-018: Failed to initialize cross-channel push');
  });

  // Expose subscribeCrossChannel for dynamic binding (called when new bindings are created)
  bot._f018 = { subscribeCrossChannel, sessionBind, messageRouter };

  bot.catch(async (error, ctx) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message, chatId: ctx?.chat?.id, updateType: ctx?.updateType }, 'Unhandled error while processing telegram update');
    try {
      if (ctx?.chat?.id) {
        await ctx.telegram.sendMessage(ctx.chat.id, '处理请求时出现异常，请重试一次。');
      }
    } catch (notifyError) {
      logger.warn({ err: notifyError instanceof Error ? notifyError.message : String(notifyError) }, 'Failed to notify user after unhandled telegram error');
    }
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

      // F-018: Use message-router for unified processing
      const sessionKey = `telegram:${sessionId}`;

      // Track last heartbeat message for updates
      /** @type {{ message_id: number } | null} */
      let lastHeartbeatMsg = null;

      const routerResult = await messageRouter.processMessage({
        channel: 'telegram',
        sessionId,
        message: ctx.message.text,
        telegramChatId: sessionId,
        userId,
        hooks: {
          onStatus: (payload) => {
            if (payload.stage === 'running') {
              ctx.sendChatAction('typing').catch(() => undefined);
            }
          },
          onAssistantChunk: (data) => {
            // F-020: Strip ANSI codes and collapse \r progress lines before streaming to Telegram
            const cleanText = ansiProcessChunk(data.text);
            streamPublisher.push(cleanText);
          },
          onAssistantDone: (data) => {
            // Done event handled below after processMessage resolves
          }
        }
      });

      // Delete heartbeat message if exists
      if (lastHeartbeatMsg) {
        ctx.telegram.deleteMessage(ctx.chat.id, lastHeartbeatMsg.message_id).catch(() => {});
      }

      const replyText = routerResult.reply;

      // Extract file markers and send
      const { fileRefs, cleanedText } = extractFileMarkers(replyText);
      logger.info({ sessionId, fileRefsCount: fileRefs.length, fileRefs }, 'Parsed file markers from assistant reply');
      const finalText = cleanedText || (fileRefs.length > 0 ? '已执行，正在发送文件。' : '已执行。');

      streamPublisher.setFinalText(finalText);
      const streamed = await streamPublisher.finish();
      if (streamed.outputLength === 0) {
        await replyLargeText(ctx, finalText);
      }

      // F-020: Record full output in history (pre-split, pre-file-marker extraction)
      // Use sessionKey format consistent with message router (reuses sessionKey declared above)
      outputHistoryService.addOutput(sessionKey, ctx.message.text, replyText);

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
