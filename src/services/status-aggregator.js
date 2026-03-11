/**
 * Status Aggregator Service
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-1: Aggregated Status Query
 *
 * Aggregates multiple state sources to generate structured status reports.
 *
 * Design Decisions:
 * - D1: Independent service, not extending pipeline-controller (single responsibility)
 * - D5: Real-time error extraction from logs, no additional storage
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';
import { getStatePaths } from '../pipeline-infra/path-policy.js';
import { getDefaultStateManager } from '../pipeline-infra/state-manager.js';

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
 * Safely read and parse a JSON file with error handling.
 * @param {string} filePath - File path
 * @returns {Object | null} Parsed JSON or null if file doesn't exist or is corrupted
 */
function readJsonFileSafe(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Create a status aggregator instance.
 * @param {Object} options - Options
 * @param {Object} [options.stateManager] - State manager instance
 * @param {Object} [options.pipelineController] - Pipeline controller instance
 * @param {Object} [options.config] - Pipeline config
 * @returns {Object} Status aggregator interface
 */
export function createStatusAggregator(options = {}) {
  const config = options.config || loadPipelineInfraConfig();
  const stateManager = options.stateManager || getDefaultStateManager();

  /**
   * Read daemon meta for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {Promise<Object | null>} Daemon meta or null
   */
  async function _readDaemonMeta(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return readJsonFileSafe(paths.daemonMetaFile);
  }

  /**
   * Read pipeline state for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {Promise<Object | null>} Pipeline state or null
   */
  async function _readPipelineState(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return readJsonFileSafe(paths.pipelineStateFile);
  }

  /**
   * Read current session for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {Promise<Object | null>} Current session or null
   */
  async function _readCurrentSession(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return readJsonFileSafe(paths.currentSessionFile);
  }

  /**
   * Read last result for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {Promise<Object | null>} Last result or null
   */
  async function _readLastResult(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return readJsonFileSafe(paths.lastResultFile);
  }

  /**
   * Determine pipeline stage based on state and daemon meta.
   * @param {Object | null} pipelineState - Pipeline state
   * @param {Object | null} daemonMeta - Daemon meta
   * @returns {Promise<'running' | 'paused' | 'completed' | 'failed' | 'idle'>}
   */
  async function determinePipelineStage(pipelineState, daemonMeta) {
    // Check if daemon is alive
    if (daemonMeta && daemonMeta.pid && isProcessAlive(daemonMeta.pid)) {
      return 'running';
    }

    // Check pipeline state for paused/completed/failed
    if (pipelineState) {
      if (pipelineState.status === 'paused') {
        return 'paused';
      }
      if (pipelineState.status === 'completed') {
        return 'completed';
      }
      if (pipelineState.status === 'failed') {
        return 'failed';
      }
    }

    return 'idle';
  }

  /**
   * Calculate progress from pipeline state.
   * @param {Object | null} state - Pipeline state
   * @returns {Object} Progress object
   */
  function calculateProgress(state) {
    if (!state) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        successRate: 0
      };
    }

    const total = state.total_features || 0;
    const completed = state.completed_features || 0;
    const failed = state.failed_features || 0;
    const inProgress = state.in_progress_features || 0;

    // Calculate success rate (completed / total attempts, excluding in-progress)
    const attempts = completed + failed;
    const successRate = attempts > 0 ? Math.round((completed / attempts) * 100) : 0;

    return {
      total,
      completed,
      failed,
      inProgress,
      successRate
    };
  }

  /**
   * Get error summary from last result.
   * @param {Object | null} lastResult - Last result
   * @returns {Array} Array of error objects
   */
  function getErrorSummary(lastResult) {
    if (!lastResult || lastResult.status === 'success') {
      return [];
    }

    // Extract errors from last result if available
    if (lastResult.errors && Array.isArray(lastResult.errors)) {
      return lastResult.errors.map(err => ({
        featureId: err.featureId || 'unknown',
        errorType: err.errorType || 'unknown',
        message: err.message || 'No message'
      }));
    }

    return [];
  }

  /**
   * Aggregate status from all state sources.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {Promise<Object>} Aggregated status
   */
  async function aggregateStatus(type) {
    const timestamp = new Date().toISOString();

    // Read all state sources
    const daemonMeta = await _readDaemonMeta(type);
    const pipelineState = await _readPipelineState(type);
    const currentSession = await _readCurrentSession(type);
    const lastResult = await _readLastResult(type);

    // Determine stage
    const stage = await determinePipelineStage(pipelineState, daemonMeta);

    // Build status object
    const status = {
      stage,
      type,
      timestamp,
      progress: calculateProgress(pipelineState)
    };

    // Add current execution info if running
    if (stage === 'running' && currentSession) {
      const startedAt = new Date(currentSession.started_at);
      status.current = {
        featureId: currentSession.feature_id,
        startedAt: currentSession.started_at,
        duration: Math.floor((Date.now() - startedAt.getTime()) / 1000)
      };
    }

    // Add daemon info if running
    if (stage === 'running' && daemonMeta) {
      const daemonStartedAt = new Date(daemonMeta.started_at);
      status.daemon = {
        pid: daemonMeta.pid,
        startedAt: daemonMeta.started_at,
        uptime: Math.floor((Date.now() - daemonStartedAt.getTime()) / 1000)
      };
    }

    // Add last result if not running
    if (stage === 'idle' && lastResult) {
      status.lastResult = {
        runId: lastResult.runId,
        completedAt: lastResult.completedAt,
        status: lastResult.status,
        summary: lastResult.message || `Completed ${lastResult.featuresCompleted}/${lastResult.featuresTotal}`
      };
    }

    // Add errors if failed
    if (stage === 'failed' || (lastResult && lastResult.status === 'failed')) {
      status.errors = getErrorSummary(lastResult);
    }

    return status;
  }

  /**
   * Format status for Telegram display.
   * @param {Object} status - Aggregated status
   * @returns {string} Formatted message
   */
  function formatStatusForTelegram(status) {
    const lines = [];
    const stageEmojis = {
      running: '🔄',
      paused: '⏸️',
      completed: '✅',
      failed: '❌',
      idle: '💤'
    };

    const emoji = stageEmojis[status.stage] || '📦';
    const stageText = {
      running: '运行中',
      paused: '已暂停',
      completed: '已完成',
      failed: '失败',
      idle: '空闲'
    };

    lines.push(`${emoji} **Pipeline 状态** (${status.type})`);
    lines.push(`阶段: ${stageText[status.stage] || status.stage}`);
    lines.push('');

    // Progress info
    const p = status.progress;
    if (p.total > 0) {
      lines.push(`📊 进度: ${p.completed}/${p.total} (${p.successRate}% 成功率)`);
      if (p.failed > 0) {
        lines.push(`   ❌ 失败: ${p.failed}`);
      }
      if (p.inProgress > 0) {
        lines.push(`   🔄 进行中: ${p.inProgress}`);
      }
    }

    // Current execution
    if (status.current) {
      lines.push('');
      lines.push(`🎯 当前目标: ${status.current.featureId}`);
      lines.push(`   开始时间: ${status.current.startedAt}`);
      lines.push(`   执行时长: ${formatDuration(status.current.duration)}`);
    }

    // Daemon info
    if (status.daemon) {
      lines.push('');
      lines.push(`🤖 Daemon PID: ${status.daemon.pid}`);
      lines.push(`   运行时长: ${formatDuration(status.daemon.uptime)}`);
    }

    // Last result
    if (status.lastResult && status.stage === 'idle') {
      lines.push('');
      lines.push(`📋 最后运行: ${status.lastResult.runId}`);
      lines.push(`   状态: ${status.lastResult.status}`);
      lines.push(`   完成时间: ${status.lastResult.completedAt}`);
    }

    // Errors
    if (status.errors && status.errors.length > 0) {
      lines.push('');
      lines.push(`⚠️ 错误摘要:`);
      for (const err of status.errors.slice(0, 3)) {
        lines.push(`   • ${err.featureId}: ${err.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format duration in human-readable form.
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  function formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return {
    aggregateStatus,
    formatStatusForTelegram,
    calculateProgress,
    getErrorSummary,
    determinePipelineStage,
    _readDaemonMeta
  };
}

export default createStatusAggregator;
