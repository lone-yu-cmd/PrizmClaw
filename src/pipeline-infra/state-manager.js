/**
 * State Manager
 *
 * F-004: Pipeline Process Controller - US-5 Status Query, US-6 Logs Query
 *
 * Manages reading and writing pipeline state files including:
 * - Daemon meta (.pipeline-meta.json)
 * - Pipeline state (pipeline.json)
 * - Current session (current-session.json)
 * - Last result (.last-result.json)
 *
 * Design Decisions:
 * - D3: Reuse existing state files (backward compatible)
 * - D6: Last result stored in separate file
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadPipelineInfraConfig } from './config-loader.js';
import { getStatePaths } from './path-policy.js';

/**
 * @typedef {'feature' | 'bugfix'} PipelineType
 */

/**
 * @typedef {Object} DaemonMeta
 * @property {number} pid - Daemon process ID
 * @property {string} started_at - ISO timestamp when daemon started
 * @property {string} feature_list - Path to feature list
 * @property {string} env_overrides - Environment overrides string
 * @property {string} log_file - Path to log file
 */

/**
 * @typedef {Object} PipelineState
 * @property {string} run_id - Unique run identifier
 * @property {string} status - Pipeline status (running/paused/completed/failed)
 * @property {string} feature_list_path - Path to feature list
 * @property {string} created_at - ISO timestamp when created
 * @property {number} total_features - Total features to process
 * @property {number} completed_features - Number of completed features
 * @property {string} [paused_at] - ISO timestamp when paused
 */

/**
 * @typedef {Object} LastResult
 * @property {string} runId - Run identifier
 * @property {string} completedAt - ISO timestamp when completed
 * @property {'success' | 'failed' | 'partial'} status - Completion status
 * @property {number} featuresTotal - Total features
 * @property {number} featuresCompleted - Completed features count
 * @property {number} [exitCode] - Exit code
 * @property {string} [message] - Result message
 */

/**
 * Safely read and parse a JSON file.
 * @param {string} filePath - File path
 * @returns {Object | null} Parsed JSON or null if file doesn't exist
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write JSON to file atomically.
 * @param {string} filePath - File path
 * @param {Object} data - Data to write
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

/**
 * Check if a process is alive.
 * @param {number} pid - Process ID to check
 * @returns {boolean} True if process is alive
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

/**
 * Create a state manager instance.
 * @param {Object} [options] - Options
 * @param {Object} [options.config] - Pipeline config (will load if not provided)
 * @returns {Object} State manager instance
 */
export function createStateManager(options = {}) {
  const config = options.config ?? loadPipelineInfraConfig();

  /**
   * Get state paths for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @returns {Object} State paths
   */
  function getPaths(type) {
    return getStatePaths(config.projectRoot, type);
  }

  /**
   * Read daemon meta file.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<DaemonMeta | null>} Daemon meta or null
   */
  async function readDaemonMeta(type) {
    const paths = getPaths(type);
    return readJsonFile(paths.daemonMetaFile);
  }

  /**
   * Read pipeline state file.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<PipelineState | null>} Pipeline state or null
   */
  async function readPipelineState(type) {
    const paths = getPaths(type);
    return readJsonFile(paths.pipelineStateFile);
  }

  /**
   * Read current session file.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<Object | null>} Current session or null
   */
  async function readCurrentSession(type) {
    const paths = getPaths(type);
    return readJsonFile(paths.currentSessionFile);
  }

  /**
   * Get last result.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<LastResult | null>} Last result or null
   */
  async function getLastResult(type) {
    const paths = getPaths(type);
    return readJsonFile(paths.lastResultFile);
  }

  /**
   * Write daemon meta file.
   * @param {PipelineType} type - Pipeline type
   * @param {DaemonMeta} meta - Daemon meta to write
   * @returns {Promise<void>}
   */
  async function writeDaemonMeta(type, meta) {
    const paths = getPaths(type);
    writeJsonFile(paths.daemonMetaFile, meta);
  }

  /**
   * Write last result file.
   * @param {PipelineType} type - Pipeline type
   * @param {LastResult} result - Last result to write
   * @returns {Promise<void>}
   */
  async function writeLastResult(type, result) {
    const paths = getPaths(type);
    writeJsonFile(paths.lastResultFile, result);
  }

  /**
   * Check if daemon is running.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<boolean>} True if daemon is running
   */
  async function isDaemonRunning(type) {
    const meta = await readDaemonMeta(type);
    if (!meta || !meta.pid) {
      return false;
    }
    return isProcessAlive(meta.pid);
  }

  /**
   * Get daemon PID.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<number | null>} Daemon PID or null
   */
  async function getDaemonPid(type) {
    const meta = await readDaemonMeta(type);
    return meta?.pid ?? null;
  }

  /**
   * Read log file with line limit.
   * @param {PipelineType} type - Pipeline type
   * @param {number} [lines] - Number of lines (default: 100)
   * @returns {Promise<{logs: string, logPath: string, lines: number}>}
   */
  async function readLogs(type, lines = 100) {
    const paths = getPaths(type);
    const logPath = paths.daemonLogFile;

    if (!fs.existsSync(logPath)) {
      return { logs: '', logPath, lines: 0 };
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const allLines = content.split('\n');
      const selectedLines = allLines.slice(-lines);
      return {
        logs: selectedLines.join('\n'),
        logPath,
        lines: selectedLines.filter(l => l.trim()).length
      };
    } catch {
      return { logs: '', logPath, lines: 0 };
    }
  }

  return {
    readDaemonMeta,
    readPipelineState,
    readCurrentSession,
    getLastResult,
    writeDaemonMeta,
    writeLastResult,
    isDaemonRunning,
    getDaemonPid,
    readLogs
  };
}

// Default instance
let defaultManager = null;

/**
 * Get default state manager instance.
 * @returns {Object} Default state manager
 */
export function getDefaultStateManager() {
  if (!defaultManager) {
    defaultManager = createStateManager();
  }
  return defaultManager;
}
