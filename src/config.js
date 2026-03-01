import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  ENABLE_TELEGRAM: z.string().optional().default('true'),
  ALLOWED_USER_IDS: z.string().optional().default(''),
  CODEBUDDY_BIN: z.string().min(1).default('codebuddy'),
  CODEBUDDY_PERMISSION_FLAG: z.string().default('-y'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(8000),
  MAX_HISTORY_TURNS: z.coerce.number().int().positive().default(10),
  WEB_HOST: z.string().default('127.0.0.1'),
  WEB_PORT: z.coerce.number().int().positive().default(8787),
  ENABLE_SYSTEM_EXEC: z.string().optional().default('false'),
  ALLOWED_COMMAND_PREFIXES: z.string().optional().default(''),
  SYSTEM_EXEC_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
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

const enableTelegram = parseBoolean(parsed.ENABLE_TELEGRAM);
if (enableTelegram && !parsed.TELEGRAM_BOT_TOKEN) {
  throw new Error('ENABLE_TELEGRAM=true 时必须提供 TELEGRAM_BOT_TOKEN');
}

export const config = Object.freeze({
  telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
  enableTelegram,
  allowedUserIds: parseAllowedUserIds(parsed.ALLOWED_USER_IDS),
  codebuddyBin: parsed.CODEBUDDY_BIN,
  codebuddyPermissionFlag: parsed.CODEBUDDY_PERMISSION_FLAG,
  requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
  maxPromptChars: parsed.MAX_PROMPT_CHARS,
  maxHistoryTurns: parsed.MAX_HISTORY_TURNS,
  webHost: parsed.WEB_HOST,
  webPort: parsed.WEB_PORT,
  enableSystemExec: parseBoolean(parsed.ENABLE_SYSTEM_EXEC),
  allowedCommandPrefixes: parseCsvList(parsed.ALLOWED_COMMAND_PREFIXES),
  systemExecTimeoutMs: parsed.SYSTEM_EXEC_TIMEOUT_MS,
  logLevel: parsed.LOG_LEVEL
});
