import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { createLockManager, getDefaultLockManager } from '../pipeline-infra/lock-manager.js';
import { createStateManager, getDefaultStateManager } from '../pipeline-infra/state-manager.js';
import { executePipelineCommand, buildPipelineCommand } from '../pipeline-infra/script-runner.js';
import { loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';
import { resolveDaemonLogPaths } from '../pipeline-infra/path-policy.js';
import { INFRA_ERROR_CODES } from '../pipeline-infra/error-codes.js';

const DEFAULT_LOG_LINES = 100;
const DEFAULT_STOP_TIMEOUT_MS = 10000;

/**
 * Build an error result object.
 * @param {string} errorCode - Error code
 * @param {string} message - Error message
 * @param {Object} [options] - Additional options
 * @param {string} [options.hint] - Hint for resolving the error
 * @param {Object} [options.context] - Additional context
 * @returns {Object} Error result
 */
function buildError(errorCode, message, options = {}) {
  return {
    ok: false,
    errorCode,
    message,
    ...(options.hint ? { hint: options.hint } : {}),
    ...(options.context ? { context: options.context } : {})
  };
}

/**
 * Build a success result object.
 * @param {string} message - Success message
 * @param {Object} [extra] - Additional fields
 * @returns {Object} Success result
 */
function buildResult(message, extra = {}) {
  return {
    ok: true,
    message,
    ...extra
  };
}

/**
 * Generate a unique run ID.
 * @returns {string} Run ID
 */
function generateRunId() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
  return `run-${timestamp}`;
}

/**
 * Read last N lines from a file.
 * @param {string} filePath - Path to file
 * @param {number} lines - Number of lines to read
 * @returns {string} File content
 */
function readLastLines(filePath, lines) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n');
    const selectedLines = allLines.slice(-lines);
    return selectedLines.join('\n');
  } catch {
    return '';
  }
}

/**
 * Create a pipeline controller instance.
 * @param {Object} options - Options
 * @param {Object} [options.lockManager] - Lock manager instance
 * @param {Object} [options.stateManager] - State manager instance
 * @param {Function} [options.scriptRunner] - Script runner function
 * @param {Object} [options.config] - Pipeline config
 * @returns {Object} Pipeline controller interface
 */
export function createPipelineController(options = {}) {
  const lockManager = options.lockManager || getDefaultLockManager();
  const stateManager = options.stateManager || getDefaultStateManager();
  const scriptRunner = options.scriptRunner || executePipelineCommand;
  const config = options.config || loadPipelineInfraConfig();

  // F-005: Lifecycle event emitter for heartbeat and notifications
  const eventEmitter = new EventEmitter();

  /**
   * Internal: Acquire lock and return result.
   * @param {string} type - Pipeline type
   * @returns {Promise<Object|null>} Lock result or null on success
   */
  async function _acquireLock(type) {
    const lockResult = await lockManager.acquireLock(type);
    if (!lockResult.ok) {
      return buildError(
        INFRA_ERROR_CODES.LOCK_ACQUISITION_FAILED,
        `Pipeline ${type} is already running`,
        {
          hint: 'Stop the current pipeline first or use forceUnlock',
          context: { currentHolder: lockResult.currentHolder }
        }
      );
    }
    return null;
  }

  /**
   * Internal: Release lock.
   * @param {string} type - Pipeline type
   */
  async function _releaseLock(type) {
    await lockManager.releaseLock(type);
  }

  return {
    // Internal methods (exposed for testing)
    _acquireLock,
    _releaseLock,

    // F-005: Lifecycle event emitter
    eventEmitter,

    // Event names
    events: {
      PIPELINE_START: 'pipeline:start',
      PIPELINE_STOP: 'pipeline:stop',
      FEATURE_COMPLETE: 'feature:complete',
      FEATURE_ERROR: 'feature:error'
    },

    /**
     * Register a lifecycle hook.
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
      eventEmitter.on(event, callback);
    },

    /**
     * Remove a lifecycle hook.
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
      eventEmitter.off(event, callback);
    },

    /**
     * Start a pipeline.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @param {string} [params.targetId] - Optional target ID to start with
     * @param {string} [params.listPath] - Optional list path
     * @param {boolean} [params.daemon=true] - Run in daemon mode
     * @param {Object} [params.envOverrides] - Environment overrides
     * @param {number} [params.timeoutMs] - Timeout in milliseconds
     * @returns {Promise<Object>} Start result
     */
    async startPipeline(params) {
      const { type = 'feature', targetId, listPath, daemon = true, envOverrides, timeoutMs } = params;

      // Acquire lock
      const lockError = await _acquireLock(type);
      if (lockError) {
        return lockError;
      }

      // Build and execute command
      const runId = generateRunId();

      try {
        const result = await scriptRunner({
          pipelineType: type,
          action: 'run',
          targetId,
          listPath,
          envOverrides,
          timeoutMs
        });

        if (!result.ok) {
          // Release lock on failure
          await _releaseLock(type);
          return buildError(
            result.errorCode || INFRA_ERROR_CODES.DAEMON_START_FAILED,
            result.stderr || 'Failed to start pipeline',
            { context: { exitCode: result.exitCode } }
          );
        }

        // F-005: Emit pipeline:start event for heartbeat pusher
        eventEmitter.emit('pipeline:start', {
          type,
          runId,
          startedAt: new Date().toISOString(),
          targetId,
          listPath
        });

        return buildResult(`Pipeline ${type} started successfully`, {
          runId,
          pid: daemon ? process.pid : undefined,
          stdout: result.stdout
        });
      } catch (error) {
        await _releaseLock(type);
        return buildError(
          INFRA_ERROR_CODES.DAEMON_START_FAILED,
          error.message,
          { hint: 'Check pipeline scripts and configuration' }
        );
      }
    },

    /**
     * Stop a pipeline.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @param {number} [params.timeoutMs=10000] - Timeout in milliseconds
     * @returns {Promise<Object>} Stop result
     */
    async stopPipeline(params) {
      const { type = 'feature', timeoutMs = DEFAULT_STOP_TIMEOUT_MS } = params;

      // Check if daemon is running
      const isRunning = await stateManager.isDaemonRunning(type);
      const previousPid = await stateManager.getDaemonPid(type);

      if (!isRunning) {
        // Already stopped
        return buildResult(`Pipeline ${type} is not running`, {
          errorCode: INFRA_ERROR_CODES.ALREADY_STOPPED,
          previousPid
        });
      }

      try {
        // Execute stop command
        const result = await scriptRunner({
          pipelineType: type,
          action: 'stop',
          timeoutMs
        });

        // Release lock
        await _releaseLock(type);

        if (!result.ok) {
          return buildError(
            result.errorCode || INFRA_ERROR_CODES.EXEC_FAILED,
            result.stderr || 'Failed to stop pipeline',
            { context: { previousPid } }
          );
        }

        // F-005: Emit pipeline:stop event for heartbeat pusher
        eventEmitter.emit('pipeline:stop', {
          type,
          stoppedAt: new Date().toISOString(),
          previousPid
        });

        return buildResult(`Pipeline ${type} stopped successfully`, {
          previousPid
        });
      } catch (error) {
        // Still release lock on error
        await _releaseLock(type);
        return buildError(
          INFRA_ERROR_CODES.EXEC_FAILED,
          error.message,
          { context: { previousPid } }
        );
      }
    },

    /**
     * Retry a target.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @param {string} params.targetId - Target ID to retry
     * @param {string} [params.listPath] - Optional list path
     * @param {boolean} [params.daemon=false] - Run in daemon mode
     * @param {Object} [params.envOverrides] - Environment overrides
     * @returns {Promise<Object>} Retry result
     */
    async retryTarget(params) {
      const { type = 'feature', targetId, listPath, daemon = false, envOverrides } = params;

      // Validate targetId
      if (!targetId || typeof targetId !== 'string' || targetId.trim() === '') {
        return buildError(
          INFRA_ERROR_CODES.INVALID_TARGET,
          'targetId is required for retry',
          { hint: 'Provide a valid target ID (e.g., F-001 or B-001)' }
        );
      }

      // For daemon mode, acquire lock
      if (daemon) {
        const lockError = await _acquireLock(type);
        if (lockError) {
          return lockError;
        }
      }

      try {
        const result = await scriptRunner({
          pipelineType: type,
          action: 'retry',
          targetId: targetId.trim(),
          listPath,
          envOverrides
        });

        if (daemon) {
          await _releaseLock(type);
        }

        if (!result.ok) {
          return buildError(
            result.errorCode || INFRA_ERROR_CODES.EXEC_FAILED,
            result.stderr || `Failed to retry target ${targetId}`,
            { context: { targetId } }
          );
        }

        return buildResult(`Target ${targetId} retry completed`, {
          targetId,
          stdout: result.stdout
        });
      } catch (error) {
        if (daemon) {
          await _releaseLock(type);
        }
        return buildError(
          INFRA_ERROR_CODES.EXEC_FAILED,
          error.message,
          { context: { targetId } }
        );
      }
    },

    /**
     * Run a single target without affecting pipeline state.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @param {string} params.targetId - Target ID to run
     * @param {string} [params.listPath] - Optional list path
     * @param {number} [params.timeoutMs] - Timeout in milliseconds
     * @param {Object} [params.envOverrides] - Environment overrides
     * @returns {Promise<Object>} Run result
     */
    async runSingle(params) {
      const { type = 'feature', targetId, listPath, timeoutMs, envOverrides } = params;

      // Validate targetId
      if (!targetId || typeof targetId !== 'string' || targetId.trim() === '') {
        return buildError(
          INFRA_ERROR_CODES.INVALID_TARGET,
          'targetId is required for runSingle',
          { hint: 'Provide a valid target ID (e.g., F-001 or B-001)' }
        );
      }

      // Note: runSingle does NOT acquire lock (independent execution per D5)

      try {
        const result = await scriptRunner({
          pipelineType: type,
          action: 'run',
          targetId: targetId.trim(),
          listPath,
          timeoutMs,
          envOverrides
        });

        return {
          ok: result.ok,
          targetId,
          message: result.ok
            ? `Target ${targetId} completed successfully`
            : `Target ${targetId} failed`,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          errorCode: result.errorCode
        };
      } catch (error) {
        return buildError(
          INFRA_ERROR_CODES.EXEC_FAILED,
          error.message,
          { context: { targetId } }
        );
      }
    },

    /**
     * Get pipeline status.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @returns {Promise<Object>} Status result
     */
    async getStatus(params) {
      const { type = 'feature' } = params;

      const isRunning = await stateManager.isDaemonRunning(type);
      const pid = await stateManager.getDaemonPid(type);
      const pipelineState = await stateManager.readPipelineState(type);
      const currentSession = await stateManager.readCurrentSession(type);
      const lastResult = await stateManager.getLastResult(type);
      const lockInfo = await lockManager.getLockInfo(type);

      const result = {
        ok: true,
        isRunning,
        pid: isRunning ? pid : undefined,
        message: isRunning
          ? `Pipeline ${type} is running`
          : `Pipeline ${type} is not running`
      };

      // Add current feature info if running
      if (isRunning && currentSession) {
        result.currentFeature = currentSession.feature_id;
        result.startedAt = currentSession.started_at;
      }

      // Add last result if not running
      if (!isRunning && lastResult) {
        result.lastResult = lastResult;
      }

      // Add lock info
      if (lockInfo) {
        result.lockInfo = lockInfo;
      }

      return result;
    },

    /**
     * Get pipeline logs.
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @param {number} [params.lines=100] - Number of lines to read
     * @returns {Promise<Object>} Logs result
     */
    async getLogs(params) {
      const { type = 'feature', lines = DEFAULT_LOG_LINES } = params;

      const logPaths = resolveDaemonLogPaths(config.projectRoot);
      const logPath = type === 'feature'
        ? logPaths.featureDaemonLog
        : logPaths.bugfixDaemonLog;

      const logs = readLastLines(logPath, lines);

      return buildResult(`Retrieved ${lines} lines from ${type} log`, {
        logs,
        logPath,
        lines
      });
    },

    /**
     * Force unlock a pipeline (admin operation).
     * @param {Object} params - Parameters
     * @param {string} params.type - Pipeline type ('feature' or 'bugfix')
     * @returns {Promise<Object>} Unlock result
     */
    async forceUnlock(params) {
      const { type = 'feature' } = params;

      const result = await lockManager.forceUnlock(type);

      return buildResult(`Lock released for ${type} pipeline`, {
        previousPid: result.previousPid
      });
    }
  };
}

// Default instance
let defaultController = null;

/**
 * Get the default pipeline controller instance.
 * @returns {Object} Pipeline controller instance
 */
export function getDefaultPipelineController() {
  if (!defaultController) {
    defaultController = createPipelineController();
  }
  return defaultController;
}

// Export convenience methods that use default controller
export async function startPipeline(params) {
  return getDefaultPipelineController().startPipeline(params);
}

export async function stopPipeline(params) {
  return getDefaultPipelineController().stopPipeline(params);
}

export async function retryTarget(params) {
  return getDefaultPipelineController().retryTarget(params);
}

export async function runSingle(params) {
  return getDefaultPipelineController().runSingle(params);
}

export async function getStatus(params) {
  return getDefaultPipelineController().getStatus(params);
}

export async function getLogs(params) {
  return getDefaultPipelineController().getLogs(params);
}

export async function forceUnlock(params) {
  return getDefaultPipelineController().forceUnlock(params);
}
