/**
 * F-011: AI CLI Service
 *
 * Encapsulates AI CLI execution logic with process tracking,
 * heartbeat, and interrupt support.
 *
 * T-051: Metrics tracking for monitoring
 */

import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { sessionStore } from './session-store.js';
import { backendRegistry as defaultBackendRegistry } from './backend-registry.js';
import { createHeartbeatManager } from '../utils/heartbeat-manager.js';

// Allow dependency injection for testing
let backendRegistry = defaultBackendRegistry;

/**
 * Set backend registry for testing purposes.
 * @param {Object} registry - Backend registry instance
 */
export function setBackendRegistry(registry) {
  backendRegistry = registry;
}

/**
 * Metrics for AI CLI execution monitoring.
 * T-051: Track execution statistics
 */
const metrics = {
  // Execution counts
  totalExecutions: 0,
  successCount: 0,
  failureCount: 0,
  timeoutCount: 0,
  interruptCount: 0,

  // Duration tracking (for histogram)
  durations: [],
  maxDurations: 100, // Keep last 100 durations

  // Output size tracking
  outputSizes: [],
  maxOutputSizes: 100
};

/**
 * Get current metrics snapshot.
 * @returns {Object} Metrics snapshot
 */
export function getMetrics() {
  const durations = [...metrics.durations];
  const outputSizes = [...metrics.outputSizes];

  return {
    totalExecutions: metrics.totalExecutions,
    successCount: metrics.successCount,
    failureCount: metrics.failureCount,
    timeoutCount: metrics.timeoutCount,
    interruptCount: metrics.interruptCount,
    averageDurationMs: durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    averageOutputBytes: outputSizes.length > 0
      ? Math.round(outputSizes.reduce((a, b) => a + b, 0) / outputSizes.length)
      : 0
  };
}

/**
 * Record execution metrics.
 * @param {Object} result - Execution result
 * @param {number} result.elapsedMs - Execution duration
 * @param {number} result.stdoutBytes - Output size
 * @param {boolean} result.success - Whether execution succeeded
 * @param {boolean} result.timedOut - Whether execution timed out
 * @param {boolean} result.interrupted - Whether execution was interrupted
 */
function recordMetrics(result) {
  metrics.totalExecutions++;

  // Track duration
  metrics.durations.push(result.elapsedMs);
  if (metrics.durations.length > metrics.maxDurations) {
    metrics.durations.shift();
  }

  // Track output size
  metrics.outputSizes.push(result.stdoutBytes || 0);
  if (metrics.outputSizes.length > metrics.maxOutputSizes) {
    metrics.outputSizes.shift();
  }

  // Track outcome
  if (result.interrupted) {
    metrics.interruptCount++;
  } else if (result.timedOut) {
    metrics.timeoutCount++;
  } else if (result.success) {
    metrics.successCount++;
  } else {
    metrics.failureCount++;
  }

  // Log metrics at debug level
  logger.debug(
    {
      totalExecutions: metrics.totalExecutions,
      successRate: `${Math.round((metrics.successCount / metrics.totalExecutions) * 100)}%`,
      interruptRate: `${Math.round((metrics.interruptCount / metrics.totalExecutions) * 100)}%`,
      timeoutRate: `${Math.round((metrics.timeoutCount / metrics.totalExecutions) * 100)}%`
    },
    'AI CLI metrics updated'
  );
}

/**
 * Reset metrics (useful for testing).
 */
export function resetMetrics() {
  metrics.totalExecutions = 0;
  metrics.successCount = 0;
  metrics.failureCount = 0;
  metrics.timeoutCount = 0;
  metrics.interruptCount = 0;
  metrics.durations = [];
  metrics.outputSizes = [];
}

/**
 * @typedef {Object} AiCliExecutionOptions
 * @property {string} sessionId - Session identifier
 * @property {string} prompt - User prompt/input
 * @property {string} [userId] - User ID who initiated the task (for permission checks)
 * @property {Object} [hooks] - Callback hooks
 * @property {Function} [hooks.onChunk] - Stream chunk callback (text: string) => void
 * @property {Function} [hooks.onHeartbeat] - Heartbeat callback (info: HeartbeatInfo) => void
 * @property {Function} [hooks.onStatus] - Status change callback (status: string) => void
 * @property {AbortSignal} [signal] - Optional abort signal
 * @property {number} [timeoutMs] - Optional timeout override
 * @property {number} [heartbeatThresholdMs] - Heartbeat threshold override
 * @property {number} [heartbeatIntervalMs] - Heartbeat interval override
 * @property {string} [bin] - Optional binary override (for testing)
 * @property {string[]} [args] - Optional args override (for testing, replaces default args)
 */

/**
 * @typedef {Object} AiCliExecutionResult
 * @property {string} output - Final output text
 * @property {boolean} timedOut - Whether execution timed out
 * @property {boolean} interrupted - Whether execution was interrupted
 * @property {number} elapsedMs - Execution time in milliseconds
 * @property {number|null} exitCode - Process exit code (if completed)
 * @property {string} stderr - Error output if any
 */

/**
 * @typedef {Object} HeartbeatInfo
 * @property {number} elapsedMs - Elapsed time in milliseconds
 * @property {number} stdoutBytes - Bytes received so far
 * @property {string} status - Current status ('running', 'streaming')
 */

/**
 * Write text to echo output for debugging.
 * @param {string} tag - Tag for the output
 * @param {string} text - Text to write
 */
function writeEcho(tag, text) {
  const normalized = String(text ?? '');
  if (!normalized) {
    return;
  }

  const lines = normalized.split(/\r?\n/);
  for (const line of lines) {
    if (!line) {
      continue;
    }
    process.stdout.write(`[CodeBuddy:${tag}] ${line}\n`);
  }
}

/**
 * Execute AI CLI with session context and process tracking.
 * @param {AiCliExecutionOptions} options
 * @returns {Promise<AiCliExecutionResult>}
 */
export async function executeAiCli(options) {
  const {
    sessionId,
    prompt,
    userId,
    hooks = {},
    signal,
    timeoutMs,
    heartbeatThresholdMs,
    heartbeatIntervalMs,
    bin,
    args: customArgs
  } = options;

  // Get session-specific backend or use default
  const sessionBackendName = sessionStore.getCurrentBackend(sessionId);
  const sessionBackend = sessionBackendName ? backendRegistry.getBackend(sessionBackendName) : null;
  const effectiveBin = bin || (sessionBackend?.binPath) || config.codebuddyBin;
  const effectiveTimeoutMs = timeoutMs ?? config.requestTimeoutMs;
  const effectiveHeartbeatThresholdMs = heartbeatThresholdMs ?? config.aiCliHeartbeatThresholdMs;
  const effectiveHeartbeatIntervalMs = heartbeatIntervalMs ?? config.aiCliHeartbeatIntervalMs;
  const enableHeartbeat = config.aiCliEnableHeartbeat;

  // Validate backend binary exists if using session backend
  if (sessionBackendName && !backendRegistry.validateBackend(sessionBackendName)) {
    const defaultBackend = backendRegistry.getDefaultBackend();
    const fallbackBin = defaultBackend?.binPath || config.codebuddyBin;

    logger.warn(`Backend "${sessionBackendName}" not accessible, falling back to default`);

    // Reset to default backend for this session
    sessionStore.resetBackend(sessionId);

    return {
      output: `⚠️ 后端 "${sessionBackendName}" 不可用，已切换回默认后端。\n建议：检查后端配置或使用 /cli reset 重置。`,
      timedOut: false,
      interrupted: false,
      elapsedMs: 0,
      exitCode: null,
      stderr: ''
    };
  }

  // Use custom args if provided (for testing), otherwise build default args
  const args = customArgs ?? (() => {
    const defaultArgs = ['-p', prompt];
    // Use session backend's permission flag if available, otherwise fallback to config
    const permissionFlag = sessionBackend?.permissionFlag || config.codebuddyPermissionFlag;
    if (permissionFlag) {
      defaultArgs.push(permissionFlag);
    }
    return defaultArgs;
  })();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let interrupted = false;
    let timedOut = false;
    const startedAt = Date.now();
    const sessionKey = sessionId;

    // Heartbeat manager
    const heartbeatManager = createHeartbeatManager();

    // Spawn process
    let child;
    try {
      const spawnCwd = sessionStore.getCwd(sessionId) || process.cwd();
      child = spawn(effectiveBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: spawnCwd
      });
    } catch (err) {
      resolve({
        output: `无法启动 AI CLI: ${err.message}\n建议：检查 CODEBUDDY_BIN 配置是否正确。`,
        timedOut: false,
        interrupted: false,
        elapsedMs: Date.now() - startedAt,
        exitCode: null,
        stderr: ''
      });
      return;
    }

    // Track process in session store
    sessionStore.setActiveProcess(sessionKey, {
      pid: child.pid,
      startedAt,
      childProcess: child,
      interrupted: false,
      timedOut: false,
      userId
    });

    logger.info({
    pid: child.pid,
    bin: effectiveBin,
    backend: sessionBackendName || 'default',
    args,
    sessionId
  }, 'AI CLI process started');

    // Handle process error
    child.on('error', (err) => {
      cleanup();
      resolve({
        output: `无法启动 AI CLI: ${err.message}\n建议：检查 CODEBUDDY_BIN 配置是否正确。`,
        timedOut: false,
        interrupted: false,
        elapsedMs: Date.now() - startedAt,
        exitCode: null,
        stderr
      });
    });

    // Handle stdout
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBytes += Buffer.byteLength(text);

      // Update session store byte count
      sessionStore.updateProcessBytes(sessionKey, Buffer.byteLength(text));

      // Echo to console if enabled
      if (config.codebuddyEchoStdio) {
        writeEcho('stdout', text);
      }

      // Call onChunk hook
      if (typeof hooks.onChunk === 'function') {
        hooks.onChunk(text);
      }
    });

    // Handle stderr
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;

      if (config.codebuddyEchoStdio) {
        writeEcho('stderr', text);
      }
    });

    // Timeout handler
    const timeout = effectiveTimeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          const info = sessionStore.getActiveProcess(sessionKey);
          if (info) {
            info.timedOut = true;
          }
          child.kill('SIGTERM');

          // Schedule SIGKILL if process doesn't exit
          setTimeout(() => {
            if (sessionStore.getActiveProcess(sessionKey)) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }, effectiveTimeoutMs)
      : null;

    // Abort signal handler
    const onAbort = () => {
      interrupted = true;
      const info = sessionStore.getActiveProcess(sessionKey);
      if (info) {
        info.interrupted = true;
      }
      child.kill('SIGTERM');

      // Schedule SIGKILL if process doesn't exit
      setTimeout(() => {
        if (sessionStore.getActiveProcess(sessionKey)) {
          child.kill('SIGKILL');
        }
      }, 5000);
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    // Heartbeat setup
    if (enableHeartbeat && typeof hooks.onHeartbeat === 'function') {
      heartbeatManager.start({
        callback: () => {
          const elapsedMs = Date.now() - startedAt;
          hooks.onHeartbeat({
            elapsedMs,
            stdoutBytes,
            status: 'running'
          });
        },
        intervalMs: effectiveHeartbeatIntervalMs,
        thresholdMs: effectiveHeartbeatThresholdMs
      });
    }

    // Cleanup function
    function cleanup() {
      if (timeout) {
        clearTimeout(timeout);
      }
      heartbeatManager.stop();
      sessionStore.clearActiveProcess(sessionKey);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }

    // Handle process close
    child.on('close', (code) => {
      const elapsedMs = Date.now() - startedAt;

      // Check interrupted/timedOut flags from session store (may be set by interruptAiCli)
      const storedInfo = sessionStore.getActiveProcess(sessionKey);
      if (storedInfo) {
        if (storedInfo.interrupted) {
          interrupted = true;
        }
        if (storedInfo.timedOut) {
          timedOut = true;
        }
      }

      cleanup();

      logger.info(
        { pid: child.pid, code, elapsedSec: Math.floor(elapsedMs / 1000), sessionId },
        'AI CLI process closed'
      );

      // Build output
      let output = stdout.trim();

      if (interrupted) {
        output = output || '任务已被用户中断。';
      } else if (timedOut) {
        output = output || `任务执行超时（>${effectiveTimeoutMs}ms）。\n建议：使用 /stop 中断或增加 REQUEST_TIMEOUT_MS 配置。`;
      } else if (code !== 0) {
        output = output || `AI CLI 退出码 ${code}。`;
        if (stderr.trim()) {
          output += `\n错误信息:\n${stderr.trim()}`;
        }
      }

      // Record metrics (T-051)
      recordMetrics({
        elapsedMs,
        stdoutBytes,
        success: code === 0 && !interrupted && !timedOut,
        timedOut,
        interrupted
      });

      resolve({
        output: output || 'AI CLI 未返回文本结果。',
        timedOut,
        interrupted,
        elapsedMs,
        exitCode: code,
        stderr: stderr.trim()
      });
    });
  });
}

/**
 * Interrupt running AI CLI task for a session.
 * @param {string} sessionId - Session identifier
 * @returns {{ ok: boolean, pid?: number, error?: string }}
 */
export function interruptAiCli(sessionId) {
  const processInfo = sessionStore.getActiveProcess(sessionId);

  if (!processInfo) {
    return { ok: false, error: '没有正在执行的任务。' };
  }

  const { pid, childProcess } = processInfo;

  try {
    // Mark as interrupted so close handler knows
    processInfo.interrupted = true;

    // Send SIGTERM first
    childProcess.kill('SIGTERM');

    // Schedule SIGKILL as backup
    setTimeout(() => {
      const stillRunning = sessionStore.getActiveProcess(sessionId);
      if (stillRunning) {
        try {
          childProcess.kill('SIGKILL');
        } catch {
          // Process already dead
        }
      }
    }, 5000);

    logger.info({ pid, sessionId }, 'AI CLI process interrupted');

    return { ok: true, pid };
  } catch (err) {
    return { ok: false, error: `中断失败: ${err.message}` };
  }
}

/**
 * Check if AI CLI is running for a session.
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isAiCliRunning(sessionId) {
  return sessionStore.getActiveProcess(sessionId) !== null;
}

/**
 * Get active process info for a session.
 * @param {string} sessionId
 * @returns {{ pid: number, startedAt: number, stdoutBytes: number, userId?: string } | null}
 */
export function getActiveProcessInfo(sessionId) {
  const info = sessionStore.getActiveProcess(sessionId);
  if (!info) {
    return null;
  }

  // Don't expose childProcess to external callers
  return {
    pid: info.pid,
    startedAt: info.startedAt,
    stdoutBytes: info.stdoutBytes ?? 0,
    userId: info.userId
  };
}

/**
 * Kill active AI CLI process and restart in the current session cwd.
 * Used by /cd handler when directory changes while AI CLI is running.
 * @param {string} sessionId - Session identifier
 * @param {Object} [hooks] - Optional hooks to forward to executeAiCli
 * @returns {Promise<{ ok: boolean, oldPid?: number, error?: string }>}
 */
export async function restartAiCli(sessionId, hooks = {}) {
  const processInfo = sessionStore.getActiveProcess(sessionId);
  if (!processInfo) {
    return { ok: false, error: '没有正在执行的任务。' };
  }

  const oldPid = processInfo.pid;

  // Kill the active process
  const killResult = interruptAiCli(sessionId);
  if (!killResult.ok) {
    return { ok: false, error: killResult.error };
  }

  // Wait for process to exit (poll up to 10s)
  const maxWait = 10000;
  const pollInterval = 100;
  let waited = 0;
  while (isAiCliRunning(sessionId) && waited < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    waited += pollInterval;
  }

  if (isAiCliRunning(sessionId)) {
    return { ok: false, oldPid, error: 'AI CLI 进程未能在超时时间内退出。' };
  }

  // Restart AI CLI in the new cwd with a lightweight system prompt
  const newCwd = sessionStore.getCwd(sessionId) || process.cwd();
  executeAiCli({
    sessionId,
    prompt: `工作目录已切换至 ${newCwd}，会话已恢复。`,
    hooks
  }).catch((err) => {
    logger.error({ err, sessionId }, 'AI CLI restart failed');
  });

  return { ok: true, oldPid };
}

/**
 * Check if user can interrupt AI CLI task.
 * @param {string} sessionId - Session identifier
 * @param {string|number} requestUserId - User requesting interrupt
 * @param {Function} isAdminFn - Function to check if user is admin
 * @returns {{ canInterrupt: boolean, reason?: string }}
 */
export function canInterruptAiCli(sessionId, requestUserId, isAdminFn) {
  const processInfo = sessionStore.getActiveProcess(sessionId);

  if (!processInfo) {
    return { canInterrupt: false, reason: '没有正在执行的任务。' };
  }

  // Admin can always interrupt
  if (isAdminFn && isAdminFn(requestUserId)) {
    return { canInterrupt: true };
  }

  // Task owner can interrupt
  const taskUserId = processInfo.userId;
  if (taskUserId && String(taskUserId) === String(requestUserId)) {
    return { canInterrupt: true };
  }

  // Otherwise, permission denied
  return {
    canInterrupt: false,
    reason: '权限不足。只有任务发起者或管理员可以中断任务。'
  };
}
