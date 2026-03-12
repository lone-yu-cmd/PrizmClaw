/**
 * Reusable CLI entry wrapper for pipeline scripts.
 *
 * F-001 / US-3: Standardizes argument parsing, config loading,
 * logging setup, and exit codes for Node.js CLI scripts.
 *
 * Imports pino directly (not src/utils/logger.js) to avoid circular deps.
 */

import pino from 'pino';
import { EXIT_CODES } from './error-codes.js';
import { loadPipelineInfraConfig } from './config-loader.js';

/**
 * @typedef {Object} CliEntryOptions
 * @property {string} name - Script name (for --help and error messages)
 * @property {string} [description] - Script description
 * @property {string[]} [requiredArgs] - Required positional arg names
 * @property {Record<string, {type: 'string'|'boolean'|'number', default?: any, description?: string}>} [flags]
 * @property {string[]} [argv] - CLI arguments (defaults to process.argv.slice(2))
 * @property {(code: number) => void} [exitFn] - Exit function (defaults to process.exit)
 */

/**
 * @typedef {Object} CliEntryContext
 * @property {(fn: () => Promise<void>) => Promise<void>} run - Execute the main function with error handling
 * @property {object} config - Loaded pipeline infra config
 * @property {object} logger - Pino logger instance
 * @property {Map<string, any>} flags - Parsed flags
 * @property {string[]} positionalArgs - Remaining positional arguments
 */

// Built-in flags that are always recognized (consumed by loadPipelineInfraConfig or this wrapper)
const BUILTIN_FLAGS = new Set([
  'project-root',
  'pipeline-dir',
  'feature-list',
  'bug-fix-list',
  'plans-dir',
  'max-retries',
  'session-timeout',
  'heartbeat-interval',
  'heartbeat-enabled',
  'heartbeat-chat-id',
  'heartbeat-interval-ms',
  'silent-mode',
  'error-lines-count',
  'ai-cli',
  'platform',
  'help',
]);

/**
 * Creates a CLI entry point with standardized behavior.
 * @param {CliEntryOptions} options
 * @returns {CliEntryContext}
 */
export function createCliEntry(options) {
  const {
    name,
    description = '',
    requiredArgs = [],
    flags: flagDefs = {},
    argv = process.argv.slice(2),
    exitFn = process.exit,
  } = options;

  const logger = pino({ name, level: 'info' });

  // --- Parse raw argv into flags map and positional args ---
  const rawArgs = Array.isArray(argv) ? argv : [];
  /** @type {Map<string, string>} */
  const rawFlagMap = new Map();
  /** @type {string[]} */
  const positionalArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const token = String(rawArgs[i]);
    if (token.startsWith('--')) {
      const flagName = token.slice(2);
      if (!flagName) continue;

      if (flagName.includes('=')) {
        const [key, ...rest] = flagName.split('=');
        rawFlagMap.set(key, rest.join('='));
        continue;
      }

      // Check if this is a boolean flag (no next value or next is also a flag)
      const isBooleanDef = flagDefs[flagName]?.type === 'boolean';
      const next = rawArgs[i + 1];
      if (isBooleanDef || next === undefined || next.startsWith('--')) {
        rawFlagMap.set(flagName, 'true');
      } else {
        rawFlagMap.set(flagName, next);
        i++;
      }
    } else {
      positionalArgs.push(token);
    }
  }

  // --- Handle --help ---
  if (rawFlagMap.has('help')) {
    const lines = [`Usage: ${name} [options]${requiredArgs.map(a => ` <${a}>`).join('')}`];
    if (description) {
      lines.push('', description);
    }
    if (Object.keys(flagDefs).length > 0) {
      lines.push('', 'Options:');
      for (const [flagName, def] of Object.entries(flagDefs)) {
        const defaultStr = def.default !== undefined ? ` (default: ${def.default})` : '';
        lines.push(`  --${flagName}  ${def.description || ''}${defaultStr}`);
      }
    }
    lines.push('  --help  Show this help message');
    logger.info(lines.join('\n'));
    exitFn(EXIT_CODES.USAGE_ERROR);
    // Return a stub context so the function always returns the right shape
    return _stubContext(logger, exitFn);
  }

  // --- Detect unknown flags ---
  const knownFlags = new Set([...BUILTIN_FLAGS, ...Object.keys(flagDefs)]);
  for (const flagName of rawFlagMap.keys()) {
    if (!knownFlags.has(flagName)) {
      logger.error(`Unknown flag: --${flagName}`);
      exitFn(EXIT_CODES.USAGE_ERROR);
      return _stubContext(logger, exitFn);
    }
  }

  // --- Parse typed custom flags with defaults ---
  /** @type {Map<string, any>} */
  const flags = new Map();
  for (const [flagName, def] of Object.entries(flagDefs)) {
    if (rawFlagMap.has(flagName)) {
      const rawVal = rawFlagMap.get(flagName);
      switch (def.type) {
        case 'boolean':
          flags.set(flagName, rawVal === 'true' || rawVal === '1');
          break;
        case 'number':
          flags.set(flagName, Number(rawVal));
          break;
        default: // string
          flags.set(flagName, rawVal);
          break;
      }
    } else {
      flags.set(flagName, def.default);
    }
  }

  // --- Validate required positional args ---
  if (requiredArgs.length > 0 && positionalArgs.length < requiredArgs.length) {
    const missing = requiredArgs.slice(positionalArgs.length);
    logger.error(`Missing required argument(s): ${missing.join(', ')}`);
    exitFn(EXIT_CODES.USAGE_ERROR);
    return _stubContext(logger, exitFn);
  }

  // --- Load config ---
  const config = loadPipelineInfraConfig({ argv });

  // --- Build run function ---
  /**
   * Execute the main function with standardized error handling.
   * @param {() => Promise<void>} fn
   */
  async function run(fn) {
    try {
      await fn();
      exitFn(EXIT_CODES.SUCCESS);
    } catch (/** @type {any} */ err) {
      logger.error({ err: err?.message ?? err }, `${name} failed`);
      exitFn(EXIT_CODES.RUNTIME_ERROR);
    }
  }

  return { run, config, logger, flags, positionalArgs };
}

/**
 * Create a stub context for early-exit paths (help, unknown flag, etc.)
 * @param {object} logger
 * @param {(code: number) => void} exitFn
 * @returns {CliEntryContext}
 */
function _stubContext(logger, exitFn) {
  return {
    run: async () => { exitFn(EXIT_CODES.RUNTIME_ERROR); },
    config: /** @type {any} */ ({}),
    logger,
    flags: new Map(),
    positionalArgs: [],
  };
}
