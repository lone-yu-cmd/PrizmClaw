import 'dotenv/config';
import { z } from 'zod';

import { loadPipelineInfraConfig } from './pipeline-infra/config-loader.js';
import { resolveDaemonLogPaths } from './pipeline-infra/path-policy.js';

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  ENABLE_TELEGRAM: z.string().optional().default('true'),
  ALLOWED_USER_IDS: z.string().optional().default(''),
  CODEBUDDY_BIN: z.string().min(1).default('codebuddy'),
  CODEBUDDY_PERMISSION_FLAG: z.string().default('-y'),
  CODEBUDDY_ECHO_STDIO: z.string().optional().default('true'),
  CODEBUDDY_HEARTBEAT_MS: z.coerce.number().int().nonnegative().default(15000),
  TELEGRAM_FILE_ALLOWED_ROOTS: z.string().optional().default(''),
  TELEGRAM_FILE_CANDIDATE_DIRS: z.string().optional().default(''),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(120000),
  MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(8000),
  MAX_HISTORY_TURNS: z.coerce.number().int().positive().default(10),
  WEB_HOST: z.string().default('127.0.0.1'),
  WEB_PORT: z.coerce.number().int().positive().default(8787),
  ENABLE_SYSTEM_EXEC: z.string().optional().default('false'),
  ALLOWED_COMMAND_PREFIXES: z.string().optional().default(''),
  SYSTEM_EXEC_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // F-006: Safety and Permission Guard
  USER_PERMISSIONS: z.string().optional().default(''),
  ALLOW_ADMIN_SKIP_CONFIRM: z.string().optional().default('true'),
  AUDIT_LOG_DIR: z.string().optional().default('logs'),
  AUDIT_LOG_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),
  AUDIT_LOG_MAX_FILES: z.coerce.number().int().positive().default(5),
  // F-009: General Command Executor
  COMMAND_BLACKLIST: z.string().optional().default(''),
  HIGH_RISK_KEYWORDS: z.string().optional().default('rm -rf,sudo,kill,chmod -R,chown,dd,mkfs,shutdown,reboot,halt'),
  DIRECT_EXEC_MODE: z.string().optional().default('false'),
  // F-010: File Manager
  FILE_MAX_READ_SIZE: z.coerce.number().int().positive().default(1048576), // 1MB
  FILE_MAX_TREE_DEPTH: z.coerce.number().int().positive().default(3),
  FILE_MAX_TREE_ITEMS: z.coerce.number().int().positive().default(100),
  FILE_MAX_SEARCH_DEPTH: z.coerce.number().int().positive().default(10),
  FILE_MAX_SEARCH_RESULTS: z.coerce.number().int().positive().default(100),
  FILE_SEARCH_RESULTS_PER_PAGE: z.coerce.number().int().positive().default(20)
});

const parsed = schema.parse(process.env);

function parseAllowedUserIds(input) {
  return new Set(
    input
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function parseCsvList(input) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(input) {
  const normalized = (input ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * Parse USER_PERMISSIONS env var into a Map of userId -> role
 * Format: "123456789:admin,987654321:operator"
 * @param {string} input
 * @returns {Map<string, string>}
 */
function parseUserPermissions(input) {
  const permissions = new Map();
  if (!input || !input.trim()) {
    return permissions;
  }

  const entries = input.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const [userId, role] = entry.split(':').map((s) => s.trim());
    if (userId && role) {
      const normalizedRole = role.toLowerCase();
      if (['admin', 'operator', 'viewer'].includes(normalizedRole)) {
        permissions.set(userId, normalizedRole);
      }
    }
  }
  return permissions;
}

const enableTelegram = parseBoolean(parsed.ENABLE_TELEGRAM);
if (enableTelegram && !parsed.TELEGRAM_BOT_TOKEN) {
  throw new Error('ENABLE_TELEGRAM=true 时必须提供 TELEGRAM_BOT_TOKEN');
}

const pipelineInfra = loadPipelineInfraConfig({
  env: process.env,
  argv: process.argv.slice(2),
  cwd: process.cwd()
});

const daemonLogPaths = resolveDaemonLogPaths(pipelineInfra.projectRoot);

export const config = Object.freeze({
  telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
  enableTelegram,
  allowedUserIds: parseAllowedUserIds(parsed.ALLOWED_USER_IDS),
  codebuddyBin: parsed.CODEBUDDY_BIN,
  codebuddyPermissionFlag: parsed.CODEBUDDY_PERMISSION_FLAG,
  codebuddyEchoStdio: parseBoolean(parsed.CODEBUDDY_ECHO_STDIO),
  codebuddyHeartbeatMs: parsed.CODEBUDDY_HEARTBEAT_MS,
  telegramFileAllowedRoots: parseCsvList(parsed.TELEGRAM_FILE_ALLOWED_ROOTS),
  telegramFileCandidateDirs: parseCsvList(parsed.TELEGRAM_FILE_CANDIDATE_DIRS),
  requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
  maxPromptChars: parsed.MAX_PROMPT_CHARS,
  maxHistoryTurns: parsed.MAX_HISTORY_TURNS,
  webHost: parsed.WEB_HOST,
  webPort: parsed.WEB_PORT,
  enableSystemExec: parseBoolean(parsed.ENABLE_SYSTEM_EXEC),
  allowedCommandPrefixes: parseCsvList(parsed.ALLOWED_COMMAND_PREFIXES),
  systemExecTimeoutMs: parsed.SYSTEM_EXEC_TIMEOUT_MS,
  logLevel: parsed.LOG_LEVEL,
  // F-006: Safety and Permission Guard
  userPermissions: parseUserPermissions(parsed.USER_PERMISSIONS),
  allowAdminSkipConfirm: parseBoolean(parsed.ALLOW_ADMIN_SKIP_CONFIRM),
  auditLogDir: parsed.AUDIT_LOG_DIR,
  auditLogMaxSizeMb: parsed.AUDIT_LOG_MAX_SIZE_MB,
  auditLogMaxFiles: parsed.AUDIT_LOG_MAX_FILES,
  // F-009: General Command Executor
  commandBlacklist: parseCsvList(parsed.COMMAND_BLACKLIST),
  highRiskKeywords: parseCsvList(parsed.HIGH_RISK_KEYWORDS),
  directExecMode: parseBoolean(parsed.DIRECT_EXEC_MODE),
  // F-010: File Manager
  fileMaxReadSize: parsed.FILE_MAX_READ_SIZE,
  fileMaxTreeDepth: parsed.FILE_MAX_TREE_DEPTH,
  fileMaxTreeItems: parsed.FILE_MAX_TREE_ITEMS,
  fileMaxSearchDepth: parsed.FILE_MAX_SEARCH_DEPTH,
  fileMaxSearchResults: parsed.FILE_MAX_SEARCH_RESULTS,
  fileSearchResultsPerPage: parsed.FILE_SEARCH_RESULTS_PER_PAGE,
  pipelineInfra: Object.freeze({
    ...pipelineInfra,
    daemonLogPaths
  })
});
