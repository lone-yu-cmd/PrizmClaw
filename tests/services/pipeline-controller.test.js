/**
 * Pipeline Controller Unit Tests
 * Tests for src/services/pipeline-controller.js
 *
 * F-004: Pipeline Process Controller - All User Stories
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createPipelineController } from '../../src/services/pipeline-controller.js';
import { createLockManager } from '../../src/pipeline-infra/lock-manager.js';
import { createStateManager } from '../../src/pipeline-infra/state-manager.js';

/**
 * Helper to create temp directory for test state
 */
function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-controller-test-'));
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
 * Helper to create a mock script runner
 */
function createMockScriptRunner() {
  return async (_req) => ({
    ok: true,
    exitCode: 0,
    stdout: 'Mock output',
    stderr: '',
    normalizedStatus: 'success'
  });
}

// ============================================================
// Factory Tests
// ============================================================

test('createPipelineController should be a factory function', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const controller = createPipelineController({
      config,
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: createMockScriptRunner()
    });

    assert.equal(typeof controller.startPipeline, 'function');
    assert.equal(typeof controller.stopPipeline, 'function');
    assert.equal(typeof controller.retryTarget, 'function');
    assert.equal(typeof controller.runSingle, 'function');
    assert.equal(typeof controller.getStatus, 'function');
    assert.equal(typeof controller.getLogs, 'function');
    assert.equal(typeof controller.forceUnlock, 'function');
    assert.equal(typeof controller._acquireLock, 'function');
    assert.equal(typeof controller._releaseLock, 'function');
  } finally {
    cleanup();
  }
});

test('createPipelineController should accept dependency injection', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    assert.ok(controller);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-1: startPipeline Tests
// ============================================================

test('startPipeline should acquire lock before starting daemon', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, true);

    // Lock should be held
    const isLocked = await lockManager.isLocked('feature');
    assert.equal(isLocked, true);
  } finally {
    cleanup();
  }
});

test('startPipeline should handle LOCK_ACQUISITION_FAILED error', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    // Acquire lock first
    await lockManager.acquireLock('feature', process.pid);

    // Try to start again
    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'LOCK_ACQUISITION_FAILED');
    assert.ok(result.hint);
    assert.ok(result.context);
  } finally {
    cleanup();
  }
});

test('startPipeline should support daemon mode (default)', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.ok(result.runId);
  } finally {
    cleanup();
  }
});

test('startPipeline should support targetId parameter', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    let capturedTargetId = null;
    const scriptRunner = async (req) => {
      capturedTargetId = req.targetId;
      return { ok: true, exitCode: 0, stdout: '', stderr: '' };
    };

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature', targetId: 'F-001' });
    assert.equal(result.ok, true);
    assert.equal(capturedTargetId, 'F-001');
  } finally {
    cleanup();
  }
});

test('startPipeline should work for both feature and bugfix types', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const featureResult = await controller.startPipeline({ type: 'feature' });
    assert.equal(featureResult.ok, true);

    const bugfixResult = await controller.startPipeline({ type: 'bugfix' });
    assert.equal(bugfixResult.ok, true);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-2: stopPipeline Tests
// ============================================================

test('stopPipeline should release lock after stop', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    // Start first (this acquires the lock)
    await controller.startPipeline({ type: 'feature' });
    assert.equal(await lockManager.isLocked('feature'), true);

    // Write daemon meta to simulate running daemon
    await stateManager.writeDaemonMeta('feature', {
      pid: process.pid,
      started_at: new Date().toISOString(),
      feature_list: '/path/to/list.json',
      env_overrides: '',
      log_file: '/path/to/log'
    });

    // Stop
    const result = await controller.stopPipeline({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(await lockManager.isLocked('feature'), false);
  } finally {
    cleanup();
  }
});

test('stopPipeline should return ALREADY_STOPPED if not running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    // Stop without starting
    const result = await controller.stopPipeline({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(result.errorCode, 'ALREADY_STOPPED');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-3: retryTarget Tests
// ============================================================

test('retryTarget should validate targetId is provided', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.retryTarget({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'INVALID_TARGET');
    assert.ok(result.hint);
  } finally {
    cleanup();
  }
});

test('retryTarget should support foreground mode (default)', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.retryTarget({ type: 'feature', targetId: 'F-001' });
    assert.equal(result.ok, true);
    assert.equal(result.targetId, 'F-001');

    // Should not hold lock (foreground mode)
    assert.equal(await lockManager.isLocked('feature'), false);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-4: runSingle Tests
// ============================================================

test('runSingle should NOT acquire lock', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.runSingle({ type: 'feature', targetId: 'F-001' });
    assert.equal(result.ok, true);

    // Should not hold lock
    assert.equal(await lockManager.isLocked('feature'), false);
  } finally {
    cleanup();
  }
});

test('runSingle should return full execution details', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const scriptRunner = async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'Test stdout',
      stderr: 'Test stderr',
      normalizedStatus: 'success'
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.runSingle({ type: 'feature', targetId: 'F-001' });
    assert.equal(result.ok, true);
    assert.equal(result.targetId, 'F-001');
    assert.equal(result.stdout, 'Test stdout');
    assert.equal(result.stderr, 'Test stderr');
    assert.equal(result.exitCode, 0);
  } finally {
    cleanup();
  }
});

test('runSingle should validate targetId', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.runSingle({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'INVALID_TARGET');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-5: getStatus Tests
// ============================================================

test('getStatus should return isRunning boolean', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.getStatus({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(typeof result.isRunning, 'boolean');
  } finally {
    cleanup();
  }
});

test('getStatus should return lastResult when not running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Write last result
    const lastResult = {
      runId: 'run-test',
      completedAt: new Date().toISOString(),
      status: 'success',
      featuresTotal: 8,
      featuresCompleted: 8
    };
    await stateManager.writeLastResult('feature', lastResult);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.getStatus({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.lastResult, lastResult);
  } finally {
    cleanup();
  }
});

test('getStatus should return lockInfo', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Acquire lock
    await lockManager.acquireLock('feature', 12345);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.getStatus({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.ok(result.lockInfo);
    assert.equal(result.lockInfo.pid, 12345);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-6: getLogs Tests
// ============================================================

test('getLogs should return log content', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Write log file
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), 'Line 1\nLine 2\nLine 3');

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.getLogs({ type: 'feature', lines: 10 });
    assert.equal(result.ok, true);
    assert.ok(result.logs);
    assert.ok(result.logPath);
    assert.ok(result.lines);
  } finally {
    cleanup();
  }
});

test('getLogs should handle missing log file gracefully', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.getLogs({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(result.logs, '');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-7: forceUnlock Tests
// ============================================================

test('forceUnlock should remove lock regardless of owner', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Create a lock with a different PID
    await lockManager.acquireLock('feature', 99999);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.forceUnlock({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(result.previousPid, 99999);

    // Lock should be released
    assert.equal(await lockManager.isLocked('feature'), false);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-8: Error Mapping Tests
// ============================================================

test('all methods should return JSON-serializable results', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const results = await Promise.all([
      controller.startPipeline({ type: 'feature' }),
      controller.getStatus({ type: 'feature' }),
      controller.getLogs({ type: 'feature' })
    ]);

    for (const result of results) {
      assert.doesNotThrow(() => JSON.stringify(result));
    }
  } finally {
    cleanup();
  }
});

test('errors should include hint field', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Lock first
    await lockManager.acquireLock('feature', process.pid);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.ok(result.hint);
  } finally {
    cleanup();
  }
});

test('errors should include context field', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });
    const scriptRunner = createMockScriptRunner();

    // Lock first
    await lockManager.acquireLock('feature', process.pid);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.ok(result.context);
  } finally {
    cleanup();
  }
});
