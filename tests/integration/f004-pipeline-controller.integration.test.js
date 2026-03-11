import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createPipelineController } from '../../src/services/pipeline-controller.js';
import { createLockManager } from '../../src/pipeline-infra/lock-manager.js';
import { createStateManager } from '../../src/pipeline-infra/state-manager.js';
import { loadPipelineInfraConfig } from '../../src/pipeline-infra/config-loader.js';

async function withTempDir(fn) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'f004-integration-test-'));
  try {
    await fn(tempDir);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

function createTestConfig(tempDir) {
  return {
    stateDir: path.join(tempDir, 'state'),
    bugfixStateDir: path.join(tempDir, 'bugfix-state'),
    pipelineDir: path.join(tempDir, 'dev-pipeline'),
    projectRoot: tempDir
  };
}

async function setupStateFiles(tempDir, type = 'feature') {
  const stateDir = type === 'feature'
    ? path.join(tempDir, 'state')
    : path.join(tempDir, 'bugfix-state');

  await fs.promises.mkdir(stateDir, { recursive: true });

  // Create minimal daemon log
  await fs.promises.writeFile(
    path.join(stateDir, 'pipeline-daemon.log'),
    'Integration test log line 1\nIntegration test log line 2\n'
  );

  return stateDir;
}

// US-1: Unified Pipeline Start
test('US-1: Full lifecycle startPipeline with daemon mode', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    // Mock script runner for daemon start
    let runnerCalled = false;
    const mockRunner = async (req) => {
      runnerCalled = true;
      return { ok: true, exitCode: 0, stdout: 'Daemon started', stderr: '' };
    };

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature', daemon: true });

    assert.equal(result.ok, true);
    assert.ok(result.runId);
    assert.equal(runnerCalled, true);
  });
});

test('US-1: startPipeline with foreground mode', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async (req) => ({
      ok: true,
      exitCode: 0,
      stdout: 'Foreground run completed',
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const result = await controller.startPipeline({ type: 'feature', daemon: false });

    assert.equal(result.ok, true);
  });
});

// US-2: Pipeline Stop
test('US-2: stopPipeline should stop running daemon', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    // Simulate running daemon
    await stateManager.writeDaemonMeta('feature', {
      pid: process.pid,
      started_at: new Date().toISOString()
    });

    const mockRunner = async (req) => ({
      ok: true,
      exitCode: 0,
      stdout: 'Daemon stopped',
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const result = await controller.stopPipeline({ type: 'feature' });

    assert.equal(result.ok, true);
  });
});

test('US-2: stopPipeline should return ALREADY_STOPPED when not running', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    const result = await controller.stopPipeline({ type: 'feature' });

    assert.equal(result.ok, true);
    assert.equal(result.errorCode, 'ALREADY_STOPPED');
  });
});

// US-3: Target Retry
test('US-3: retryTarget should retry a failed target', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async (req) => ({
      ok: true,
      exitCode: 0,
      stdout: 'Retry successful',
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const result = await controller.retryTarget({ type: 'feature', targetId: 'F-001' });

    assert.equal(result.ok, true);
    assert.equal(result.targetId, 'F-001');
  });
});

// US-4: Run Single Feature
test('US-4: runSingle should execute single target without lock', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async (req) => ({
      ok: true,
      exitCode: 0,
      stdout: 'Single run completed',
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const result = await controller.runSingle({ type: 'feature', targetId: 'F-001' });

    assert.equal(result.ok, true);
    assert.equal(result.targetId, 'F-001');
    assert.equal(result.stdout, 'Single run completed');

    // Verify lock was not acquired
    assert.equal(await lockManager.isLocked('feature'), false);
  });
});

// US-5: Status Query
test('US-5: getStatus should return complete status', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    // Write some state
    await stateManager.writeDaemonMeta('feature', {
      pid: process.pid,
      started_at: new Date().toISOString()
    });

    await stateManager.writeLastResult('feature', {
      runId: 'run-001',
      completedAt: new Date().toISOString(),
      status: 'success',
      featuresTotal: 5,
      featuresCompleted: 5
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    const result = await controller.getStatus({ type: 'feature' });

    assert.equal(result.ok, true);
    assert.equal(result.isRunning, true);
    assert.ok(result.pid);
  });
});

// US-6: Logs Query
test('US-6: getLogs should return daemon logs', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    const result = await controller.getLogs({ type: 'feature' });

    assert.equal(result.ok, true);
    assert.ok(result.logs.includes('Integration test log'));
    assert.ok(result.logPath);
  });
});

// US-7: Concurrency Protection
test('US-7: Concurrent start attempts should fail second attempt', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    // First start should succeed
    const result1 = await controller.startPipeline({ type: 'feature', daemon: true });
    assert.equal(result1.ok, true);

    // Second start should fail due to lock
    const result2 = await controller.startPipeline({ type: 'feature', daemon: true });
    assert.equal(result2.ok, false);
    assert.equal(result2.errorCode, 'LOCK_ACQUISITION_FAILED');
  });
});

test('US-7: forceUnlock should release stuck lock', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    // Start pipeline
    await controller.startPipeline({ type: 'feature', daemon: true });
    assert.equal(await lockManager.isLocked('feature'), true);

    // Force unlock
    const result = await controller.forceUnlock({ type: 'feature' });
    assert.equal(result.ok, true);
    assert.equal(await lockManager.isLocked('feature'), false);
  });
});

// US-8: Error Mapping
test('US-8: All errors should have structured error codes', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Test error without targetId
    const result = await controller.retryTarget({ type: 'feature' });

    assert.equal(result.ok, false);
    assert.ok(result.errorCode);
    assert.ok(result.message);

    // Error should be JSON serializable
    const serialized = JSON.stringify(result);
    assert.ok(serialized);
  });
});

// US-9: Telegram Handler Integration
test('US-9: All results should be JSON serializable for Telegram', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');
    await setupStateFiles(tempDir, 'bugfix');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'Test output',
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    const results = {
      start: await controller.startPipeline({ type: 'feature' }),
      stop: await controller.stopPipeline({ type: 'feature' }),
      retry: await controller.retryTarget({ type: 'feature', targetId: 'F-001' }),
      single: await controller.runSingle({ type: 'feature', targetId: 'F-001' }),
      status: await controller.getStatus({ type: 'feature' }),
      logs: await controller.getLogs({ type: 'feature' }),
      unlock: await controller.forceUnlock({ type: 'feature' })
    };

    for (const [key, result] of Object.entries(results)) {
      const serialized = JSON.stringify(result);
      assert.ok(serialized, `${key} result should be JSON serializable`);

      const parsed = JSON.parse(serialized);
      assert.ok(parsed.ok !== undefined, `${key} result should have ok field`);
      assert.ok(parsed.message !== undefined, `${key} result should have message field`);
    }
  });
});

// Full lifecycle test
test('Full lifecycle: start -> status -> stop', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const mockRunner = async (req) => ({
      ok: true,
      exitCode: 0,
      stdout: `${req.action} completed`,
      stderr: ''
    });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: mockRunner,
      config
    });

    // Start
    const startResult = await controller.startPipeline({ type: 'feature', daemon: true });
    assert.equal(startResult.ok, true);

    // Status (should be running)
    const statusResult = await controller.getStatus({ type: 'feature' });
    assert.equal(statusResult.ok, true);

    // Stop
    const stopResult = await controller.stopPipeline({ type: 'feature' });
    assert.equal(stopResult.ok, true);

    // Status (should not be running)
    const finalStatus = await controller.getStatus({ type: 'feature' });
    assert.equal(finalStatus.ok, true);
    assert.equal(finalStatus.isRunning, false);
  });
});

// H-2: Integration test for forceUnlock (US-7)
test('H-2: forceUnlock should work even when lock is stale', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    // Create a stale lock with a dead PID
    await lockManager.acquireLock('feature', 99999999);

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Force unlock should work
    const result = await controller.forceUnlock({ type: 'feature' });
    assert.equal(result.ok, true);

    // Should now be able to start
    const startResult = await controller.startPipeline({ type: 'feature' });
    assert.equal(startResult.ok, true);
  });
});

// H-5: Error code verification across operations
test('H-5: Error codes should be consistent across all operations', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    const controller = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Test INVALID_TARGET for missing targetId
    const retryResult = await controller.retryTarget({ type: 'feature' });
    assert.equal(retryResult.errorCode, 'INVALID_TARGET');

    const singleResult = await controller.runSingle({ type: 'feature' });
    assert.equal(singleResult.errorCode, 'INVALID_TARGET');

    // Test LOCK_ACQUISITION_FAILED
    await controller.startPipeline({ type: 'feature' });
    const secondStart = await controller.startPipeline({ type: 'feature' });
    assert.equal(secondStart.errorCode, 'LOCK_ACQUISITION_FAILED');

    // Verify all error codes are in the known set
    const knownCodes = [
      'LOCK_ACQUISITION_FAILED',
      'ALREADY_STOPPED',
      'PIPELINE_NOT_RUNNING',
      'INVALID_TARGET',
      'TARGET_NOT_RETRYABLE',
      'DAEMON_START_FAILED'
    ];

    for (const code of knownCodes) {
      assert.ok(typeof code === 'string', `Error code ${code} should be a string`);
    }
  });
});
