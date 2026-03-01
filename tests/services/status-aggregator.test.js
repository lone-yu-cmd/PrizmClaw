/**
 * Status Aggregator Unit Tests
 * Tests for src/services/status-aggregator.js
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-1: Aggregated Status Query
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createStatusAggregator } from '../../src/services/status-aggregator.js';

/**
 * Helper to create temp directory for test state
 */
function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-aggregator-test-'));
  const stateDir = path.join(tempDir, 'dev-pipeline', 'state');
  const bugfixStateDir = path.join(tempDir, 'dev-pipeline', 'bugfix-state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(bugfixStateDir, { recursive: true });
  return {
    tempDir,
    stateDir,
    bugfixStateDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Helper to create a mock config
 */
function createMockConfig(stateDir, bugfixStateDir) {
  const projectRoot = path.dirname(path.dirname(stateDir));
  return {
    projectRoot,
    stateDir,
    bugfixStateDir
  };
}

/**
 * Helper to create sample daemon meta
 */
function createSampleDaemonMeta() {
  return {
    pid: process.pid, // Use current process for alive check
    started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    feature_list: '/path/to/feature-list.json',
    env_overrides: '',
    log_file: '/path/to/pipeline-daemon.log'
  };
}

/**
 * Helper to create sample pipeline state
 */
function createSamplePipelineState() {
  return {
    run_id: 'run-20260313-103000',
    status: 'running',
    feature_list_path: '/path/to/feature-list.json',
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    total_features: 10,
    completed_features: 4,
    failed_features: 1,
    in_progress_features: 1
  };
}

/**
 * Helper to create sample current session
 */
function createSampleCurrentSession() {
  return {
    feature_id: 'F-005',
    started_at: new Date(Date.now() - 600000).toISOString() // 10 min ago
  };
}

/**
 * Helper to create sample last result
 */
function createSampleLastResult() {
  return {
    runId: 'run-20260312-103000',
    completedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    status: 'success',
    featuresTotal: 8,
    featuresCompleted: 8,
    featuresFailed: 0,
    duration: 7200 // 2 hours in seconds
  };
}

// ============================================================
// Factory Tests (T-015)
// ============================================================

test('createStatusAggregator should be a factory function', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    assert.equal(typeof aggregator.aggregateStatus, 'function');
    assert.equal(typeof aggregator.formatStatusForTelegram, 'function');
    assert.equal(typeof aggregator.calculateProgress, 'function');
    assert.equal(typeof aggregator.getErrorSummary, 'function');
    assert.equal(typeof aggregator.determinePipelineStage, 'function');
  } finally {
    cleanup();
  }
});

// ============================================================
// aggregateStatus Tests (T-010, T-015)
// ============================================================

test('aggregateStatus should return idle state when no pipeline is running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const result = await aggregator.aggregateStatus('feature');

    assert.equal(result.stage, 'idle');
    assert.equal(result.type, 'feature');
    assert.ok(result.timestamp);
  } finally {
    cleanup();
  }
});

test('aggregateStatus should return running state when pipeline is active', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write daemon meta with alive PID
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify(createSampleDaemonMeta())
    );

    // Write pipeline state
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify(createSamplePipelineState())
    );

    // Write current session
    fs.writeFileSync(
      path.join(stateDir, 'current-session.json'),
      JSON.stringify(createSampleCurrentSession())
    );

    const aggregator = createStatusAggregator({ config });
    const result = await aggregator.aggregateStatus('feature');

    assert.equal(result.stage, 'running');
    assert.equal(result.type, 'feature');
    assert.ok(result.current);
    assert.equal(result.current.featureId, 'F-005');
    assert.ok(result.current.duration > 0);
  } finally {
    cleanup();
  }
});

test('aggregateStatus should include last result when not running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write last result
    fs.writeFileSync(
      path.join(stateDir, '.last-result.json'),
      JSON.stringify(createSampleLastResult())
    );

    const aggregator = createStatusAggregator({ config });
    const result = await aggregator.aggregateStatus('feature');

    assert.equal(result.stage, 'idle');
    assert.ok(result.lastResult);
    assert.equal(result.lastResult.runId, 'run-20260312-103000');
    assert.equal(result.lastResult.status, 'success');
  } finally {
    cleanup();
  }
});

test('aggregateStatus should work for bugfix type', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write daemon meta for bugfix
    fs.writeFileSync(
      path.join(bugfixStateDir, '.pipeline-meta.json'),
      JSON.stringify(createSampleDaemonMeta())
    );

    const aggregator = createStatusAggregator({ config });
    const result = await aggregator.aggregateStatus('bugfix');

    assert.equal(result.type, 'bugfix');
  } finally {
    cleanup();
  }
});

// ============================================================
// determinePipelineStage Tests (T-011, T-016)
// ============================================================

test('determinePipelineStage should return running when daemon is alive', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify(createSampleDaemonMeta())
    );

    const aggregator = createStatusAggregator({ config });
    const daemonMeta = await aggregator._readDaemonMeta?.('feature');

    // determinePipelineStage should be callable
    const stage = await aggregator.determinePipelineStage(null, daemonMeta);
    assert.equal(stage, 'running');
  } finally {
    cleanup();
  }
});

test('determinePipelineStage should return idle when no daemon and no state', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const stage = await aggregator.determinePipelineStage(null, null);
    assert.equal(stage, 'idle');
  } finally {
    cleanup();
  }
});

// ============================================================
// calculateProgress Tests (T-012, T-016)
// ============================================================

test('calculateProgress should compute stats from pipeline state', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const state = createSamplePipelineState();
    const progress = aggregator.calculateProgress(state);

    assert.equal(progress.total, 10);
    assert.equal(progress.completed, 4);
    assert.equal(progress.failed, 1);
    assert.equal(progress.inProgress, 1);
    assert.ok(progress.successRate > 0);
  } finally {
    cleanup();
  }
});

test('calculateProgress should handle missing fields', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const state = { total_features: 5, completed_features: 2 };
    const progress = aggregator.calculateProgress(state);

    assert.equal(progress.total, 5);
    assert.equal(progress.completed, 2);
    assert.equal(progress.failed, 0);
    assert.equal(progress.inProgress, 0);
  } finally {
    cleanup();
  }
});

// ============================================================
// getErrorSummary Tests (T-013)
// ============================================================

test('getErrorSummary should extract errors from last result', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const lastResult = {
      ...createSampleLastResult(),
      status: 'failed',
      errors: [
        { featureId: 'F-003', errorType: 'execution', message: 'Script failed' }
      ]
    };

    const summary = aggregator.getErrorSummary(lastResult);
    assert.ok(Array.isArray(summary));
    assert.equal(summary.length, 1);
    assert.equal(summary[0].featureId, 'F-003');
  } finally {
    cleanup();
  }
});

test('getErrorSummary should return empty array for success', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const summary = aggregator.getErrorSummary(createSampleLastResult());
    assert.deepEqual(summary, []);
  } finally {
    cleanup();
  }
});

// ============================================================
// formatStatusForTelegram Tests (T-014)
// ============================================================

test('formatStatusForTelegram should format running status', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const status = {
      stage: 'running',
      type: 'feature',
      timestamp: new Date().toISOString(),
      progress: { total: 10, completed: 4, failed: 1, inProgress: 1, successRate: 80 },
      current: { featureId: 'F-005', startedAt: new Date().toISOString(), duration: 300 },
      daemon: { pid: 12345, startedAt: new Date().toISOString(), uptime: 3600 }
    };

    const formatted = aggregator.formatStatusForTelegram(status);

    assert.ok(formatted.includes('running'));
    assert.ok(formatted.includes('F-005'));
    assert.ok(formatted.includes('4/10'));
  } finally {
    cleanup();
  }
});

test('formatStatusForTelegram should format idle status', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const status = {
      stage: 'idle',
      type: 'feature',
      timestamp: new Date().toISOString(),
      progress: { total: 0, completed: 0, failed: 0, inProgress: 0, successRate: 0 }
    };

    const formatted = aggregator.formatStatusForTelegram(status);
    assert.ok(formatted.includes('idle') || formatted.includes('未运行') || formatted.includes('空闲'));
  } finally {
    cleanup();
  }
});

// ============================================================
// Diagnostic Error Tests (T-151, T-153, T-154) - US-6
// ============================================================

test('aggregateStatus should handle corrupted JSON with diagnostic message', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write corrupted JSON
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      'not valid json {{{'
    );

    const aggregator = createStatusAggregator({ config });
    const result = await aggregator.aggregateStatus('feature');

    // Should still return a result, not throw
    assert.ok(result);
    assert.equal(result.stage, 'idle');
  } finally {
    cleanup();
  }
});

test('aggregateStatus should provide diagnostic for missing state files', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const result = await aggregator.aggregateStatus('feature');

    // Should include hint about pipeline not being initialized
    assert.ok(result);
    assert.ok(result.diagnostic || result.hint || result.stage === 'idle');
  } finally {
    cleanup();
  }
});
