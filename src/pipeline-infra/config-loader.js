import fs from 'node:fs';
import path from 'node:path';

import { createInfraError, INFRA_ERROR_CODES } from './error-codes.js';

function toArgMap(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const map = new Map();

  for (let i = 0; i < args.length; i += 1) {
    const token = String(args[i] ?? '');
    if (!token.startsWith('--')) {
      continue;
    }

    const normalized = token.slice(2);
    if (!normalized) {
      continue;
    }

    if (normalized.includes('=')) {
      const [key, ...rest] = normalized.split('=');
      map.set(key, rest.join('='));
      continue;
    }

    const next = args[i + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      map.set(normalized, next);
      i += 1;
    } else {
      map.set(normalized, 'true');
    }
  }

  return map;
}

function toAbsolutePath(raw, projectRoot) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return '';
  }

  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }

  return path.resolve(projectRoot, value);
}

function parseInteger({ raw, field, min, code = INFRA_ERROR_CODES.CONFIG_INVALID, hint }) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    throwInfraError({
      code,
      field,
      message: `${field} must be an integer >= ${min}`,
      hint
    });
  }

  return parsed;
}

function throwInfraError({ code, field, message, hint, context = undefined }) {
  const infraError = createInfraError(code, message, {
    hint,
    context: {
      ...(context ?? {}),
      field
    }
  });

  const err = new Error(`${infraError.message} (field: ${field}, hint: ${hint ?? 'n/a'})`);
  const mutableError = /** @type {any} */ (err);
  mutableError.code = infraError.code;
  mutableError.hint = infraError.hint;
  mutableError.context = infraError.context;
  mutableError.infraError = infraError;
  throw mutableError;
}

function ensureDirectoryExists(dirPath, field) {
  if (!fs.existsSync(dirPath)) {
    throwInfraError({
      code: INFRA_ERROR_CODES.CONFIG_MISSING,
      field,
      message: `${field} does not exist: ${dirPath}`,
      hint: 'Ensure project root points to a repository containing dev-pipeline/'
    });
  }
}

export function loadPipelineInfraConfig(input = {}) {
  const env = input.env ?? process.env;
  const argv = input.argv ?? [];
  const cwd = input.cwd ?? process.cwd();
  const argMap = toArgMap(argv);

  const projectRootRaw = argMap.get('project-root') ?? env.PIPELINE_PROJECT_ROOT ?? cwd;
  const projectRoot = toAbsolutePath(projectRootRaw, cwd);

  if (!projectRoot) {
    throwInfraError({
      code: INFRA_ERROR_CODES.CONFIG_MISSING,
      field: 'projectRoot',
      message: 'projectRoot is required',
      hint: 'Set --project-root or PIPELINE_PROJECT_ROOT, or provide cwd input'
    });
  }

  const pipelineDir = toAbsolutePath(
    argMap.get('pipeline-dir') ?? env.PIPELINE_DIR ?? path.join(projectRoot, 'dev-pipeline'),
    projectRoot
  );

  ensureDirectoryExists(pipelineDir, 'pipelineDir');

  const featureListPath = toAbsolutePath(
    argMap.get('feature-list') ?? env.FEATURE_LIST_PATH ?? path.join(projectRoot, 'feature-list.json'),
    projectRoot
  );

  const bugFixListPath = toAbsolutePath(
    argMap.get('bug-fix-list') ?? env.BUG_FIX_LIST_PATH ?? path.join(projectRoot, 'bug-fix-list.json'),
    projectRoot
  );

  // T-003: plansDir for versioned plan files
  const plansDir = toAbsolutePath(
    argMap.get('plans-dir') ?? env.PLANS_DIR ?? path.join(projectRoot, 'plans'),
    projectRoot
  );

  const maxRetries = parseInteger({
    raw: argMap.get('max-retries') ?? env.MAX_RETRIES ?? 3,
    field: 'MAX_RETRIES',
    min: 1,
    hint: 'Set MAX_RETRIES to a positive integer'
  });

  const sessionTimeoutSec = parseInteger({
    raw: argMap.get('session-timeout') ?? env.SESSION_TIMEOUT ?? 0,
    field: 'SESSION_TIMEOUT',
    min: 0,
    hint: 'Set SESSION_TIMEOUT to 0 or a positive integer (seconds)'
  });

  const heartbeatIntervalSec = parseInteger({
    raw: argMap.get('heartbeat-interval') ?? env.HEARTBEAT_INTERVAL ?? 30,
    field: 'HEARTBEAT_INTERVAL',
    min: 1,
    hint: 'Set HEARTBEAT_INTERVAL to a positive integer (seconds)'
  });

  // F-005: Heartbeat config options (AC-4.5)
  const heartbeatEnabled = String(argMap.get('heartbeat-enabled') ?? env.HEARTBEAT_ENABLED ?? 'true').trim().toLowerCase() === 'true';

  const heartbeatChatIdRaw = argMap.get('heartbeat-chat-id') ?? env.HEARTBEAT_CHAT_ID;
  const heartbeatChatId = heartbeatChatIdRaw ? Number.parseInt(String(heartbeatChatIdRaw), 10) : null;

  const heartbeatIntervalMs = parseInteger({
    raw: argMap.get('heartbeat-interval-ms') ?? env.HEARTBEAT_INTERVAL_MS ?? heartbeatIntervalSec * 1000,
    field: 'HEARTBEAT_INTERVAL_MS',
    min: 1000,
    hint: 'Set HEARTBEAT_INTERVAL_MS to at least 1000 (milliseconds)'
  });

  const silentMode = String(argMap.get('silent-mode') ?? env.SILENT_MODE ?? 'false').trim().toLowerCase() === 'true';

  const errorLinesCount = parseInteger({
    raw: argMap.get('error-lines-count') ?? env.ERROR_LINES_COUNT ?? 10,
    field: 'ERROR_LINES_COUNT',
    min: 0,
    hint: 'Set ERROR_LINES_COUNT to a non-negative integer'
  });

  const aiCli = String(argMap.get('ai-cli') ?? env.AI_CLI ?? env.CODEBUDDY_CLI ?? 'cbc').trim();
  if (!aiCli) {
    throwInfraError({
      code: INFRA_ERROR_CODES.CONFIG_MISSING,
      field: 'AI_CLI',
      message: 'AI_CLI is required',
      hint: 'Set AI_CLI or CODEBUDDY_CLI to a CLI command name'
    });
  }

  const platformRaw = String(
    argMap.get('platform') ?? env.PRIZMKIT_PLATFORM ?? (aiCli.includes('claude') ? 'claude' : 'codebuddy')
  ).trim();

  if (platformRaw !== 'codebuddy' && platformRaw !== 'claude') {
    throwInfraError({
      code: INFRA_ERROR_CODES.CONFIG_INVALID,
      field: 'PRIZMKIT_PLATFORM',
      message: `Unsupported platform: ${platformRaw}`,
      hint: "Use 'codebuddy' or 'claude'"
    });
  }

  return Object.freeze({
    projectRoot,
    pipelineDir,
    featureListPath,
    bugFixListPath,
    plansDir,
    stateDir: path.join(pipelineDir, 'state'),
    bugfixStateDir: path.join(pipelineDir, 'bugfix-state'),
    maxRetries,
    sessionTimeoutSec,
    heartbeatIntervalSec,
    // F-005: Heartbeat config options (AC-4.5)
    heartbeatEnabled,
    heartbeatChatId,
    heartbeatIntervalMs,
    silentMode,
    errorLinesCount,
    aiCli,
    platform: platformRaw
  });
}

/**
 * @typedef {Object} ConfigError
 * @property {string} field - Config field name
 * @property {string} message - Human-readable error description
 * @property {string} [hint] - Resolution suggestion
 * @property {string} code - Error code from INFRA_ERROR_CODES
 */

/**
 * @typedef {Object} ConfigValidationResult
 * @property {boolean} ok
 * @property {Object} [config] - Frozen config object, present when ok=true
 * @property {ConfigError[]} [errors] - Present when ok=false
 */

/**
 * Batch-validate pipeline infrastructure config, collecting ALL errors before returning.
 * Unlike loadPipelineInfraConfig (fail-fast), this collects every validation error.
 * @param {Object} [input]
 * @returns {ConfigValidationResult}
 */
export function loadAndValidateConfig(input = {}) {
  const env = input.env ?? process.env;
  const argv = input.argv ?? [];
  const cwd = input.cwd ?? process.cwd();
  const argMap = toArgMap(argv);
  /** @type {ConfigError[]} */
  const errors = [];

  // --- projectRoot (required, no recovery possible if missing) ---
  const projectRootRaw = argMap.get('project-root') ?? env.PIPELINE_PROJECT_ROOT ?? cwd;
  const projectRoot = toAbsolutePath(projectRootRaw, cwd);

  if (!projectRoot) {
    errors.push({
      field: 'projectRoot',
      message: 'projectRoot is required',
      hint: 'Set --project-root or PIPELINE_PROJECT_ROOT, or provide cwd input',
      code: INFRA_ERROR_CODES.CONFIG_MISSING
    });
    // Can't continue without projectRoot
    return { ok: false, errors };
  }

  // --- pipelineDir ---
  const pipelineDir = toAbsolutePath(
    argMap.get('pipeline-dir') ?? env.PIPELINE_DIR ?? path.join(projectRoot, 'dev-pipeline'),
    projectRoot
  );

  if (!fs.existsSync(pipelineDir)) {
    errors.push({
      field: 'pipelineDir',
      message: `pipelineDir does not exist: ${pipelineDir}`,
      hint: 'Ensure project root points to a repository containing dev-pipeline/',
      code: INFRA_ERROR_CODES.CONFIG_MISSING
    });
  }

  // --- path fields (no validation errors possible) ---
  const featureListPath = toAbsolutePath(
    argMap.get('feature-list') ?? env.FEATURE_LIST_PATH ?? path.join(projectRoot, 'feature-list.json'),
    projectRoot
  );

  const bugFixListPath = toAbsolutePath(
    argMap.get('bug-fix-list') ?? env.BUG_FIX_LIST_PATH ?? path.join(projectRoot, 'bug-fix-list.json'),
    projectRoot
  );

  const plansDir = toAbsolutePath(
    argMap.get('plans-dir') ?? env.PLANS_DIR ?? path.join(projectRoot, 'plans'),
    projectRoot
  );

  // --- integer fields (each wrapped in try/catch) ---
  let maxRetries;
  try {
    maxRetries = parseInteger({
      raw: argMap.get('max-retries') ?? env.MAX_RETRIES ?? 3,
      field: 'MAX_RETRIES',
      min: 1,
      hint: 'Set MAX_RETRIES to a positive integer'
    });
  } catch (/** @type {any} */ e) {
    errors.push({
      field: e.context?.field ?? 'MAX_RETRIES',
      message: e.infraError?.message ?? e.message,
      hint: e.hint ?? e.infraError?.hint,
      code: e.code ?? INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  let sessionTimeoutSec;
  try {
    sessionTimeoutSec = parseInteger({
      raw: argMap.get('session-timeout') ?? env.SESSION_TIMEOUT ?? 0,
      field: 'SESSION_TIMEOUT',
      min: 0,
      hint: 'Set SESSION_TIMEOUT to 0 or a positive integer (seconds)'
    });
  } catch (/** @type {any} */ e) {
    errors.push({
      field: e.context?.field ?? 'SESSION_TIMEOUT',
      message: e.infraError?.message ?? e.message,
      hint: e.hint ?? e.infraError?.hint,
      code: e.code ?? INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  let heartbeatIntervalSec;
  try {
    heartbeatIntervalSec = parseInteger({
      raw: argMap.get('heartbeat-interval') ?? env.HEARTBEAT_INTERVAL ?? 30,
      field: 'HEARTBEAT_INTERVAL',
      min: 1,
      hint: 'Set HEARTBEAT_INTERVAL to a positive integer (seconds)'
    });
  } catch (/** @type {any} */ e) {
    errors.push({
      field: e.context?.field ?? 'HEARTBEAT_INTERVAL',
      message: e.infraError?.message ?? e.message,
      hint: e.hint ?? e.infraError?.hint,
      code: e.code ?? INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  // --- boolean fields (no validation errors possible) ---
  const heartbeatEnabled = String(argMap.get('heartbeat-enabled') ?? env.HEARTBEAT_ENABLED ?? 'true').trim().toLowerCase() === 'true';

  const heartbeatChatIdRaw = argMap.get('heartbeat-chat-id') ?? env.HEARTBEAT_CHAT_ID;
  const heartbeatChatId = heartbeatChatIdRaw ? Number.parseInt(String(heartbeatChatIdRaw), 10) : null;

  let heartbeatIntervalMs;
  try {
    heartbeatIntervalMs = parseInteger({
      raw: argMap.get('heartbeat-interval-ms') ?? env.HEARTBEAT_INTERVAL_MS ?? (heartbeatIntervalSec ?? 30) * 1000,
      field: 'HEARTBEAT_INTERVAL_MS',
      min: 1000,
      hint: 'Set HEARTBEAT_INTERVAL_MS to at least 1000 (milliseconds)'
    });
  } catch (/** @type {any} */ e) {
    errors.push({
      field: e.context?.field ?? 'HEARTBEAT_INTERVAL_MS',
      message: e.infraError?.message ?? e.message,
      hint: e.hint ?? e.infraError?.hint,
      code: e.code ?? INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  const silentMode = String(argMap.get('silent-mode') ?? env.SILENT_MODE ?? 'false').trim().toLowerCase() === 'true';

  let errorLinesCount;
  try {
    errorLinesCount = parseInteger({
      raw: argMap.get('error-lines-count') ?? env.ERROR_LINES_COUNT ?? 10,
      field: 'ERROR_LINES_COUNT',
      min: 0,
      hint: 'Set ERROR_LINES_COUNT to a non-negative integer'
    });
  } catch (/** @type {any} */ e) {
    errors.push({
      field: e.context?.field ?? 'ERROR_LINES_COUNT',
      message: e.infraError?.message ?? e.message,
      hint: e.hint ?? e.infraError?.hint,
      code: e.code ?? INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  // --- aiCli ---
  const aiCli = String(argMap.get('ai-cli') ?? env.AI_CLI ?? env.CODEBUDDY_CLI ?? 'cbc').trim();
  if (!aiCli) {
    errors.push({
      field: 'AI_CLI',
      message: 'AI_CLI is required',
      hint: 'Set AI_CLI or CODEBUDDY_CLI to a CLI command name',
      code: INFRA_ERROR_CODES.CONFIG_MISSING
    });
  }

  // --- platform ---
  const platformRaw = String(
    argMap.get('platform') ?? env.PRIZMKIT_PLATFORM ?? ((aiCli || '').includes('claude') ? 'claude' : 'codebuddy')
  ).trim();

  if (platformRaw !== 'codebuddy' && platformRaw !== 'claude') {
    errors.push({
      field: 'PRIZMKIT_PLATFORM',
      message: `Unsupported platform: ${platformRaw}`,
      hint: "Use 'codebuddy' or 'claude'",
      code: INFRA_ERROR_CODES.CONFIG_INVALID
    });
  }

  // --- return result ---
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: Object.freeze({
      projectRoot,
      pipelineDir,
      featureListPath,
      bugFixListPath,
      plansDir,
      stateDir: path.join(pipelineDir, 'state'),
      bugfixStateDir: path.join(pipelineDir, 'bugfix-state'),
      maxRetries,
      sessionTimeoutSec,
      heartbeatIntervalSec,
      heartbeatEnabled,
      heartbeatChatId,
      heartbeatIntervalMs,
      silentMode,
      errorLinesCount,
      aiCli,
      platform: platformRaw
    })
  };
}
