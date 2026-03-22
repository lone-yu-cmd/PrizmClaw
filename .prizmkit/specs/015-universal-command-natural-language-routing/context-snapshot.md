# F-015 Context Snapshot — Universal Command Natural-Language Routing

## Section 1 — Feature Brief

### Feature Description

为 Telegram 命令系统新增统一自然语言路由层：不仅 `/p`，而是所有命令入口都支持“命令 + 自然语言补充”与“纯自然语言意图”两种输入。系统需先进行意图识别，再映射到对应命令 handler（如 pipeline/planner/bugfix/file/system），避免被固定子命令解析器误判。

该能力需要与现有严格命令协议兼容：显式结构化参数优先、自然语言作为增强层；当语义冲突或置信度不足时，返回候选动作与确认提示，保证可控与可解释。

### Acceptance Criteria

- 所有核心命令入口（如 /pipeline、/planner、/bugfix、文件与系统命令）都可接受自然语言补充输入
- 用户发送纯自然语言请求时，系统可识别意图并路由到正确命令链路（或要求确认）
- 显式结构化参数优先于自然语言推断，现有严格子命令行为不回归
- 语义冲突或低置信度场景会返回候选动作与修正建议，而非直接报未知子命令
- 新增意图路由测试矩阵，覆盖多命令类别、歧义输入与回退路径

## Section 2 — Project Structure

### `ls src`

```text
adapters
bot
config.js
http
index.js
pipeline-infra
routes
security
services
utils
```

### `ls src/bot`

```text
commands
telegram.js
```

### `ls src/bot/commands`

```text
formatter.js
handlers
help.js
index.js
parser.js
registry.js
validator.js
```

### `ls src/bot/commands/handlers`

```text
alias.js
audit.js
bugfix.js
cat.js
cd.js
commit.js
commits.js
cron.js
download.js
find.js
head.js
history.js
jobs.js
kill.js
logs.js
ls.js
monitor.js
more.js
pipeline.js
plan.js
planner.js
ps.js
sessions.js
status.js
stop.js
sysinfo.js
tail.js
tree.js
upload.js
watch.js
```

### `ls tests/bot/commands`

```text
fixtures
formatter.test.js
handlers
parser.test.js
registry.test.js
validator.test.js
```

### `ls tests/integration`

```text
ai-cli-error-handling.test.js
ai-cli-heartbeat.test.js
ai-cli-markdownv2.test.js
ai-cli-telegram.test.js
commit-flow.test.js
commit-validation.test.js
commit-workflow.test.js
e2e-main-chain.test.js
f001-infrastructure.integration.test.js
f001-user-stories.integration.test.js
f002-command-router.integration.test.js
f002-user-stories.integration.test.js
f003-plan-ingestion.integration.test.js
f004-extended.integration.test.js
f004-pipeline-controller.integration.test.js
f005-extended.integration.test.js
f005-status-and-logs.integration.test.js
f009-command-executor.integration.test.js
f010-file-manager.test.js
f011-comprehensive.test.js
f012-system-monitor.test.js
f014-file-watchers.test.js
f014-scheduled-tasks.test.js
plan-version-flow.test.js
security-extended.test.js
security-flow.test.js
```

## Section 3 — Prizm Context

### .prizm-docs/root.prizm

```text
PRIZM_VERSION: 2
PROJECT: PrizmClaw
LANG: JavaScript
FRAMEWORK: Node.js ES2022 + TypeScript
TECH_STACK: Express, Telegraf, Zod, Pino logging
BUILD: npm start (node src/index.js)
TEST: npm test
ENTRY: src/index.js
MODULE_INDEX:
- bot -> .prizm-docs/bot.prizm
- services -> .prizm-docs/services.prizm
- pipeline-infra -> .prizm-docs/pipeline-infra.prizm
- security -> .prizm-docs/security.prizm
- utils -> .prizm-docs/utils.prizm
- http -> .prizm-docs/http.prizm
- routes -> .prizm-docs/routes.prizm
- adapters -> .prizm-docs/adapters.prizm
RULES:
- Progressive loading: read L0 on session start, L1 on module task, L2 before file edits
- Keep .prizm docs KEY: value with dash lists only; avoid prose and markdown headers
- Use append-only updates for DECISIONS and CHANGELOG sections
- Feature development updates .prizm-docs; bug-fix-only logic changes can skip doc updates
- Keep hard size limits: root<=4KB, L1<=3KB, L2<=5KB
- Before commit: run /prizmkit-retrospective then /prizmkit-committer
- Commit messages use Conventional Commits; bug fixes use fix(scope): description
- Prefer fast path for clear bug/config/refactor tasks; full workflow for multi-module feature changes
UPDATED: 2026-03-19
```

### .prizm-docs/bot.prizm

```text
MODULE: bot
FILES: 37 total
RESPONSIBILITY: Telegram bot command routing and message handling
SUBDIRS:
- commands -> .prizm-docs/bot/commands.prizm
KEY_FILES:
- src/bot/telegram.js: bot bootstrap, command registration, text/document handlers, stream/file reply orchestration
- src/bot/commands/index.js: command router entry and middleware exports
- src/bot/commands/registry.js: command metadata registry and alias map
- src/bot/commands/parser.js: slash command tokenization and option parsing
- src/bot/commands/validator.js: parameter/subcommand validation and normalization
- src/bot/commands/help.js: dynamic help text generator from registry
- src/bot/commands/formatter.js: user-facing command error formatting
INTERFACES:
- createTelegramBot(): Promise<Telegraf>
- routeCommand(ctx): Promise<boolean>
- createCommandMiddleware(): (ctx,next)=>Promise<void>
- registerCommand(meta, handler): void
- getCommand(name): CommandEntry|null
- parseCommand(text, aliasMap?): ParsedCommand|null
- validateCommand(parsed, meta): ValidationResult
- generateHelp(commandName?): string
DEPENDENCIES:
- telegraf: Telegram bot framework and update context
- src/security/*: allowlist, roles, permission checks
- src/services/*: chat, ai-cli, command executor, audit, scheduling
- src/pipeline-infra/*: plan ingestion and pipeline control integration
- src/utils/markdown-v2-formatter.js: Telegram-safe rendering
UPDATED: 2026-03-19
```

### .prizm-docs/bot/commands.prizm

```text
MODULE: bot/commands
FILES: src/bot/commands/**/*.js (36 files)
KEY_FILES:
- src/bot/commands/index.js: routeCommand orchestration and handler context assembly
- src/bot/commands/registry.js: command registration, alias mapping, help source of truth
- src/bot/commands/parser.js: parses /cmd subcommand args --key=value flags
- src/bot/commands/validator.js: schema-style validation and normalized params output
- src/bot/commands/formatter.js: standardized command error responses
- src/bot/commands/help.js: general and per-command usage generation
- src/bot/commands/handlers/pipeline.js: feature pipeline launch/status/logs control
- src/bot/commands/handlers/bugfix.js: bugfix pipeline command surface
- src/bot/commands/handlers/commit.js: commit workflow command facade
- src/bot/commands/handlers/cron.js: scheduled task create/list/pause/resume/delete
DEPENDENCIES:
- imports: src/security/guard.js: base user authorization gate
- imports: src/security/permission-guard.js: role based command authorization
- imports: src/services/audit-log-service.js: denied/critical action audit trail
- imports: src/services/command-executor-service.js: /exec command execution pipeline
- imports: src/services/output-pager-service.js: paginated long output and /more follow-up
- imports: src/services/*-service.js: pipeline, monitor, session, alias, watcher integrations
TRAPS:
- handler contract pattern: every handler exports <name>Meta and handle<Name>; missing pair breaks registration
- registration coupling: handlers are active only when registerPipelineCommands() wires meta+handler in telegram bootstrap
- parser behavior: first non-option token becomes subcommand candidate; validator remaps for commands without declared subcommands
- permission chain: routeCommand enforces allowlist and role checks before handler invocation; bypass causes inconsistent security behavior
- long output flow: handlers should paginate/store extra pages; sending full raw output can exceed Telegram limits
- alias flow: user aliases resolve before parse/validate; avoid hard-coding command names in downstream logic
CHANGELOG:
- 2026-03-19 | add: initial L2 documentation for bot commands routing and handler patterns
UPDATED: 2026-03-19
```

### .prizm-docs/services.prizm

```text
MODULE: services
FILES: 26 total
RESPONSIBILITY: Business logic services for chat bridge, git/commit workflow, pipeline control, monitoring, sessions, and scheduling
KEY_FILES:
- src/services/chat-service.js: session prompt assembly and CodeBuddy adapter invocation
- src/services/ai-cli-service.js: process-tracked AI CLI execution with heartbeat and interrupt
- src/services/command-executor-service.js: secured shell execution, confirmation flow, output pagination
- src/services/pipeline-controller.js: start/stop/retry/status/logs orchestration with locks/state
- src/services/plan-ingestion-service.js: JSON schema validation, versioning, active plan registry
- src/services/session-context-service.js: session lifecycle, persistence, timeout cleanup
- src/services/scheduled-task-service.js: cron/one-time task scheduling and callback dispatch
- src/services/file-watcher-service.js: fs.watch-based watcher registry and notification debounce
INTERFACES:
- chatWithSession(params): Promise<string>
- executeAiCli(options): Promise<AiCliExecutionResult>
- executeCommand(options): Promise<CommandResult>
- createPipelineController(options): PipelineController
- createPipelineControlService(options): PipelineControlService
- createPlanIngestionService(config): PlanIngestionService
- createCommitService(options): CommitService
- createStatusAggregator(options): StatusAggregator
- createLogPager(options): LogPager
DEPENDENCIES:
- simple-git: git status and commit operations
- ajv: plan schema compilation/validation
- croner: cron expression scheduling runtime
- node:child_process/fs/path/events: process and state I/O primitives
- src/pipeline-infra/*: script execution, config, lock/state/path policies
- src/security/*: permission, confirmation, blacklist/high-risk checks
UPDATED: 2026-03-19
```

### .prizm-docs/security.prizm

```text
MODULE: security
FILES: 6
RESPONSIBILITY: Authentication checks, role-based command permissions, parameter sanitization, and high-risk confirmation controls
KEY_FILES:
- src/security/guard.js: allowed user gate and prompt input sanitization
- src/security/permission-guard.js: role hierarchy and per-command permission rules
- src/security/param-sanitizer.js: dangerous pattern detection and safe param normalization
- src/security/confirmation-manager.js: pending confirmation lifecycle with timeout
- src/security/system-guard.js: system-exec enablement, allowlist, blacklist, high-risk keyword checks
- src/security/index.js: module export hub
INTERFACES:
- isAllowedUser(userId): boolean
- sanitizeInput(input): string
- getUserRole(userId): 'admin'|'operator'|'viewer'
- checkCommandPermission(userId, command): PermissionResult
- sanitizeParam(input, options?): SanitizedParamResult
- validatePath(inputPath, allowedRoots): PathValidationResult
- createConfirmation(userId, action, params, timeoutMs?): ConfirmationPrompt
- confirmAction(confirmId, userId): ConfirmResult
- checkCommandBlacklist(command, blacklist): BlacklistCheckResult
- detectHighRiskKeywords(command, keywords): HighRiskCheckResult
UPDATED: 2026-03-19
```

### .prizm-docs/utils.prizm

```text
MODULE: utils
FILES: 4
RESPONSIBILITY: Shared utility helpers for logging, file formatting, heartbeat lifecycle, and Telegram MarkdownV2 conversion
KEY_FILES:
- src/utils/logger.js: centralized pino logger factory/instance
- src/utils/file-utils.js: file size/date/content helpers for file manager commands
- src/utils/heartbeat-manager.js: reusable heartbeat timer and manager abstraction
- src/utils/markdown-v2-formatter.js: markdown escaping and segmentation for Telegram limits
INTERFACES:
- logger: pino.Logger
- formatFileSize(bytes): string
- formatDate(date): string
- isBinaryContent(buffer, sampleSize?): boolean
- startHeartbeat(options): stopFn
- createHeartbeatManager(): {start,stop,isRunning}
- escapeMarkdownV2(text): string
- convertToMarkdownV2(markdown): string
- splitRespectingCodeBlocks(text, maxLength?): string[]
DEPENDENCIES:
- pino: structured logging backend
- node runtime timers and Buffer APIs
UPDATED: 2026-03-19
```

## Section 4 — Existing Source Files

### src/bot/telegram.js (1004 lines)

```js
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
// F-014: Notification and Scheduled Tasks command handlers
import { cronMeta, handleCron } from './commands/handlers/cron.js';
import { jobsMeta, handleJobs } from './commands/handlers/jobs.js';
import { watchMeta, handleWatch } from './commands/handlers/watch.js';
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
  // F-014: Notification and Scheduled Tasks commands
  registerCommand(cronMeta, handleCron);
  registerCommand(jobsMeta, handleJobs);
  registerCommand(watchMeta, handleWatch);
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
        `执行时间: ${new Date(result.executedAt || Date.now()).toLocaleString()}`,
        '',
        `exitCode: ${result.exitCode}`,
        result.stdout ? `stdout:\n${truncate(result.stdout, 500)}` : 'stdout: (empty)',
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

  // Register pipeline commands
  registerPipelineCommands();

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

```

### src/bot/commands/index.js (193 lines)

```js
/**
 * Command Router
 * Main entry point for command routing and dispatch.
 */

import { parseCommand } from './parser.js';
import { getCommand, getAliasMap, registerCommand } from './registry.js';
import { validateCommand } from './validator.js';
import { formatError, formatValidationErrors, ErrorCodes } from './formatter.js';
import { isAllowedUser } from '../../security/guard.js';
import { checkCommandPermission, getUserRole } from '../../security/permission-guard.js';
import { logAuditEntry } from '../../services/audit-log-service.js';
import { aliasStore } from '../../services/alias-store.js';
import { sessionStore } from '../../services/session-store.js';

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 * @typedef {import('./registry.js').CommandMeta} CommandMeta
 * @typedef {import('./registry.js').CommandEntry} CommandEntry
 */

/**
 * Build session ID from context.
 * @param {Object} ctx - Telegraf context
 * @returns {string} Session ID
 */
function buildSessionId(ctx) {
  return String(ctx.chat.id);
}

/**
 * Route and dispatch a command from Telegram context.
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<boolean>} True if command was handled
 */
export async function routeCommand(ctx) {
  let text = ctx.message?.text;

  if (!text || !text.startsWith('/')) {
    return false;
  }

  // Authorization check
  const userId = ctx.from?.id;
  if (!isAuthorized(userId)) {
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNAUTHORIZED)));
    return true;
  }

  const sessionId = buildSessionId(ctx);
  const userIdStr = String(userId);

  // F-013: Touch session on each command
  sessionStore.touchSession(sessionId, userIdStr);

  // F-013: Resolve alias if the command name is an alias
  const commandMatch = text.match(/^\/(\S+)/);
  if (commandMatch) {
    const potentialAlias = commandMatch[1].toLowerCase();
    const resolvedCommand = aliasStore.resolveAlias(userIdStr, potentialAlias);
    if (resolvedCommand) {
      // Replace the alias with the resolved command
      const args = text.slice(commandMatch[0].length);
      text = `/${resolvedCommand}${args}`;
    }
  }

  // Parse command
  const aliasMap = getAliasMap();
  const parsed = parseCommand(text, aliasMap);

  if (!parsed) {
    await ctx.reply('无法解析命令。');
    return true;
  }

  // Lookup command
  const entry = getCommand(parsed.command);

  if (!entry) {
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.UNKNOWN_COMMAND, { command: parsed.command })));
    return true;
  }

  const { meta, handler } = entry;

  // T-101: Permission check
  const commandName = meta.name;
  const permResult = checkCommandPermission(userId, commandName);

  if (!permResult.allowed) {
    // Log denied access
    await logAuditEntry({
      userId,
      action: commandName,
      params: {},
      result: 'denied',
      reason: permResult.reason
    });

    await ctx.reply(`⛔ ${permResult.reason}`);
    return true;
  }

  // Validate command
  const validation = validateCommand(parsed, meta);

  if (!validation.valid) {
    const errorMsg = formatValidationErrors(validation.errors, meta.usage);
    await ctx.reply(errorMsg);
    return true;
  }

  // Create handler context
  const handlerContext = {
    ctx,
    parsed,
    meta,
    params: validation.normalized || {},
    userId,
    userRole: getUserRole(userId),
    sessionId,
    requiresConfirmation: permResult.requiresConfirmation,
    reply: async (text) => ctx.reply(text),
    replyFile: async (content, filename) => {
      // Will be implemented with proper file handling
      await ctx.replyWithDocument({ source: Buffer.from(content), filename });
    },
    args: parsed.args || []
  };

  // Dispatch to handler
  try {
    await handler(handlerContext);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.reply(formatErrorResponse(formatError(ErrorCodes.INTERNAL_ERROR, { reason: message })));
  }

  return true;
}

/**
 * Check if user is authorized.
 * @param {number|string|undefined} userId - User ID
 * @returns {boolean} True if authorized
 */
function isAuthorized(userId) {
  return isAllowedUser(userId);
}

/**
 * Format error response for display.
 * @param {Object} error - Error object
 * @returns {string} Formatted error
 */
function formatErrorResponse(error) {
  const lines = [`❌ ${error.message}`];

  if (error.suggestion) {
    lines.push(`💡 ${error.suggestion}`);
  }

  if (error.usage) {
    lines.push(`用法: ${error.usage}`);
  }

  return lines.join('\n');
}

/**
 * Register all default commands.
 */
export function registerDefaultCommands() {
  // Commands will be registered by individual handlers
  // This is called during initialization
}

/**
 * Create middleware for command routing.
 * @returns {Function} Middleware function
 */
export function createCommandMiddleware() {
  return async (ctx, next) => {
    const handled = await routeCommand(ctx);
    if (!handled) {
      return next();
    }
  };
}

// Re-export for convenience
export { registerCommand, getCommand, getAliasMap };

```

### src/bot/commands/parser.js (94 lines)

```js
/**
 * Command Parser
 * Parses Telegram message text into structured ParsedCommand object.
 */

/**
 * @typedef {Object} ParsedCommand
 * @property {string} command - The command name (e.g., "pipeline")
 * @property {string} [subcommand] - Optional subcommand (e.g., "run")
 * @property {string[]} args - Positional arguments
 * @property {Record<string, string>} options - Key-value options (--key=value)
 * @property {string} raw - Original message text
 */

/**
 * Parse Telegram message text into a structured command object.
 * @param {string} text - The message text to parse
 * @param {Object} [aliasMap={}] - Map of aliases to command names
 * @returns {ParsedCommand | null} Parsed command or null if not a command
 */
export function parseCommand(text, aliasMap = {}) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();

  // Must start with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Extract command (first token after /)
  const tokens = trimmed.slice(1).split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) {
    return null;
  }

  let command = tokens[0].toLowerCase();
  const rest = tokens.slice(1);

  // Handle @bot suffix (e.g., /command@mybot)
  const atIndex = command.indexOf('@');
  if (atIndex !== -1) {
    command = command.slice(0, atIndex);
  }

  // Apply alias mapping
  if (aliasMap[command]) {
    command = aliasMap[command];
  }

  const args = [];
  /** @type {Record<string, string>} */
  const options = {};
  let subcommand = undefined;

  for (const token of rest) {
    // Parse --key=value options
    if (token.startsWith('--')) {
      const optionText = token.slice(2);
      const eqIndex = optionText.indexOf('=');
      if (eqIndex !== -1) {
        const key = optionText.slice(0, eqIndex).toLowerCase();
        const value = optionText.slice(eqIndex + 1);
        options[key] = value;
      } else {
        // Boolean flag --flag
        options[optionText.toLowerCase()] = 'true';
      }
    } else if (token.includes('=')) {
      // Parse key=value (without --)
      const eqIndex = token.indexOf('=');
      const key = token.slice(0, eqIndex).toLowerCase();
      const value = token.slice(eqIndex + 1);
      options[key] = value;
    } else if (subcommand === undefined && !token.startsWith('-') && args.length === 0) {
      // First non-option token is subcommand if it looks like one
      // This will be validated by the registry
      subcommand = token.toLowerCase();
    } else {
      // Positional argument
      args.push(token);
    }
  }

  return {
    command,
    subcommand,
    args,
    options,
    raw: text
  };
}

```

### src/bot/commands/registry.js (220 lines)

```js
/**
 * Command Registry
 * Manages command registration, lookup, and metadata.
 */

/**
 * @typedef {Object} ParamMeta
 * @property {string} name - Parameter name
 * @property {boolean} required - Whether the parameter is required
 * @property {string} description - Parameter description
 * @property {string} [type] - Parameter type (string, number, enum)
 * @property {string[]} [enum] - Allowed values for enum type
 * @property {*} [default] - Default value
 */

/**
 * @typedef {Object} SubcommandMeta
 * @property {string} name - Subcommand name
 * @property {string} description - Subcommand description
 * @property {ParamMeta[]} [params] - Subcommand parameters
 */

/**
 * @typedef {Object} CommandMeta
 * @property {string} name - Command name
 * @property {string[]} [aliases] - Command aliases
 * @property {string} description - Command description
 * @property {string} usage - Usage example
 * @property {string[]} [examples] - Usage examples
 * @property {SubcommandMeta[]} [subcommands] - Available subcommands
 * @property {ParamMeta[]} [params] - Command parameters
 * @property {boolean} requiresAuth - Whether authorization is required
 * @property {string} [minRole] - Minimum required role (viewer, operator, admin)
 * @property {boolean} [requiresConfirmation] - Whether confirmation is required for high-risk commands
 * @property {string} helpText - Help text for the command
 */

/**
 * @typedef {Object} CommandEntry
 * @property {CommandMeta} meta - Command metadata
 * @property {Function} handler - Command handler function
 */

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 */

// Internal registry storage
const commands = new Map();
const aliasToCommand = new Map();

/**
 * Register a command with its metadata and handler.
 * @param {CommandMeta} meta - Command metadata
 * @param {Function} handler - Command handler function
 * @throws {Error} If command already registered
 */
export function registerCommand(meta, handler) {
  if (!meta || !meta.name) {
    throw new Error('Command meta must have a name');
  }

  // Normalize meta with lowercase name
  const normalizedMeta = {
    ...meta,
    name: meta.name.toLowerCase()
  };
  const name = normalizedMeta.name;

  if (commands.has(name)) {
    throw new Error(`Command "${name}" is already registered`);
  }

  // Register command
  commands.set(name, { meta: normalizedMeta, handler });

  // Register aliases
  if (meta.aliases && Array.isArray(meta.aliases)) {
    for (const alias of meta.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasToCommand.has(aliasLower)) {
        throw new Error(`Alias "${alias}" is already registered`);
      }
      aliasToCommand.set(aliasLower, name);
    }
  }
}

/**
 * Get a command entry by name or alias.
 * @param {string} name - Command name or alias
 * @returns {CommandEntry | null} Command entry or null
 */
export function getCommand(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const nameLower = name.toLowerCase();

  // Try direct lookup
  if (commands.has(nameLower)) {
    return commands.get(nameLower);
  }

  // Try alias lookup
  const resolvedName = aliasToCommand.get(nameLower);
  if (resolvedName && commands.has(resolvedName)) {
    return commands.get(resolvedName);
  }

  return null;
}

/**
 * Check if a name is a registered alias.
 * @param {string} name - Name to check
 * @returns {boolean} True if name is an alias
 */
export function isAlias(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return aliasToCommand.has(name.toLowerCase());
}

/**
 * Get all registered commands.
 * @returns {CommandEntry[]} All command entries
 */
export function getAllCommands() {
  return Array.from(commands.values());
}

/**
 * Generate help text for a specific command or all commands.
 * @param {string} [commandName] - Optional command name for specific help
 * @returns {string} Help text
 */
export function getHelpText(commandName) {
  if (commandName) {
    const entry = getCommand(commandName);
    if (!entry) {
      return `未知命令 '${commandName}'。输入 /help 查看可用命令。`;
    }
    return formatCommandHelp(entry.meta);
  }

  // Generate general help
  const commandList = getAllCommands()
    .map((entry) => {
      const aliases = entry.meta.aliases?.length ? ` (${entry.meta.aliases.map((a) => `/${a}`).join(', ')})` : '';
      return `/${entry.meta.name}${aliases} - ${entry.meta.description}`;
    })
    .sort();

  return `可用命令：\n\n${commandList.join('\n')}`;
}

/**
 * Format detailed help for a single command.
 * @param {CommandMeta} meta - Command metadata
 * @returns {string} Formatted help text
 */
function formatCommandHelp(meta) {
  const lines = [`/${meta.name} - ${meta.description}`];

  if (meta.aliases?.length) {
    lines.push(`别名: ${meta.aliases.map((a) => `/${a}`).join(', ')}`);
  }

  if (meta.usage) {
    lines.push(`用法: ${meta.usage}`);
  }

  if (meta.subcommands?.length) {
    lines.push('\n子命令:');
    for (const sub of meta.subcommands) {
      lines.push(`  ${sub.name} - ${sub.description}`);
    }
  }

  if (meta.params?.length) {
    lines.push('\n参数:');
    for (const param of meta.params) {
      const required = param.required ? '(必填)' : '(可选)';
      lines.push(`  ${param.name} ${required} - ${param.description}`);
    }
  }

  if (meta.examples?.length) {
    lines.push('\n示例:');
    for (const example of meta.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}

/**
 * Clear the registry (for testing).
 */
export function clearRegistry() {
  commands.clear();
  aliasToCommand.clear();
}

/**
 * Get the alias map for parser usage.
 * @returns {Record<string, string>} Alias to command name mapping
 */
export function getAliasMap() {
  /** @type {Record<string, string>} */
  const map = {};
  for (const [alias, command] of aliasToCommand) {
    map[alias] = command;
  }
  return map;
}

```

### src/bot/commands/validator.js (223 lines)

```js
/**
 * Command Validator
 * Validates command parameters and generates error messages.
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} param - Parameter name
 * @property {string} message - Error message
 * @property {string} [suggestion] - Correction suggestion
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Validation errors
 * @property {Record<string, *>} [normalized] - Normalized parameters
 */

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 * @typedef {import('./registry.js').CommandMeta} CommandMeta
 * @typedef {import('./registry.js').ParamMeta} ParamMeta
 * @typedef {import('./registry.js').SubcommandMeta} SubcommandMeta
 */

/**
 * Validate a parsed command against its metadata.
 * @param {ParsedCommand} parsed - Parsed command
 * @param {CommandMeta} meta - Command metadata
 * @returns {ValidationResult} Validation result
 */
export function validateCommand(parsed, meta) {
  const errors = [];
  /** @type {Record<string, *>} */
  const normalized = { ...parsed.options };

  // Validate subcommand if command has subcommands
  if (meta.subcommands?.length) {
    const validSubcommands = meta.subcommands.map((s) => s.name);
    if (parsed.subcommand && !validSubcommands.includes(parsed.subcommand)) {
      errors.push({
        param: 'subcommand',
        message: `未知子命令 '${parsed.subcommand}'`,
        suggestion: `可用子命令: ${validSubcommands.join(', ')}`
      });
    }
  }

  // Get applicable params
  const params = getParamsForSubcommand(meta, parsed.subcommand);

  // Validate parameters
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const value = getParamValue(parsed, param.name, meta, i);
    const validationResult = validateParam(param, value);

    if (!validationResult.valid) {
      errors.push(validationResult.error);
    } else if (validationResult.value !== undefined) {
      normalized[param.name] = validationResult.value;
    }
  }

  // Add positional args to normalized
  if (parsed.args.length > 0) {
    normalized._args = parsed.args;
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : undefined
  };
}

/**
 * Get parameters applicable to a subcommand.
 * @param {CommandMeta} meta - Command metadata
 * @param {string|undefined} subcommand - Subcommand name
 * @returns {ParamMeta[]} Parameters
 */
function getParamsForSubcommand(meta, subcommand) {
  const params = [...(meta.params || [])];

  // Add subcommand-specific params
  if (subcommand && meta.subcommands) {
    const subMeta = meta.subcommands.find((s) => s.name === subcommand);
    if (subMeta?.params) {
      params.push(...subMeta.params);
    }
  }

  return params;
}

/**
 * Get parameter value from parsed command.
 * @param {ParsedCommand} parsed - Parsed command
 * @param {string} paramName - Parameter name
 * @param {CommandMeta} meta - Command metadata
 * @param {number} paramIndex - Index of parameter in params array
 * @returns {string|undefined} Parameter value
 */
function getParamValue(parsed, paramName, meta, paramIndex) {
  // Check options first (explicit --key=value takes precedence)
  if (parsed.options[paramName] !== undefined) {
    return parsed.options[paramName];
  }

  // Build positional args list
  // If command has no subcommands, parsed.subcommand should be treated as first positional arg
  const hasSubcommands = meta.subcommands && meta.subcommands.length > 0;
  const positionalArgs = [];

  if (!hasSubcommands && parsed.subcommand !== undefined) {
    // F002-CRIT-001: Treat subcommand as first positional param when command has no subcommands
    positionalArgs.push(parsed.subcommand);
  }

  // Add remaining args
  positionalArgs.push(...parsed.args);

  // Map positional arg by index
  if (paramIndex !== undefined && positionalArgs[paramIndex] !== undefined) {
    return positionalArgs[paramIndex];
  }

  return undefined;
}

/**
 * Validate a single parameter.
 * @param {ParamMeta} param - Parameter metadata
 * @param {string|undefined} value - Parameter value
 * @returns {{valid: boolean, error?: ValidationError, value?: *}}
 */
function validateParam(param, value) {
  // Check required
  if (param.required && (value === undefined || value === '')) {
    return {
      valid: false,
      error: {
        param: param.name,
        message: `缺少参数 '${param.name}'`,
        suggestion: `请提供 ${param.name} 参数`
      }
    };
  }

  // If not provided and has default, use default
  if (value === undefined && param.default !== undefined) {
    return { valid: true, value: param.default };
  }

  // If not provided and not required, OK
  if (value === undefined) {
    return { valid: true };
  }

  // Type validation
  if (param.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return {
        valid: false,
        error: {
          param: param.name,
          message: `参数 '${param.name}' 必须是数字`,
          suggestion: `请输入有效的数字`
        }
      };
    }
    return { valid: true, value: num };
  }

  // Enum validation
  if (param.type === 'enum' && param.enum?.length) {
    if (!param.enum.includes(value)) {
      return {
        valid: false,
        error: {
          param: param.name,
          message: `参数 '${param.name}' 值无效: ${value}`,
          suggestion: `可选值: ${param.enum.join(', ')}`
        }
      };
    }
  }

  return { valid: true, value };
}

/**
 * Validate that a subcommand is valid for a command.
 * @param {string} subcommand - Subcommand name
 * @param {SubcommandMeta[]} subcommands - Available subcommands
 * @returns {{valid: boolean, error?: ValidationError}}
 */
export function validateSubcommand(subcommand, subcommands) {
  if (!subcommand) {
    return { valid: true };
  }

  const validNames = (subcommands || []).map((s) => s.name);
  if (validNames.length === 0) {
    return { valid: true };
  }

  if (!validNames.includes(subcommand)) {
    return {
      valid: false,
      error: {
        param: 'subcommand',
        message: `未知子命令 '${subcommand}'`,
        suggestion: `可用子命令: ${validNames.join(', ')}`
      }
    };
  }

  return { valid: true };
}

```

### src/bot/commands/formatter.js (139 lines)

```js
/**
 * Error Formatter
 * Formats error messages for user-friendly display.
 */

/**
 * Error codes for command errors.
 */
export const ErrorCodes = {
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  UNKNOWN_SUBCOMMAND: 'UNKNOWN_SUBCOMMAND',
  MISSING_PARAM: 'MISSING_PARAM',
  INVALID_PARAM: 'INVALID_PARAM',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * @typedef {Object} ErrorResponse
 * @property {string} code - Error code
 * @property {string} message - User-friendly error message
 * @property {string} [suggestion] - Correction suggestion
 * @property {string} [usage] - Correct usage example
 */

/**
 * Format an error for display to the user.
 * @param {string} code - Error code
 * @param {Object} context - Error context
 * @param {string} [context.command] - Command name
 * @param {string} [context.subcommand] - Subcommand name
 * @param {string} [context.param] - Parameter name
 * @param {string} [context.value] - Invalid value
 * @param {string} [context.reason] - Error reason
 * @param {string} [context.suggestion] - Custom suggestion
 * @param {string} [context.usage] - Correct usage
 * @param {string[]} [context.available] - Available options
 * @returns {ErrorResponse} Formatted error
 */
export function formatError(code, context = {}) {
  switch (code) {
    case ErrorCodes.UNKNOWN_COMMAND:
      return {
        code,
        message: `未知命令 '${context.command || ''}'。`,
        suggestion: '输入 /help 查看可用命令。'
      };

    case ErrorCodes.UNKNOWN_SUBCOMMAND:
      return {
        code,
        message: `未知子命令 '${context.subcommand || ''}'。`,
        suggestion: context.available ? `可用: ${context.available.join(', ')}` : undefined,
        usage: context.usage
      };

    case ErrorCodes.MISSING_PARAM:
      return {
        code,
        message: `缺少参数 '${context.param || ''}'。`,
        suggestion: context.suggestion || `请提供 ${context.param} 参数`,
        usage: context.usage
      };

    case ErrorCodes.INVALID_PARAM:
      return {
        code,
        message: `参数 '${context.param || ''}' 无效: ${context.reason || ''}`,
        suggestion: context.suggestion,
        usage: context.usage
      };

    case ErrorCodes.UNAUTHORIZED:
      return {
        code,
        message: '当前账号未被授权使用该命令。',
        suggestion: '请联系管理员获取授权。'
      };

    case ErrorCodes.INTERNAL_ERROR:
      return {
        code,
        message: '内部错误，请稍后重试。',
        suggestion: context.reason ? `错误: ${context.reason}` : undefined
      };

    default:
      return {
        code: ErrorCodes.INTERNAL_ERROR,
        message: '未知错误。'
      };
  }
}

/**
 * Format validation errors into a single message.
 * @param {import('./validator.js').ValidationError[]} errors - Validation errors
 * @param {string} [usage] - Usage hint
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors, usage) {
  if (!errors || errors.length === 0) {
    return '';
  }

  const lines = [];

  for (const error of errors) {
    lines.push(`❌ ${error.message}`);
    if (error.suggestion) {
      lines.push(`   建议: ${error.suggestion}`);
    }
  }

  if (usage) {
    lines.push(`\n用法: ${usage}`);
  }

  return lines.join('\n');
}

/**
 * Format an error response into a display string.
 * @param {ErrorResponse} error - Error response
 * @returns {string} Formatted string
 */
export function formatErrorResponse(error) {
  const lines = [`❌ ${error.message}`];

  if (error.suggestion) {
    lines.push(`💡 ${error.suggestion}`);
  }

  if (error.usage) {
    lines.push(`用法: ${error.usage}`);
  }

  return lines.join('\n');
}

```

### src/bot/commands/help.js (130 lines)

```js
/**
 * Help Text Generator
 * Generates help text for commands.
 */

import { getCommand, getAllCommands } from './registry.js';

/**
 * Generate help text for all commands or a specific command.
 * @param {string} [commandName] - Optional command name
 * @returns {string} Help text
 */
export function generateHelp(commandName) {
  if (commandName) {
    return generateCommandHelp(commandName);
  }
  return generateGeneralHelp();
}

/**
 * Generate general help text listing all commands.
 * @returns {string} Help text
 */
function generateGeneralHelp() {
  const commands = getAllCommands();

  if (commands.length === 0) {
    return '暂无可用命令。';
  }

  const lines = ['可用命令：', ''];

  for (const entry of commands) {
    const { meta } = entry;
    const aliases = meta.aliases?.length ? ` (${meta.aliases.map((a) => `/${a}`).join(', ')})` : '';
    lines.push(`/${meta.name}${aliases}`);
    lines.push(`  ${meta.description}`);
    lines.push('');
  }

  lines.push('输入 /help <命令> 查看详细用法。');

  return lines.join('\n');
}

/**
 * Generate detailed help text for a specific command.
 * @param {string} commandName - Command name
 * @returns {string} Help text
 */
function generateCommandHelp(commandName) {
  const entry = getCommand(commandName);

  if (!entry) {
    return `未知命令 '${commandName}'。输入 /help 查看可用命令。`;
  }

  const { meta } = entry;
  const lines = [];

  // Command name and description
  lines.push(`/${meta.name} - ${meta.description}`);
  lines.push('');

  // Aliases
  if (meta.aliases?.length) {
    lines.push(`别名: ${meta.aliases.map((a) => `/${a}`).join(', ')}`);
    lines.push('');
  }

  // Usage
  if (meta.usage) {
    lines.push(`用法: ${meta.usage}`);
    lines.push('');
  }

  // Subcommands
  if (meta.subcommands?.length) {
    lines.push('子命令:');
    for (const sub of meta.subcommands) {
      lines.push(`  ${sub.name} - ${sub.description}`);
    }
    lines.push('');
  }

  // Parameters
  if (meta.params?.length) {
    lines.push('参数:');
    for (const param of meta.params) {
      const required = param.required ? '(必填)' : '(可选)';
      const type = param.type ? ` [${param.type}]` : '';
      const enumValues = param.enum ? ` {${param.enum.join(', ')}}` : '';
      const defaultVal = param.default !== undefined ? ` = ${param.default}` : '';
      lines.push(`  ${param.name}${type}${enumValues}${defaultVal} ${required}`);
      lines.push(`    ${param.description}`);
    }
    lines.push('');
  }

  // Examples
  if (meta.examples?.length) {
    lines.push('示例:');
    for (const example of meta.examples) {
      lines.push(`  ${example}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Generate quick reference for all commands.
 * @returns {string} Quick reference text
 */
export function generateQuickReference() {
  const commands = getAllCommands();

  if (commands.length === 0) {
    return '暂无可用命令。';
  }

  const lines = commands.map((entry) => {
    const { meta } = entry;
    const aliases = meta.aliases?.length ? ` /${meta.aliases.join(' /')}` : '';
    return `/${meta.name}${aliases} - ${meta.description}`;
  });

  return lines.join('\n');
}

```

### src/bot/commands/handlers/pipeline.js (493 lines)

```js
/**
 * Pipeline Command Handler
 * Handles /pipeline command with run/status/logs/stop subcommands.
 * F-006: Integrated with security guard
 */

import {
  startPipeline,
  stopPipeline,
  getStatus,
  getLogs,
  forceUnlock
} from '../../../services/pipeline-controller.js';
import { formatValidationErrors as _formatValidationErrors, formatError as _formatError, ErrorCodes as _ErrorCodes } from '../formatter.js';
import { logAuditEntry } from '../../../services/audit-log-service.js';
import { sanitizeParam } from '../../../security/param-sanitizer.js';
import { isAdmin } from '../../../security/permission-guard.js';
import {
  createConfirmation,
  checkConfirmation as _checkConfirmation,
  confirmAction,
  cancelConfirmation
} from '../../../security/confirmation-manager.js';

// Store pending confirmations for text-based flow
const pendingConfirmations = new Map();

/**
 * Pipeline command metadata.
 * T-102: minRole added
 */
export const pipelineMeta = {
  name: 'pipeline',
  aliases: ['p'],
  description: '管理管道任务',
  usage: '/pipeline <action> [target] [--type=<type>]',
  examples: [
    '/pipeline run my-feature',
    '/pipeline run my-feature --type=bugfix',
    '/pipeline status',
    '/pipeline logs my-feature',
    '/pipeline stop my-feature',
    '/pipeline force-unlock'
  ],
  subcommands: [
    { name: 'run', description: '启动管道' },
    { name: 'status', description: '查询状态' },
    { name: 'logs', description: '查看日志' },
    { name: 'stop', description: '停止管道' },
    { name: 'force-unlock', description: '强制释放锁' }
  ],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    },
    {
      name: 'type',
      type: 'enum',
      enum: ['feature', 'bugfix', 'planner'],
      required: false,
      default: 'feature',
      description: '管道类型'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/pipeline <action> [target] [--type=<type>] - 管理管道任务'
};

/**
 * Handle pipeline command.
 * @param {Object} handlerCtx - Handler context
 * @param {Object} handlerCtx.ctx - Telegraf context
 * @param {Object} handlerCtx.parsed - Parsed command
 * @param {Object} handlerCtx.params - Normalized parameters
 * @param {Function} handlerCtx.reply - Reply function
 */
export async function handlePipeline(handlerCtx) {
  const { ctx: _ctx, parsed, params: _params, reply } = handlerCtx;

  // Determine action from subcommand or default to status
  const action = parsed.subcommand || 'status';

  switch (action) {
    case 'run':
      // @ts-ignore — handlerCtx shape is validated at runtime
      return handleRun(handlerCtx);
    case 'status':
      // @ts-ignore — handlerCtx shape is validated at runtime
      return handleStatus(handlerCtx);
    case 'logs':
      // @ts-ignore — handlerCtx shape is validated at runtime
      return handleLogs(handlerCtx);
    case 'stop':
      return handlePipelineStop(handlerCtx);
    case 'force-unlock':
      return handleForceUnlock(handlerCtx);
    default:
      await reply(`未知操作 '${action}'。可用: run, status, logs, stop, force-unlock`);
  }
}

/**
 * Handle run subcommand.
 * T-103: Added parameter sanitization and audit logging
 */
async function handleRun({ params, reply, parsed: _parsed, userId, userRole }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  // T-103: Sanitize target parameter
  if (target) {
    const targetResult = sanitizeParam(target, { maxLength: 100 });
    if (!targetResult.ok) {
      await reply(`❌ 目标参数无效: ${targetResult.error}`);
      return;
    }
  }

  // T-103: Sanitize type parameter
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  try {
    const result = await startPipeline({
      type: typeResult.value,
      targetId: target,
      daemon: true
    });

    if (result.ok) {
      // T-107: Audit logging
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_run',
        params: { type: typeResult.value, target },
        result: 'success'
      });

      const pidInfo = result.pid ? ` (PID: ${result.pid})` : '';
      await reply(`✅ 已启动 ${typeResult.value} 管道${target ? `: ${target}` : ''}${pidInfo}`);
    } else {
      const errorMsg = result.message || result.stderr || '未知错误';
      const hint = result.hint ? `\n💡 提示: ${result.hint}` : '';

      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_run',
        params: { type: typeResult.value, target },
        result: 'failed',
        reason: errorMsg
      });

      await reply(`❌ 启动失败: ${errorMsg}${hint}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'pipeline_run',
      params: { type: pipelineType, target },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 启动失败: ${error.message}`);
  }
}

/**
 * Handle status subcommand.
 */
async function handleStatus({ params, reply }) {
  const pipelineType = params.type || 'feature';

  try {
    const result = await getStatus({ type: pipelineType });

    if (result.ok) {
      const status = formatStatusOutput(result);
      await reply(status);
    } else {
      const errorMsg = result.message || result.stderr || '未知错误';
      await reply(`❌ 查询失败: ${errorMsg}`);
    }
  } catch (error) {
    await reply(`❌ 查询失败: ${error.message}`);
  }
}

/**
 * Handle logs subcommand.
 */
async function handleLogs({ params, reply, replyFile, parsed: _parsed }) {
  const target = params._args?.[0] || params.target;
  const pipelineType = params.type || 'feature';

  try {
    const result = await getLogs({ type: pipelineType, lines: 100 });

    if (result.ok) {
      const logs = result.logs || '';

      if (logs.length >= 4000) {
        await replyFile(logs, `pipeline-logs-${target || 'latest'}.txt`);
      } else {
        await reply(logs || '暂无日志');
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await reply(`❌ 获取日志失败: ${errorMsg}`);
    }
  } catch (error) {
    await reply(`❌ 获取日志失败: ${error.message}`);
  }
}

/**
 * Handle stop subcommand (pipeline stop).
 * T-104, T-106: Added confirmation flow
 * T-107: Added audit logging
 */
async function handlePipelineStop(handlerCtx) {
  const { params, reply, parsed, userId, userRole, requiresConfirmation } = handlerCtx;

  // Sanitize type parameter (T-103)
  const pipelineType = params.type || 'feature';
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  // Check if force flag is set
  const forceFlag = params.force === true || parsed?.flags?.force === true;
  const canSkipConfirmation = isAdmin(userId) && forceFlag;

  // Handle confirmation flow
  if (requiresConfirmation && !canSkipConfirmation) {
    const rawTarget = params._args?.[0] || params.target;

    // Check if this is a CONFIRM response
    if (rawTarget === 'CONFIRM') {
      const pendingKey = `pipeline-stop:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);

      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(pendingKey);
          await executePipelineStop(handlerCtx, result.params.type, userId, userRole, reply);
        } else {
          await reply(`❌ 确认失败: ${result.error}`);
        }
        return;
      } else {
        await reply('❌ 没有待确认的 stop 操作，或操作已过期。');
        return;
      }
    }

    // Check if this is a CANCEL response
    if (rawTarget === 'CANCEL') {
      const pendingKey = `pipeline-stop:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);
      if (confirmId) {
        cancelConfirmation(confirmId, userId);
        pendingConfirmations.delete(pendingKey);
        await reply('✅ 已取消 stop 操作。');
      } else {
        await reply('没有待确认的 stop 操作。');
      }
      return;
    }

    // Create new confirmation
    const { confirmId, message } = createConfirmation(userId, 'pipeline-stop', { type: typeResult.value });
    pendingConfirmations.set(`pipeline-stop:${userId}`, confirmId);

    await reply(`⚠️ 高风险操作确认\n\n${message}\n\n请回复 /pipeline stop CONFIRM 确认，或 /pipeline stop CANCEL 取消。`);
    return;
  }

  // Execute directly
  await executePipelineStop(handlerCtx, typeResult.value, userId, userRole, reply);
}

/**
 * Execute pipeline stop operation
 */
async function executePipelineStop(handlerCtx, pipelineType, userId, userRole, reply) {
  try {
    const result = await stopPipeline({ type: pipelineType });

    if (result.ok) {
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_stop',
        params: { type: pipelineType },
        result: 'success'
      });

      if (result.errorCode === 'ALREADY_STOPPED') {
        await reply(`⚠️ ${pipelineType} 管道未在运行。`);
      } else {
        const pidInfo = result.previousPid ? ` (原 PID: ${result.previousPid})` : '';
        await reply(`✅ 已停止 ${pipelineType} 管道${pidInfo}`);
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'pipeline_stop',
        params: { type: pipelineType },
        result: 'failed',
        reason: errorMsg
      });
      await reply(`❌ 停止失败: ${errorMsg}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'pipeline_stop',
      params: { type: pipelineType },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 停止失败: ${error.message}`);
  }
}

/**
 * Handle force-unlock subcommand.
 * T-105: Force-unlock command handler
 * T-104: Confirmation flow
 * T-107: Audit logging
 */
async function handleForceUnlock(handlerCtx) {
  const { params, reply, parsed, userId, userRole, requiresConfirmation } = handlerCtx;

  // Sanitize type parameter (T-103)
  const pipelineType = params.type || 'feature';
  const typeResult = sanitizeParam(pipelineType, { maxLength: 50 });
  if (!typeResult.ok) {
    await reply(`❌ 类型参数无效: ${typeResult.error}`);
    return;
  }

  // Check if force flag is set
  const forceFlag = params.force === true || parsed?.flags?.force === true;
  const canSkipConfirmation = isAdmin(userId) && forceFlag;

  // Handle confirmation flow
  if (requiresConfirmation && !canSkipConfirmation) {
    const rawTarget = params._args?.[0] || params.target;

    // Check if this is a CONFIRM response
    if (rawTarget === 'CONFIRM') {
      const pendingKey = `force-unlock:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);

      if (confirmId) {
        const result = confirmAction(confirmId, userId);
        if (result.ok) {
          pendingConfirmations.delete(pendingKey);
          await executeForceUnlock(handlerCtx, result.params.type, userId, userRole, reply);
        } else {
          await reply(`❌ 确认失败: ${result.error}`);
        }
        return;
      } else {
        await reply('❌ 没有待确认的 force-unlock 操作，或操作已过期。');
        return;
      }
    }

    // Check if this is a CANCEL response
    if (rawTarget === 'CANCEL') {
      const pendingKey = `force-unlock:${userId}`;
      const confirmId = pendingConfirmations.get(pendingKey);
      if (confirmId) {
        cancelConfirmation(confirmId, userId);
        pendingConfirmations.delete(pendingKey);
        await reply('✅ 已取消 force-unlock 操作。');
      } else {
        await reply('没有待确认的 force-unlock 操作。');
      }
      return;
    }

    // Create new confirmation
    const { confirmId, message } = createConfirmation(userId, 'force-unlock', { type: typeResult.value });
    pendingConfirmations.set(`force-unlock:${userId}`, confirmId);

    await reply(`⚠️ 高风险操作确认\n\n${message}\n\n请回复 /pipeline force-unlock CONFIRM 确认，或 /pipeline force-unlock CANCEL 取消。`);
    return;
  }

  // Execute directly
  await executeForceUnlock(handlerCtx, typeResult.value, userId, userRole, reply);
}

/**
 * Execute force-unlock operation
 */
async function executeForceUnlock(handlerCtx, pipelineType, userId, userRole, reply) {
  try {
    const result = await forceUnlock({ type: pipelineType });

    if (result.ok) {
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'force-unlock',
        params: { type: pipelineType },
        result: 'success'
      });

      if (result.wasLocked) {
        await reply(`✅ 已强制释放 ${pipelineType} 管道的锁 (原 PID: ${result.previousPid || '未知'})`);
      } else {
        await reply(`⚠️ ${pipelineType} 管道未被锁定。`);
      }
    } else {
      const errorMsg = result.message || '未知错误';
      await logAuditEntry({
        userId,
        role: userRole,
        action: 'force-unlock',
        params: { type: pipelineType },
        result: 'failed',
        reason: errorMsg
      });
      await reply(`❌ 释放锁失败: ${errorMsg}`);
    }
  } catch (error) {
    await logAuditEntry({
      userId,
      role: userRole,
      action: 'force-unlock',
      params: { type: pipelineType },
      result: 'failed',
      reason: error.message
    });
    await reply(`❌ 释放锁失败: ${error.message}`);
  }
}

/**
 * Format status output.
 * @param {Object} result - Status result
 * @returns {string} Formatted status
 */
function formatStatusOutput(result) {
  if (!result.isRunning) {
    const lastResultInfo = result.lastResult
      ? `\n最后一次运行: ${result.lastResult.status} (${result.lastResult.featuresCompleted}/${result.lastResult.featuresTotal})`
      : '';
    return `✅ ${result.message}${lastResultInfo}`;
  }

  const lines = [`🔄 ${result.message}`, ''];

  if (result.pid) {
    lines.push(`• PID: ${result.pid}`);
  }

  if (result.currentFeature) {
    lines.push(`• 当前目标: ${result.currentFeature}`);
  }

  if (result.startedAt) {
    lines.push(`• 开始时间: ${result.startedAt}`);
  }

  if (result.lockInfo) {
    lines.push(`• 锁持有者 PID: ${result.lockInfo.pid}`);
  }

  return lines.join('\n');
}

export default handlePipeline;

```

### src/bot/commands/handlers/planner.js (66 lines)

```js
/**
 * Planner Command Handler
 * Handles /planner command for planner-type pipelines.
 */

import { handlePipeline } from './pipeline.js';

/**
 * Planner command metadata.
 */
export const plannerMeta = {
  name: 'planner',
  aliases: [],
  description: '管理 planner 管道',
  usage: '/planner <action> [target]',
  examples: ['/planner run my-feature', '/planner status', '/planner logs'],
  subcommands: [
    { name: 'run', description: '启动 planner 管道' },
    { name: 'status', description: '查询状态' },
    { name: 'logs', description: '查看日志' }
  ],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/planner <action> [target] - 管理 planner 管道'
};

/**
 * Handle planner command.
 * Delegates to pipeline handler with type=planner.
 * @param {Object} handlerCtx - Handler context
 */
export async function handlePlanner(handlerCtx) {
  const { parsed, params } = handlerCtx;

  // Determine action
  const _action = parsed.subcommand || 'status';

  // For non-run actions, just use pipeline handler with planner type
  const modifiedCtx = {
    ...handlerCtx,
    params: {
      ...params,
      type: 'planner'
    }
  };

  // If no subcommand and no target, default to status
  if (!parsed.subcommand) {
    modifiedCtx.parsed = {
      ...parsed,
      subcommand: 'status'
    };
  }

  return handlePipeline(modifiedCtx);
}

export default handlePlanner;

```

### src/bot/commands/handlers/bugfix.js (63 lines)

```js
/**
 * Bugfix Command Handler
 * Handles /bugfix shortcut command.
 */

import { handlePipeline } from './pipeline.js';

/**
 * Bugfix command metadata.
 */
export const bugfixMeta = {
  name: 'bugfix',
  aliases: ['b'],
  description: '启动 bugfix 管道',
  usage: '/bugfix <target>',
  examples: ['/bugfix session-123', '/bugfix F-001-login-bug'],
  params: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/bugfix <target> - 快捷启动 bugfix 管道'
};

/**
 * Handle bugfix command.
 * Delegates to pipeline handler with type=bugfix.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleBugfix(handlerCtx) {
  const { parsed, params } = handlerCtx;

  // Get target from positional args or params
  const target = params._args?.[0] || params.target;

  if (!target) {
    await handlerCtx.reply('❌ 缺少参数 \'target\'。\n用法: /bugfix <target>');
    return;
  }

  // Delegate to pipeline handler with type=bugfix
  const modifiedCtx = {
    ...handlerCtx,
    parsed: {
      ...parsed,
      subcommand: 'run'
    },
    params: {
      ...params,
      type: 'bugfix',
      target
    }
  };

  return handlePipeline(modifiedCtx);
}

export default handleBugfix;

```

### src/bot/commands/handlers/ls.js (72 lines)

```js
/**
 * LS Command Handler
 * F-010: File Manager
 *
 * Handles the /ls command for listing directory contents.
 */

import { listDirectory, formatFileInfo } from '../../../services/file-service.js';
import { paginateOutput, storeOutputPages, hasMorePages } from '../../../services/output-pager-service.js';
import { sessionStore } from '../../../services/session-store.js';

/**
 * LS command metadata.
 */
export const lsMeta = {
  name: 'ls',
  aliases: ['dir'],
  description: '列出目录内容',
  usage: '/ls [路径]',
  examples: ['/ls', '/ls /tmp', '/dir'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/ls [路径] - 列出目录内容（默认当前目录）'
};

/**
 * Handle /ls command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleLs(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;

  // Get the path argument (optional)
  const dirPath = args[0];

  // List directory
  const result = await listDirectory(dirPath, sessionId);

  if (result.error) {
    await reply(`❌ ${result.error}`);
    return;
  }

  // Format output
  const lines = [
    `📂 目录: ${result.path}`,
    `共 ${result.totalCount} 项`,
    ''
  ];

  // Add each item
  for (const item of result.items) {
    lines.push(formatFileInfo(item));
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
  lsMeta,
  handleLs
};

```

### src/bot/commands/handlers/find.js (115 lines)

```js
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

```

### src/bot/commands/handlers/ps.js (108 lines)

```js
/**
 * /ps Command Handler
 * F-012: System Monitor
 *
 * Returns process list with sorting and filtering options.
 */

import { systemMonitorService } from '../../../services/system-monitor-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const psMeta = {
  name: 'ps',
  aliases: [],
  description: '查看进程列表（支持排序和过滤）',
  usage: '/ps [--sort=cpu|memory] [--limit=N] [filter]',
  examples: ['/ps', '/ps --sort=memory', '/ps node', '/ps --sort=cpu --limit=10'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/ps [选项] [关键词] - 查看进程列表\n选项:\n  --sort=cpu|memory  按CPU或内存排序\n  --limit=N          限制显示数量'
};

const DEFAULT_LIMIT = 20;

/**
 * Parse command arguments into options
 * @param {string[]} args
 * @returns {{sortBy: string, limit: number, filter: string}}
 */
export function parseOptions(args) {
  let sortBy = 'cpu';
  let limit = DEFAULT_LIMIT;
  const filterParts = [];

  for (const arg of args) {
    if (arg.startsWith('--sort=')) {
      const value = arg.slice(7).toLowerCase();
      if (['cpu', 'memory'].includes(value)) {
        sortBy = value;
      }
    } else if (arg.startsWith('--limit=')) {
      const value = parseInt(arg.slice(8), 10);
      if (!isNaN(value) && value > 0 && value <= 100) {
        limit = value;
      }
    } else {
      filterParts.push(arg);
    }
  }

  return {
    sortBy,
    limit,
    filter: filterParts.join(' ')
  };
}

/**
 * Handle /ps command
 * @param {Object} handlerCtx - Handler context
 */
export async function handlePs(handlerCtx) {
  const { reply, args = [] } = handlerCtx;

  try {
    const options = parseOptions(args);
    const processes = await systemMonitorService.getProcessList(options);

    if (processes.length === 0) {
      if (options.filter) {
        await reply(`🔍 未找到匹配 "${escapeMarkdownV2(options.filter)}" 的进程。`);
      } else {
        await reply('📋 未找到任何进程。');
      }
      return;
    }

    // Format as table
    const lines = [
      `📋 *进程列表* ${options.filter ? `\(过滤: "${escapeMarkdownV2(options.filter)}")` : ''}`,
      `排序: ${options.sortBy === 'cpu' ? 'CPU' : '内存'} | 显示: ${processes.length}`,
      '',
      '```\nPID      CPU%   MEM%   NAME',
      '-'.repeat(40)
    ];

    for (const proc of processes) {
      const pid = String(proc.pid).padEnd(8);
      const cpu = `${proc.cpu.toFixed(1)}%`.padEnd(6);
      const mem = `${proc.memory.toFixed(1)}%`.padEnd(6);
      const name = proc.name.substring(0, 20);
      lines.push(`${pid}${cpu}${mem}${name}`);
    }

    lines.push('```');

    await reply(lines.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 获取进程列表失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  psMeta,
  handlePs,
  parseOptions
};

```

### src/bot/commands/handlers/sysinfo.js (72 lines)

```js
/**
 * /sysinfo Command Handler
 * F-012: System Monitor
 *
 * Returns system overview including CPU, memory, disk, and network status.
 */

import { systemMonitorService } from '../../../services/system-monitor-service.js';
import { escapeMarkdownV2 } from '../../../utils/markdown-v2-formatter.js';

export const sysinfoMeta = {
  name: 'sysinfo',
  aliases: ['si'],
  description: '查看系统状态概览（CPU、内存、磁盘、网络）',
  usage: '/sysinfo',
  examples: ['/sysinfo'],
  params: [],
  requiresAuth: true,
  minRole: 'viewer',
  helpText: '/sysinfo - 查看系统状态概览（CPU、内存、磁盘、网络）'
};

/**
 * Handle /sysinfo command
 * @param {Object} handlerCtx - Handler context
 */
export async function handleSysinfo(handlerCtx) {
  const { reply } = handlerCtx;

  try {
    const info = await systemMonitorService.getSystemInfo();

    // Format as table
    const lines = [
      '📊 *系统状态概览*',
      '',
      `🖥️ *主机*: ${escapeMarkdownV2(info.hostname)}`,
      `⏱️ *运行时间*: ${systemMonitorService.formatUptime(info.uptime)}`,
      `💻 *平台*: ${escapeMarkdownV2(info.platform)}`,
      '',
      '*CPU*',
      `├ 型号: ${escapeMarkdownV2(info.cpu.model)}`,
      `├ 核心数: ${info.cpu.cores}`,
      `└ 使用率: ${info.cpu.usage.toFixed(1)}%`,
      '',
      '*内存*',
      `├ 总量: ${systemMonitorService.formatBytes(info.memory.total)}`,
      `├ 已用: ${systemMonitorService.formatBytes(info.memory.used)}`,
      `├ 空闲: ${systemMonitorService.formatBytes(info.memory.free)}`,
      `└ 使用率: ${info.memory.usagePercent.toFixed(1)}%`,
      '',
      '*磁盘*',
      `├ 总量: ${systemMonitorService.formatBytes(info.disk.total)}`,
      `├ 已用: ${systemMonitorService.formatBytes(info.disk.used)}`,
      `├ 空闲: ${systemMonitorService.formatBytes(info.disk.free)}`,
      `└ 使用率: ${info.disk.usagePercent.toFixed(1)}%`,
      '',
      '*网络*',
      `└ 接口: ${info.network.interfaces.join(', ') || 'N/A'}`
    ];

    await reply(lines.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reply(`❌ 获取系统信息失败: ${escapeMarkdownV2(message)}`);
  }
}

export default {
  sysinfoMeta,
  handleSysinfo
};

```

## Section 5 — Existing Tests

### tests/bot/commands/parser.test.js (121 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../../../src/bot/commands/parser.js';

test('parseCommand returns null for non-command text', () => {
  assert.equal(parseCommand('hello world'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(null), null);
  assert.equal(parseCommand(undefined), null);
});

test('parseCommand parses basic command', () => {
  const result = parseCommand('/start');
  assert.deepEqual(result, {
    command: 'start',
    subcommand: undefined,
    args: [],
    options: {},
    raw: '/start'
  });
});

test('parseCommand parses command with subcommand', () => {
  const result = parseCommand('/pipeline run');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand parses command with positional args', () => {
  const result = parseCommand('/bugfix session-123');
  assert.equal(result.command, 'bugfix');
  assert.deepEqual(result.args, []);
  // First token after command is treated as subcommand if it doesn't start with --
  assert.equal(result.subcommand, 'session-123');
});

test('parseCommand parses --key=value options', () => {
  const result = parseCommand('/pipeline run --type=bugfix');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix' });
});

test('parseCommand parses multiple options', () => {
  const result = parseCommand('/pipeline run --type=feature --verbose');
  assert.deepEqual(result.options, { type: 'feature', verbose: 'true' });
});

test('parseCommand parses key=value without --', () => {
  const result = parseCommand('/pipeline run type=bugfix');
  assert.deepEqual(result.options, { type: 'bugfix' });
});

test('parseCommand applies alias mapping', () => {
  const aliasMap = { p: 'pipeline', b: 'bugfix' };
  const result = parseCommand('/p run', aliasMap);
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand handles @bot suffix', () => {
  const result = parseCommand('/start@mybot');
  assert.equal(result.command, 'start');
});

test('parseCommand normalizes command to lowercase', () => {
  const result = parseCommand('/PIPELINE RUN');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand collects positional args after options', () => {
  const result = parseCommand('/pipeline run my-feature --type=bugfix');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix' });
  // Args should be empty since first token after subcommand is captured
});

test('parseCommand handles complex command', () => {
  const aliasMap = { p: 'pipeline' };
  const result = parseCommand('/p run my-feature --type=bugfix --verbose', aliasMap);
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix', verbose: 'true' });
});

test('parseCommand preserves raw text', () => {
  const text = '/pipeline run --type=bugfix';
  const result = parseCommand(text);
  assert.equal(result.raw, text);
});

test('parseCommand handles empty options gracefully', () => {
  const result = parseCommand('/status');
  assert.deepEqual(result.options, {});
  assert.deepEqual(result.args, []);
});

test('parseCommand parses /logs with target', () => {
  const result = parseCommand('/logs session-123');
  assert.equal(result.command, 'logs');
  assert.equal(result.subcommand, 'session-123');
});

test('parseCommand parses /stop with target', () => {
  const result = parseCommand('/stop my-feature');
  assert.equal(result.command, 'stop');
  assert.equal(result.subcommand, 'my-feature');
});

test('parseCommand handles alias /s for status', () => {
  const aliasMap = { s: 'status' };
  const result = parseCommand('/s', aliasMap);
  assert.equal(result.command, 'status');
});

test('parseCommand handles alias /l for logs', () => {
  const aliasMap = { l: 'logs' };
  const result = parseCommand('/l session-123', aliasMap);
  assert.equal(result.command, 'logs');
});

```

### tests/bot/commands/registry.test.js (153 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCommand,
  getCommand,
  getAllCommands,
  isAlias,
  getHelpText,
  clearRegistry,
  getAliasMap
} from '../../../src/bot/commands/registry.js';

test.beforeEach(() => {
  clearRegistry();
});

test('registerCommand stores command with metadata', () => {
  const meta = {
    name: 'test',
    description: 'Test command',
    requiresAuth: true,
    helpText: 'Test help'
  };
  const handler = async () => {};

  registerCommand(meta, handler);

  const entry = getCommand('test');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'test');
  assert.equal(entry.handler, handler);
});

test('registerCommand throws on duplicate command', () => {
  const meta = { name: 'test', description: 'Test', requiresAuth: true, helpText: 'Test' };
  registerCommand(meta, async () => {});

  assert.throws(() => {
    registerCommand(meta, async () => {});
  }, /already registered/);
});

test('registerCommand stores aliases', () => {
  const meta = {
    name: 'pipeline',
    aliases: ['p'],
    description: 'Pipeline command',
    requiresAuth: true,
    helpText: 'Pipeline help'
  };

  registerCommand(meta, async () => {});

  const entry = getCommand('p');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'pipeline');
});

test('registerCommand throws on duplicate alias', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});

  assert.throws(() => {
    registerCommand({ name: 'planner', aliases: ['p'], description: 'Planner', requiresAuth: true, helpText: '' }, async () => {});
  }, /already registered/);
});

test('getCommand returns null for unknown command', () => {
  const entry = getCommand('unknown');
  assert.equal(entry, null);
});

test('getCommand is case-insensitive', () => {
  registerCommand({ name: 'Test', description: 'Test', requiresAuth: true, helpText: '' }, async () => {});

  const entry = getCommand('TEST');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'test');
});

test('isAlias returns true for registered alias', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});

  assert.equal(isAlias('p'), true);
  assert.equal(isAlias('P'), true);
  assert.equal(isAlias('pipeline'), false);
});

test('getAllCommands returns all registered commands', () => {
  registerCommand({ name: 'pipeline', description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', description: 'Status', requiresAuth: true, helpText: '' }, async () => {});

  const commands = getAllCommands();
  assert.equal(commands.length, 2);
});

test('getHelpText generates general help', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: '管理管道', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', aliases: ['s'], description: '查看状态', requiresAuth: true, helpText: '' }, async () => {});

  const help = getHelpText();
  assert.ok(help.includes('可用命令'));
  assert.ok(help.includes('/pipeline'));
  assert.ok(help.includes('/status'));
});

test('getHelpText generates specific command help', () => {
  registerCommand({
    name: 'pipeline',
    aliases: ['p'],
    description: '管理管道',
    usage: '/pipeline <action>',
    subcommands: [
      { name: 'run', description: '启动' },
      { name: 'status', description: '状态' }
    ],
    requiresAuth: true,
    helpText: ''
  }, async () => {});

  const help = getHelpText('pipeline');
  assert.ok(help.includes('/pipeline'));
  assert.ok(help.includes('管理管道'));
  assert.ok(help.includes('run'));
  assert.ok(help.includes('status'));
});

test('getHelpText returns error for unknown command', () => {
  const help = getHelpText('unknown');
  assert.ok(help.includes('未知命令'));
});

test('getAliasMap returns correct mapping', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', aliases: ['s'], description: 'Status', requiresAuth: true, helpText: '' }, async () => {});

  const aliasMap = getAliasMap();
  assert.equal(aliasMap.p, 'pipeline');
  assert.equal(aliasMap.s, 'status');
});

test('clearRegistry removes all commands', () => {
  registerCommand({ name: 'test', description: 'Test', requiresAuth: true, helpText: '' }, async () => {});
  clearRegistry();

  const entry = getCommand('test');
  assert.equal(entry, null);
});

test('registerCommand with no name throws', () => {
  assert.throws(() => {
    registerCommand({ description: 'Test' }, async () => {});
  }, /must have a name/);
});

```

### tests/bot/commands/validator.test.js (252 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand, validateSubcommand } from '../../../src/bot/commands/validator.js';

test('validateCommand returns valid for simple command', () => {
  const parsed = { command: 'status', subcommand: undefined, args: [], options: {} };
  const meta = { name: 'status', params: [], requiresAuth: true };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateCommand returns valid when required param is provided', () => {
  const parsed = { command: 'bugfix', subcommand: undefined, args: [], options: { target: 'session-123' } };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});

test('validateCommand returns error for missing required param', () => {
  const parsed = { command: 'bugfix', subcommand: undefined, args: [], options: {} };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.equal(result.errors[0].param, 'target');
  assert.ok(result.errors[0].message.includes('缺少参数'));
});

test('validateCommand validates enum values', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'invalid' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'enum', enum: ['feature', 'bugfix', 'planner'], description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].suggestion.includes('feature'));
});

test('validateCommand accepts valid enum value', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'bugfix' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'enum', enum: ['feature', 'bugfix', 'planner'], description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});

test('validateCommand validates number type', () => {
  const parsed = { command: 'test', subcommand: undefined, args: [], options: { count: 'abc' } };
  const meta = {
    name: 'test',
    params: [{ name: 'count', type: 'number', description: 'Count' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].message.includes('数字'));
});

test('validateCommand accepts valid number', () => {
  const parsed = { command: 'test', subcommand: undefined, args: [], options: { count: '42' } };
  const meta = {
    name: 'test',
    params: [{ name: 'count', type: 'number', description: 'Count' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.count, 42);
});

test('validateCommand uses default value when param not provided', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: {} };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'string', default: 'feature', description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.type, 'feature');
});

test('validateCommand returns error for invalid subcommand', () => {
  const parsed = { command: 'pipeline', subcommand: 'invalid', args: [], options: {} };
  const meta = {
    name: 'pipeline',
    subcommands: [
      { name: 'run', description: 'Run' },
      { name: 'status', description: 'Status' }
    ],
    params: [],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].message.includes('未知子命令'));
  assert.ok(result.errors[0].suggestion.includes('run'));
});

test('validateCommand includes normalized params on success', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'bugfix' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run' }],
    params: [{ name: 'type', type: 'string', default: 'feature', description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.ok(result.normalized);
  assert.equal(result.normalized.type, 'bugfix');
});

test('validateSubcommand returns valid for no subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }];
  const result = validateSubcommand(undefined, subcommands);
  assert.equal(result.valid, true);
});

test('validateSubcommand returns valid for known subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }, { name: 'status', description: 'Status' }];
  const result = validateSubcommand('run', subcommands);
  assert.equal(result.valid, true);
});

test('validateSubcommand returns error for unknown subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }, { name: 'status', description: 'Status' }];
  const result = validateSubcommand('invalid', subcommands);
  assert.equal(result.valid, false);
  assert.ok(result.error.message.includes('未知子命令'));
});

test('validateCommand handles subcommand-specific params', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { target: 'my-feature' } };
  const meta = {
    name: 'pipeline',
    subcommands: [
      { name: 'run', description: 'Run', params: [{ name: 'target', required: false, description: 'Target' }] }
    ],
    params: [],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});

// F002-CRIT-001: Parser incorrectly treats positional arguments as subcommands
// For commands without subcommands, parsed.subcommand should be used as first positional param
test('validateCommand uses subcommand as positional param when command has no subcommands (bugfix)', () => {
  // /bugfix session-123 -> parser sets subcommand: "session-123", args: []
  const parsed = { command: 'bugfix', subcommand: 'session-123', args: [], options: {} };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
    // No subcommands defined
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.target, 'session-123');
});

test('validateCommand uses subcommand as positional param when command has no subcommands (logs)', () => {
  // /logs my-feature -> parser sets subcommand: "my-feature", args: []
  const parsed = { command: 'logs', subcommand: 'my-feature', args: [], options: {} };
  const meta = {
    name: 'logs',
    params: [{ name: 'target', required: false, description: 'Target ID' }],
    requiresAuth: true
    // No subcommands defined
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.target, 'my-feature');
});

test('validateCommand uses subcommand as positional param when command has no subcommands (stop)', () => {
  // /stop my-feature -> parser sets subcommand: "my-feature", args: []
  const parsed = { command: 'stop', subcommand: 'my-feature', args: [], options: {} };
  const meta = {
    name: 'stop',
    params: [{ name: 'target', required: false, description: 'Target ID' }],
    requiresAuth: true
    // No subcommands defined
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.target, 'my-feature');
});

test('validateCommand prioritizes explicit options over positional fallback', () => {
  // /bugfix session-123 --target=other-target
  const parsed = { command: 'bugfix', subcommand: 'session-123', args: [], options: { target: 'other-target' } };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  // Explicit option should take precedence
  assert.equal(result.normalized.target, 'other-target');
});

test('validateCommand handles second positional param from args', () => {
  // /command first second -> parser sets subcommand: "first", args: ["second"]
  const parsed = { command: 'test', subcommand: 'first', args: ['second'], options: {} };
  const meta = {
    name: 'test',
    params: [
      { name: 'param1', required: true, description: 'First param' },
      { name: 'param2', required: false, description: 'Second param' }
    ],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.param1, 'first');
  assert.equal(result.normalized.param2, 'second');
});

```

### tests/bot/commands/formatter.test.js (93 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatError, formatValidationErrors, formatErrorResponse, ErrorCodes } from '../../../src/bot/commands/formatter.js';

test('formatError UNKNOWN_COMMAND', () => {
  const error = formatError(ErrorCodes.UNKNOWN_COMMAND, { command: 'xyz' });
  assert.equal(error.code, ErrorCodes.UNKNOWN_COMMAND);
  assert.ok(error.message.includes('未知命令'));
  assert.ok(error.message.includes('xyz'));
  assert.ok(error.suggestion.includes('/help'));
});

test('formatError UNKNOWN_SUBCOMMAND', () => {
  const error = formatError(ErrorCodes.UNKNOWN_SUBCOMMAND, {
    subcommand: 'xyz',
    available: ['run', 'status']
  });
  assert.equal(error.code, ErrorCodes.UNKNOWN_SUBCOMMAND);
  assert.ok(error.message.includes('未知子命令'));
  assert.ok(error.suggestion.includes('run'));
});

test('formatError MISSING_PARAM', () => {
  const error = formatError(ErrorCodes.MISSING_PARAM, { param: 'target' });
  assert.equal(error.code, ErrorCodes.MISSING_PARAM);
  assert.ok(error.message.includes('缺少参数'));
  assert.ok(error.message.includes('target'));
});

test('formatError INVALID_PARAM', () => {
  const error = formatError(ErrorCodes.INVALID_PARAM, {
    param: 'type',
    reason: '无效值',
    suggestion: '可选: feature, bugfix'
  });
  assert.equal(error.code, ErrorCodes.INVALID_PARAM);
  assert.ok(error.message.includes('无效'));
  assert.ok(error.suggestion.includes('feature'));
});

test('formatError UNAUTHORIZED', () => {
  const error = formatError(ErrorCodes.UNAUTHORIZED, {});
  assert.equal(error.code, ErrorCodes.UNAUTHORIZED);
  assert.ok(error.message.includes('未被授权'));
});

test('formatError INTERNAL_ERROR', () => {
  const error = formatError(ErrorCodes.INTERNAL_ERROR, { reason: 'Connection failed' });
  assert.equal(error.code, ErrorCodes.INTERNAL_ERROR);
  assert.ok(error.message.includes('内部错误'));
});

test('formatValidationErrors formats multiple errors', () => {
  const errors = [
    { param: 'target', message: '缺少参数 target', suggestion: '请提供 target' },
    { param: 'type', message: '无效类型', suggestion: '可选: feature, bugfix' }
  ];

  const result = formatValidationErrors(errors, '/pipeline run <target>');
  assert.ok(result.includes('缺少参数'));
  assert.ok(result.includes('建议'));
  assert.ok(result.includes('用法'));
});

test('formatValidationErrors returns empty for no errors', () => {
  const result = formatValidationErrors([], '/usage');
  assert.equal(result, '');
});

test('formatErrorResponse formats complete error', () => {
  const error = {
    code: ErrorCodes.MISSING_PARAM,
    message: '缺少参数 target',
    suggestion: '请提供 target 参数',
    usage: '/bugfix <target>'
  };

  const result = formatErrorResponse(error);
  assert.ok(result.includes('❌'));
  assert.ok(result.includes('💡'));
  assert.ok(result.includes('用法'));
});

test('formatErrorResponse handles minimal error', () => {
  const error = {
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Unknown error'
  };

  const result = formatErrorResponse(error);
  assert.ok(result.includes('❌'));
  assert.ok(!result.includes('💡'));
});

```

### tests/integration/f002-command-router.integration.test.js (67 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommand, registerCommand } from '../../src/bot/commands/index.js';
import { clearRegistry } from '../../src/bot/commands/registry.js';
import { pipelineMeta } from '../../src/bot/commands/handlers/pipeline.js';
import { statusMeta } from '../../src/bot/commands/handlers/status.js';

test.beforeEach(() => {
  clearRegistry();
});

const createMockContext = (text) => ({
  from: { id: 12345 },
  message: { text },
  reply: async (msg) => msg,
  replyWithDocument: async () => {}
});

test('routeCommand returns false for non-command text', async () => {
  const ctx = createMockContext('hello world');
  const result = await routeCommand(ctx);
  assert.equal(result, false);
});

test('routeCommand returns true for command text', async () => {
  // Register a test command
  registerCommand(statusMeta, async () => {});

  const ctx = createMockContext('/status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand handles unknown command', async () => {
  const ctx = createMockContext('/unknown');
  const result = await routeCommand(ctx);
  assert.equal(result, true); // Command was handled (with error message)
});

test('routeCommand handles command with subcommand', async () => {
  registerCommand(pipelineMeta, async () => {});

  const ctx = createMockContext('/pipeline status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand applies alias mapping', async () => {
  registerCommand(pipelineMeta, async () => {});

  const ctx = createMockContext('/p status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand validates parameters', async () => {
  registerCommand({
    name: 'test',
    params: [{ name: 'target', required: true, description: 'Target' }],
    requiresAuth: true,
    helpText: 'Test'
  }, async () => {});

  const ctx = createMockContext('/test');
  const result = await routeCommand(ctx);
  assert.equal(result, true); // Handled with validation error
});

```

### tests/integration/f002-user-stories.integration.test.js (437 lines)

```js
/**
 * F-002 Integration Tests - User Story Acceptance Criteria
 * Comprehensive tests covering all 7 user stories from spec.md
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../../src/bot/commands/parser.js';
import { registerCommand, getCommand, clearRegistry, getAliasMap } from '../../src/bot/commands/registry.js';
import { validateCommand } from '../../src/bot/commands/validator.js';
import { formatError, ErrorCodes } from '../../src/bot/commands/formatter.js';
import { routeCommand as _routeCommand } from '../../src/bot/commands/index.js';
import { pipelineMeta, handlePipeline } from '../../src/bot/commands/handlers/pipeline.js';
import { bugfixMeta, handleBugfix } from '../../src/bot/commands/handlers/bugfix.js';
import { plannerMeta, handlePlanner } from '../../src/bot/commands/handlers/planner.js';
import { statusMeta, handleStatus } from '../../src/bot/commands/handlers/status.js';
import { logsMeta, handleLogs } from '../../src/bot/commands/handlers/logs.js';
import { stopMeta, handleStop } from '../../src/bot/commands/handlers/stop.js';

test.beforeEach(() => {
  clearRegistry();
});

// ============================================================
// US-1: Pipeline Command
// ============================================================

test('US-1.1: /pipeline run starts pipeline with target', () => {
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/pipeline run my-feature', aliasMap);
  assert.equal(parsed.command, 'pipeline');
  assert.equal(parsed.subcommand, 'run');
});

test('US-1.2: /pipeline status queries status', () => {
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/pipeline status', aliasMap);
  assert.equal(parsed.command, 'pipeline');
  assert.equal(parsed.subcommand, 'status');
});

test('US-1.3: /pipeline logs shows logs', () => {
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/pipeline logs my-feature', aliasMap);
  assert.equal(parsed.command, 'pipeline');
  assert.equal(parsed.subcommand, 'logs');
});

test('US-1.4: /pipeline stop stops pipeline', () => {
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/pipeline stop my-feature', aliasMap);
  assert.equal(parsed.command, 'pipeline');
  assert.equal(parsed.subcommand, 'stop');
});

test('US-1.5: /pipeline with --type option', () => {
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/pipeline run --type=bugfix', aliasMap);
  assert.equal(parsed.options.type, 'bugfix');
});

test('US-1.6: /planner command behaves as /pipeline --type=planner', () => {
  registerCommand(plannerMeta, handlePlanner);
  const entry = getCommand('planner');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'planner');
});

test('US-1.7: /pipeline with invalid subcommand returns help', () => {
  const parsed = parseCommand('/pipeline xyz', getAliasMap());
  const validation = validateCommand(parsed, pipelineMeta);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors[0].message.includes('未知子命令'));
});

test('US-1.8: /p alias maps to /pipeline', () => {
  registerCommand(pipelineMeta, handlePipeline);
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/p status', aliasMap);
  assert.equal(parsed.command, 'pipeline');
});

// ============================================================
// US-2: Bugfix Command
// ============================================================

test('US-2.1: /bugfix requires target parameter', () => {
  registerCommand(bugfixMeta, handleBugfix);
  const parsed = parseCommand('/bugfix', getAliasMap());
  const validation = validateCommand(parsed, bugfixMeta);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(e => e.param === 'target'));
});

test('US-2.2: /bugfix with target calls pipeline with type=bugfix', async () => {
  const replies = [];
  const mockCtx = {
    ctx: { from: { id: 12345 }, message: { text: '/bugfix session-123' } },
    reply: async (text) => { replies.push(text); },
    replyFile: async () => {}
  };

  await handleBugfix({
    ctx: mockCtx.ctx,
    parsed: { command: 'bugfix', subcommand: 'session-123', args: [], options: {} },
    params: { _args: ['session-123'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(replies.length > 0);
});

test('US-2.3: /b alias maps to /bugfix', () => {
  registerCommand(bugfixMeta, handleBugfix);
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/b session-123', aliasMap);
  assert.equal(parsed.command, 'bugfix');
});

// ============================================================
// US-3: Status Query
// ============================================================

test('US-3.1: /status returns pipeline list', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); }
  };

  await handleStatus({
    ctx: {},
    parsed: { command: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('管道'));
});

test('US-3.2: /status with no pipelines shows helpful message', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); }
  };

  await handleStatus({
    ctx: {},
    parsed: { command: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  // Service returns empty pipelines by default
  assert.ok(replies[0].includes('没有') || replies[0].includes('管道'));
});

test('US-3.3: /s alias maps to /status', () => {
  registerCommand(statusMeta, handleStatus);
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/s', aliasMap);
  assert.equal(parsed.command, 'status');
});

// ============================================================
// US-4: Logs Query
// ============================================================

test('US-4.1: /logs returns logs', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); },
    replyFile: async () => {}
  };

  await handleLogs({
    ctx: {},
    parsed: { command: 'logs', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(replies.length > 0);
});

test('US-4.2: /logs with target specifies target', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); },
    replyFile: async () => {}
  };

  await handleLogs({
    ctx: {},
    parsed: { command: 'logs', subcommand: 'session-123', args: [], options: {} },
    params: { _args: ['session-123'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(replies.length > 0);
});

test('US-4.3: /l alias maps to /logs', () => {
  registerCommand(logsMeta, handleLogs);
  const aliasMap = getAliasMap();
  const parsed = parseCommand('/l session-123', aliasMap);
  assert.equal(parsed.command, 'logs');
});

// ============================================================
// US-5: Stop Pipeline
// ============================================================

test('US-5.1: /stop returns confirmation', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); }
  };

  await handleStop({
    ctx: {},
    parsed: { command: 'stop', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(replies.length > 0);
});

test('US-5.2: /stop with target stops specific pipeline', async () => {
  const replies = [];
  const mockCtx = {
    reply: async (text) => { replies.push(text); }
  };

  await handleStop({
    ctx: {},
    parsed: { command: 'stop', subcommand: 'my-feature', args: [], options: {} },
    params: { _args: ['my-feature'] },
    reply: mockCtx.reply
  });

  assert.ok(replies.length > 0);
});

// ============================================================
// US-6: Error Guidance
// ============================================================

test('US-6.1: Unknown subcommand shows available options', () => {
  const error = formatError(ErrorCodes.UNKNOWN_SUBCOMMAND, {
    subcommand: 'xyz',
    available: ['run', 'status', 'logs', 'stop'],
    usage: '/pipeline <action> [target]'
  });

  assert.ok(error.message.includes('未知子命令'));
  assert.ok(error.suggestion.includes('run'));
  assert.ok(error.suggestion.includes('status'));
  assert.ok(error.suggestion.includes('logs'));
  assert.ok(error.suggestion.includes('stop'));
});

test('US-6.2: Missing parameter shows usage', () => {
  const error = formatError(ErrorCodes.MISSING_PARAM, {
    param: 'target',
    usage: '/bugfix <target>'
  });

  assert.ok(error.message.includes('缺少参数'));
  assert.ok(error.message.includes('target'));
});

test('US-6.3: Invalid parameter shows suggestion', () => {
  const error = formatError(ErrorCodes.INVALID_PARAM, {
    param: 'type',
    reason: '无效值',
    suggestion: '可选: feature, bugfix, planner'
  });

  assert.ok(error.message.includes('无效'));
  assert.ok(error.suggestion.includes('feature'));
});

test('US-6.4: Unknown command shows help suggestion', () => {
  const error = formatError(ErrorCodes.UNKNOWN_COMMAND, {
    command: 'xyz'
  });

  assert.ok(error.message.includes('未知命令'));
  assert.ok(error.suggestion.includes('/help'));
});

// ============================================================
// US-7: Authorization Guard
// ============================================================

test('US-7.1: Command metadata has requiresAuth flag', () => {
  assert.equal(pipelineMeta.requiresAuth, true);
  assert.equal(bugfixMeta.requiresAuth, true);
  assert.equal(statusMeta.requiresAuth, true);
  assert.equal(logsMeta.requiresAuth, true);
  assert.equal(stopMeta.requiresAuth, true);
  assert.equal(plannerMeta.requiresAuth, true);
});

test('US-7.2: Unauthorized user gets consistent message', () => {
  const error = formatError(ErrorCodes.UNAUTHORIZED, {});
  assert.ok(error.message.includes('未被授权'));
  // Message should not expose sensitive info
  assert.ok(!error.message.includes('ID'));
  assert.ok(!error.message.includes('whitelist'));
});

// ============================================================
// NFR Tests: Extensibility & Testability
// ============================================================

test('NFR-1.1: Registry supports dynamic command registration', () => {
  const customMeta = {
    name: 'custom',
    description: 'Custom command',
    requiresAuth: true,
    helpText: 'Custom help'
  };

  registerCommand(customMeta, async () => {});
  const entry = getCommand('custom');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'custom');
});

test('NFR-1.2: Registry supports alias registration', () => {
  const meta = {
    name: 'testcmd',
    aliases: ['tc', 't'],
    description: 'Test',
    requiresAuth: true,
    helpText: ''
  };

  registerCommand(meta, async () => {});
  assert.ok(getCommand('tc'));
  assert.ok(getCommand('t'));
});

test('NFR-2.1: Handler interface is mockable', async () => {
  // This test demonstrates that handlers accept injected dependencies
  const _mockService = {
    startPipeline: async () => ({ ok: true }),
    getPipelineStatus: async () => ({ ok: true, pipelines: [] }),
    stopPipeline: async () => ({ ok: true }),
    getPipelineLogs: async () => ({ ok: true, stdout: '' })
  };

  const replies = [];
  const mockReply = async (text) => { replies.push(text); };

  // Handlers work with mock context
  await handleStatus({
    ctx: {},
    parsed: { command: 'status', args: [], options: {} },
    params: {},
    reply: mockReply
  });

  assert.ok(replies.length > 0);
});

test('NFR-3.1: Command parsing is fast', () => {
  const aliasMap = { p: 'pipeline', b: 'bugfix', s: 'status', l: 'logs' };
  const start = Date.now();

  for (let i = 0; i < 1000; i++) {
    parseCommand('/pipeline run my-feature --type=bugfix --verbose', aliasMap);
  }

  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, `Parsing 1000 commands took ${elapsed}ms, should be < 100ms`);
});

// ============================================================
// Alias Mapping Tests (from spec.md)
// ============================================================

test('Alias mapping: /p -> /pipeline', () => {
  registerCommand(pipelineMeta, handlePipeline);
  const aliasMap = getAliasMap();
  assert.equal(aliasMap.p, 'pipeline');
});

test('Alias mapping: /b -> /bugfix', () => {
  registerCommand(bugfixMeta, handleBugfix);
  const aliasMap = getAliasMap();
  assert.equal(aliasMap.b, 'bugfix');
});

test('Alias mapping: /s -> /status', () => {
  registerCommand(statusMeta, handleStatus);
  const aliasMap = getAliasMap();
  assert.equal(aliasMap.s, 'status');
});

test('Alias mapping: /l -> /logs', () => {
  registerCommand(logsMeta, handleLogs);
  const aliasMap = getAliasMap();
  assert.equal(aliasMap.l, 'logs');
});

// ============================================================
// Decision Verification Tests (from spec.md D1-D3)
// ============================================================

test('D1: /planner is independent pipeline type with default type=planner', () => {
  assert.equal(plannerMeta.name, 'planner');
  // planner should behave like pipeline with type=planner
  assert.ok(plannerMeta.subcommands.some(s => s.name === 'run'));
  assert.ok(plannerMeta.subcommands.some(s => s.name === 'status'));
  assert.ok(plannerMeta.subcommands.some(s => s.name === 'logs'));
});

test('D2: Authorization uses isAllowedUser()', () => {
  // All commands should have requiresAuth: true
  const commands = [pipelineMeta, bugfixMeta, plannerMeta, statusMeta, logsMeta, stopMeta];
  for (const meta of commands) {
    assert.equal(meta.requiresAuth, true, `${meta.name} should require auth`);
  }
});

test('D3: Logs >= 4000 chars sent as file', () => {
  // Verify threshold is defined in logs handler
  assert.ok(logsMeta.name === 'logs');
  // The actual threshold check is in handleLogs function
});

```

### tests/bot/commands/handlers/handlers.test.js (191 lines)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePipeline, pipelineMeta } from '../../../../src/bot/commands/handlers/pipeline.js';
import { handleBugfix, bugfixMeta } from '../../../../src/bot/commands/handlers/bugfix.js';
import { handleStatus, statusMeta } from '../../../../src/bot/commands/handlers/status.js';
import { handleLogs, logsMeta } from '../../../../src/bot/commands/handlers/logs.js';
import { handleStop, stopMeta } from '../../../../src/bot/commands/handlers/stop.js';
import { handlePlanner, plannerMeta } from '../../../../src/bot/commands/handlers/planner.js';

// Mock pipeline-control-service
const createMockService = () => {
  const calls = [];
  return {
    calls,
    startPipeline: async (params) => {
      calls.push({ method: 'startPipeline', params });
      return { ok: true, exitCode: 0 };
    },
    getPipelineStatus: async (params) => {
      calls.push({ method: 'getPipelineStatus', params });
      return { ok: true, pipelines: [] };
    },
    stopPipeline: async (params) => {
      calls.push({ method: 'stopPipeline', params });
      return { ok: true };
    },
    getPipelineLogs: async (params) => {
      calls.push({ method: 'getPipelineLogs', params });
      return { ok: true, stdout: 'log content' };
    }
  };
};

const createMockContext = () => {
  const replies = [];
  return {
    replies,
    ctx: {
      from: { id: 12345 },
      message: { text: '' },
      reply: async (text) => { replies.push(text); }
    },
    reply: async (text) => { replies.push(text); },
    replyFile: async (content, filename) => { replies.push(`[FILE: ${filename}]`); }
  };
};

test('pipelineMeta has correct metadata', () => {
  assert.equal(pipelineMeta.name, 'pipeline');
  assert.deepEqual(pipelineMeta.aliases, ['p']);
  assert.ok(pipelineMeta.subcommands.length > 0);
});

test('handlePipeline with run subcommand calls startPipeline', async () => {
  const _mock = createMockService();
  const mockCtx = createMockContext();

  await handlePipeline({
    ctx: mockCtx.ctx,
    parsed: { command: 'pipeline', subcommand: 'run', args: ['my-feature'], options: {} },
    params: { type: 'feature', _args: ['my-feature'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  // Verify behavior through replies
  assert.ok(mockCtx.replies.length > 0);
});

test('handlePipeline with status subcommand shows status', async () => {
  const _mock = createMockService();
  const mockCtx = createMockContext();

  await handlePipeline({
    ctx: mockCtx.ctx,
    parsed: { command: 'pipeline', subcommand: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('handleBugfix requires target parameter', async () => {
  const mockCtx = createMockContext();

  await handleBugfix({
    ctx: mockCtx.ctx,
    parsed: { command: 'bugfix', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies[0].includes('缺少'));
});

test('handleBugfix calls pipeline with type=bugfix', async () => {
  const mockCtx = createMockContext();

  await handleBugfix({
    ctx: mockCtx.ctx,
    parsed: { command: 'bugfix', args: ['session-123'], options: {} },
    params: { _args: ['session-123'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('bugfixMeta has correct metadata', () => {
  assert.equal(bugfixMeta.name, 'bugfix');
  assert.deepEqual(bugfixMeta.aliases, ['b']);
  assert.equal(bugfixMeta.params[0].required, true);
});

test('handleStatus returns status message', async () => {
  const mockCtx = createMockContext();

  await handleStatus({
    ctx: mockCtx.ctx,
    parsed: { command: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(mockCtx.replies.length > 0);
  assert.ok(mockCtx.replies[0].includes('管道'));
});

test('statusMeta has correct metadata', () => {
  assert.equal(statusMeta.name, 'status');
  assert.deepEqual(statusMeta.aliases, ['s']);
});

test('handleLogs returns logs', async () => {
  const mockCtx = createMockContext();

  await handleLogs({
    ctx: mockCtx.ctx,
    parsed: { command: 'logs', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('logsMeta has correct metadata', () => {
  assert.equal(logsMeta.name, 'logs');
  assert.deepEqual(logsMeta.aliases, ['l']);
});

test('handleStop returns confirmation', async () => {
  const mockCtx = createMockContext();

  await handleStop({
    ctx: mockCtx.ctx,
    parsed: { command: 'stop', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('stopMeta has correct metadata', () => {
  assert.equal(stopMeta.name, 'stop');
});

test('handlePlanner uses pipeline with type=planner', async () => {
  const mockCtx = createMockContext();

  await handlePlanner({
    ctx: mockCtx.ctx,
    parsed: { command: 'planner', subcommand: 'status', args: [], options: {} },
    params: { type: 'planner' },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('plannerMeta has correct metadata', () => {
  assert.equal(plannerMeta.name, 'planner');
  assert.deepEqual(plannerMeta.aliases, []);
});

```

### tests/bot/commands/handlers/ls.test.js (147 lines)

```js
/**
 * Tests for F-010 /ls command handler
 * T-011: Create ls.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('F-010 /ls Command Handler', () => {
  let lsHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const lsModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/ls.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(lsModulePath.href);
    lsHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('lsMeta', () => {
    test('should export lsMeta with command metadata', async () => {
      assert.ok(lsHandler.lsMeta);
      assert.equal(lsHandler.lsMeta.name, 'ls');
      assert.ok(lsHandler.lsMeta.description);
      assert.ok(lsHandler.lsMeta.usage);
    });

    test('should have dir alias', async () => {
      assert.ok(lsHandler.lsMeta.aliases);
      assert.ok(lsHandler.lsMeta.aliases.includes('dir'));
    });

    test('should require viewer role', async () => {
      assert.equal(lsHandler.lsMeta.minRole, 'viewer');
    });
  });

  describe('handleLs', () => {
    test('should be exported', async () => {
      assert.ok(lsHandler.handleLs);
      assert.ok(typeof lsHandler.handleLs === 'function');
    });

    test('should list current directory when no path provided', async () => {
      const { handleLs } = lsHandler;

      // Set cwd to /tmp
      sessionStore.setCwd('test-session-ls-1', '/tmp');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-ls-1',
        args: []
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show directory path and item count
      assert.ok(replies[0].includes('/tmp') || replies[0].includes('目录'));
    });

    test('should list specified directory', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-ls-2',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('/tmp'));
    });

    test('should handle non-existent directory', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-ls-3',
        args: ['/nonexistent/directory/path/12345']
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('❌'));
    });

    test('should format output with emojis and file info', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-ls-4',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      // Output should contain folder/file emojis
      const hasEmojis = replies.some(r => r.includes('📁') || r.includes('📄'));
      assert.ok(hasEmojis, 'Output should contain file/folder emojis');
    });

    test('should show item count', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-ls-5',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      // Should show count
      const hasCount = replies.some(r => r.includes('项') || r.includes('共'));
      assert.ok(hasCount, 'Output should show item count');
    });
  });
});

```

### tests/bot/commands/handlers/find.test.js (141 lines)

```js
/**
 * Tests for F-010 /find command handler
 * T-021: Create find.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('F-010 /find Command Handler', () => {
  let findHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const findModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/find.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(findModulePath.href);
    findHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('findMeta', () => {
    test('should export findMeta with command metadata', async () => {
      assert.ok(findHandler.findMeta);
      assert.equal(findHandler.findMeta.name, 'find');
      assert.ok(findHandler.findMeta.description);
      assert.ok(findHandler.findMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(findHandler.findMeta.minRole, 'viewer');
    });
  });

  describe('handleFind', () => {
    test('should be exported', async () => {
      assert.ok(findHandler.handleFind);
      assert.ok(typeof findHandler.handleFind === 'function');
    });

    test('should search files with glob pattern', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-find-1',
        args: ['*.js', '/tmp']
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('搜索') || replies[0].includes('找到') || replies[0].includes('*.js'));
    });

    test('should reject missing pattern', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-find-2',
        args: []
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });

    test('should show result count', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-find-3',
        args: ['*.txt', '/tmp']
      };

      await handleFind(handlerCtx);

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('找到') || fullOutput.includes('结果'));
    });

    test('should store results in session', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-find-4',
        args: ['*.txt', '/tmp']
      };

      await handleFind(handlerCtx);

      // Check if search results were stored
      const results = sessionStore.getSearchResults('test-session-find-4');
      // Results may be null if no matches, that's ok
      if (results) {
        assert.ok(Array.isArray(results));
      }
    });

    test('should handle non-existent directory with empty results', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-find-5',
        args: ['*.txt', '/nonexistent/directory/path/12345']
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show 0 results for non-existent directory
      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('找到 0 个') || fullOutput.includes('0 个结果'));
    });
  });
});

```

### tests/bot/commands/handlers/ps.test.js (128 lines)

```js
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-012 /ps Command Handler', () => {
  let psHandler;
  let replies;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const psPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/ps.js`);
    const module = await import(psPath.href);
    psHandler = module;
    replies = [];
  });

  describe('psMeta', () => {
    test('should export psMeta with command metadata', async () => {
      assert.ok(psHandler.psMeta);
      assert.equal(psHandler.psMeta.name, 'ps');
    });

    test('should have correct minRole for ps command', async () => {
      assert.equal(psHandler.psMeta.minRole, 'viewer');
    });

    test('should have description', async () => {
      assert.ok(psHandler.psMeta.description);
    });
  });

  describe('handlePs', () => {
    test('should return process list', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      const reply = replies[0];

      // Should contain process-related info
      assert.ok(reply.includes('进程') || reply.includes('PID') || reply.includes('pid'), 'Should mention processes');
    });

    test('should support --sort=cpu option', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['--sort=cpu']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should support --sort=memory option', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['--sort=memory']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should support filter keyword', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['node']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should limit process count by default', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await psHandler.handlePs(handlerCtx);

      // Check that we don't get an excessive number of processes
      const reply = replies[0];
      const lines = reply.split('\n').filter(l => l.trim());
      // Default limit is 20, plus header lines
      assert.ok(lines.length <= 30, 'Should limit process count');
    });
  });

  describe('parseOptions', () => {
    test('should parse sort option', async () => {
      const options = psHandler.parseOptions(['--sort=cpu']);
      assert.equal(options.sortBy, 'cpu');
    });

    test('should parse limit option', async () => {
      const options = psHandler.parseOptions(['--limit=5']);
      assert.equal(options.limit, 5);
    });

    test('should treat non-option args as filter', async () => {
      const options = psHandler.parseOptions(['node', 'server']);
      assert.equal(options.filter, 'node server');
    });

    test('should handle mixed options and filter', async () => {
      const options = psHandler.parseOptions(['--sort=memory', 'python']);
      assert.equal(options.sortBy, 'memory');
      assert.equal(options.filter, 'python');
    });
  });
});

```

### tests/bot/commands/handlers/sysinfo.test.js (93 lines)

```js
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-012 /sysinfo Command Handler', () => {
  let sysinfoHandler;
  let replies;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const sysinfoPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/sysinfo.js`);
    const module = await import(sysinfoPath.href);
    sysinfoHandler = module;
    replies = [];
  });

  describe('sysinfoMeta', () => {
    test('should export sysinfoMeta with command metadata', async () => {
      assert.ok(sysinfoHandler.sysinfoMeta);
      assert.equal(sysinfoHandler.sysinfoMeta.name, 'sysinfo');
    });

    test('should have correct minRole for sysinfo command', async () => {
      assert.equal(sysinfoHandler.sysinfoMeta.minRole, 'viewer');
    });

    test('should have description', async () => {
      assert.ok(sysinfoHandler.sysinfoMeta.description);
    });
  });

  describe('handleSysinfo', () => {
    test('should return system info message', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      const reply = replies[0];

      // Should contain key system info sections
      assert.ok(reply.includes('CPU') || reply.includes('cpu'), 'Should mention CPU');
      assert.ok(reply.includes('内存') || reply.includes('Memory') || reply.includes('memory'), 'Should mention memory');
    });

    test('should format output with structured sections', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      // Should have structured output with tree-like indicators (├ └)
      assert.ok(reply.includes('├') || reply.includes('└'), 'Should have tree-style formatting');
    });

    test('should include hostname', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      assert.ok(reply.includes('主机') || reply.includes('Hostname') || reply.includes('hostname'), 'Should include hostname');
    });

    test('should include uptime', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      assert.ok(reply.includes('运行时间') || reply.includes('Uptime') || reply.includes('uptime'), 'Should include uptime');
    });
  });
});

```

