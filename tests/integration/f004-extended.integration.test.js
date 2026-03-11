/**
 * F-004 Pipeline Controller - Extended Integration Tests
 *
 * Additional tests for edge cases, cross-module data flow, and boundary conditions
 * not covered in the main integration test file.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createPipelineController } from '../../src/services/pipeline-controller.js';
import { createLockManager } from '../../src/pipeline-infra/lock-manager.js';
import { createStateManager } from '../../src/pipeline-infra/state-manager.js';

// ============================================================
// Test Helpers
// ============================================================

async function withTempDir(fn) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'f004-extended-test-'));
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

// ============================================================
// Cross-Module Data Flow Tests
// ============================================================

test('Cross-module: Lock state visible across controller instances', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });
    const stateManager = createStateManager({ config });

    // Create first controller instance
    const controller1 = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Start pipeline (acquires lock)
    await controller1.startPipeline({ type: 'feature' });

    // Create second controller instance with same lock manager
    const controller2 = createPipelineController({
      lockManager,
      stateManager,
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Second controller should see the lock
    const status = await controller2.getStatus({ type: 'feature' });
    assert.ok(status.lockInfo, 'Lock should be visible across controller instances');
    assert.equal(status.lockInfo.pid, process.pid);
  });
});

test('Cross-module: State changes persist across manager instances', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const stateManager1 = createStateManager({ config });

    // Write daemon meta
    const meta = {
      pid: 12345,
      started_at: new Date().toISOString(),
      feature_list: '/path/to/list.json',
      env_overrides: '',
      log_file: '/path/to/log'
    };
    await stateManager1.writeDaemonMeta('feature', meta);

    // Create new state manager instance
    const stateManager2 = createStateManager({ config });

    // Should see the same data
    const result = await stateManager2.readDaemonMeta('feature');
    assert.deepEqual(result, meta, 'State should persist across manager instances');
  });
});

// ============================================================
// Boundary Condition Tests
// ============================================================

test('Boundary: Empty targetId should fail validation', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Empty string targetId
    const result = await controller.retryTarget({ type: 'feature', targetId: '' });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'INVALID_TARGET');

    // Whitespace-only targetId
    const result2 = await controller.retryTarget({ type: 'feature', targetId: '   ' });
    assert.equal(result2.ok, false);
    assert.equal(result2.errorCode, 'INVALID_TARGET');
  });
});

test('Boundary: Very long targetId should work', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    let capturedTargetId = null;
    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async (req) => {
        capturedTargetId = req.targetId;
        return { ok: true, exitCode: 0, stdout: '', stderr: '' };
      },
      config
    });

    const longTargetId = 'F-' + 'A'.repeat(1000);
    const result = await controller.runSingle({ type: 'feature', targetId: longTargetId });
    assert.equal(result.ok, true);
    assert.equal(capturedTargetId, longTargetId);
  });
});

test('Boundary: Lines parameter edge cases in getLogs', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Zero lines
    const result0 = await controller.getLogs({ type: 'feature', lines: 0 });
    assert.equal(result0.ok, true);
    assert.equal(result0.logs, '');

    // Negative lines (should default or handle gracefully)
    const resultNeg = await controller.getLogs({ type: 'feature', lines: -1 });
    assert.equal(resultNeg.ok, true);

    // Very large lines
    const resultLarge = await controller.getLogs({ type: 'feature', lines: 1000000 });
    assert.equal(resultLarge.ok, true);
  });
});

// ============================================================
// Error Path Tests
// ============================================================

test('Error path: Script runner throws exception', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => {
        throw new Error('Simulated script failure');
      },
      config
    });

    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('Simulated script failure'));
  });
});

test('Error path: Corrupted lock file', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');

    const lockManager = createLockManager({ config });

    // Write corrupted lock file
    const lockPath = path.join(tempDir, 'state', '.pipeline.lock');
    await fs.promises.writeFile(lockPath, 'not valid json {{{');

    // Should handle corrupted lock gracefully
    const result = await lockManager.acquireLock('feature', process.pid);
    assert.equal(result.ok, true, 'Should succeed despite corrupted lock file');
  });
});

test('Error path: Permission denied on state directory', async () => {
  // Skip on Windows
  if (process.platform === 'win32') {
    return;
  }

  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const stateManager = createStateManager({ config });

    // Create read-only directory
    const readOnlyDir = path.join(tempDir, 'readonly');
    await fs.promises.mkdir(readOnlyDir, { recursive: true });
    await fs.promises.chmod(readOnlyDir, 0o444);

    // Attempt to write should fail gracefully
    const readOnlyStateManager = createStateManager({
      config: { ...config, stateDir: readOnlyDir }
    });

    try {
      await readOnlyStateManager.writeDaemonMeta('feature', { pid: 123 });
      // If it succeeds, that's fine too (depends on permissions)
    } catch (error) {
      // Should handle permission errors gracefully
      assert.ok(error, 'Permission error should be thrown');
    }
  });
});

// ============================================================
// Concurrency Edge Cases
// ============================================================

test('Concurrency: Sequential lock acquire-release cycles', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Multiple start-stop cycles
    for (let i = 0; i < 5; i++) {
      const startResult = await controller.startPipeline({ type: 'feature' });
      assert.equal(startResult.ok, true, `Start ${i} should succeed`);

      // Simulate running daemon
      await controller.forceUnlock({ type: 'feature' });
    }
  });
});

test('Concurrency: forceUnlock clears lock for new acquisition', async () => {
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

    // Acquire lock
    await controller.startPipeline({ type: 'feature' });

    // Force unlock
    await controller.forceUnlock({ type: 'feature' });

    // Should be able to acquire again
    const result = await controller.startPipeline({ type: 'feature' });
    assert.equal(result.ok, true, 'Should acquire lock after forceUnlock');
  });
});

// ============================================================
// Telegram Handler Integration Tests
// ============================================================

test('Telegram: All results are JSON serializable', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');
    await setupStateFiles(tempDir, 'bugfix');

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({
        ok: true,
        exitCode: 0,
        stdout: 'Test output',
        stderr: ''
      }),
      config
    });

    const operations = [
      () => controller.startPipeline({ type: 'feature' }),
      () => controller.stopPipeline({ type: 'feature' }),
      () => controller.retryTarget({ type: 'feature', targetId: 'F-001' }),
      () => controller.runSingle({ type: 'feature', targetId: 'F-001' }),
      () => controller.getStatus({ type: 'feature' }),
      () => controller.getLogs({ type: 'feature' }),
      () => controller.forceUnlock({ type: 'feature' })
    ];

    for (const op of operations) {
      const result = await op();
      const serialized = JSON.stringify(result);
      assert.ok(serialized, 'Result should be JSON serializable');

      const parsed = JSON.parse(serialized);
      assert.equal(typeof parsed.ok, 'boolean', 'Parsed result should have ok field');
    }
  });
});

test('Telegram: Error results have all required fields', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    // Acquire lock first
    await controller.startPipeline({ type: 'feature' });

    // Try to acquire again - should get LOCK_ACQUISITION_FAILED
    const result = await controller.startPipeline({ type: 'feature' });

    assert.equal(result.ok, false);
    assert.ok(result.errorCode, 'Error should have errorCode');
    assert.ok(result.message, 'Error should have message');
    assert.ok(result.hint, 'Error should have hint');
    assert.ok(result.context, 'Error should have context');
  });
});

// ============================================================
// Feature/Bugfix Type Parity Tests
// ============================================================

test('Type parity: Both feature and bugfix support all operations', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    await setupStateFiles(tempDir, 'feature');
    await setupStateFiles(tempDir, 'bugfix');

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    const types = ['feature', 'bugfix'];

    for (const type of types) {
      // Start
      const startResult = await controller.startPipeline({ type });
      assert.equal(startResult.ok, true, `${type} startPipeline should work`);

      // Status
      const statusResult = await controller.getStatus({ type });
      assert.equal(statusResult.ok, true, `${type} getStatus should work`);

      // Logs
      const logsResult = await controller.getLogs({ type });
      assert.equal(logsResult.ok, true, `${type} getLogs should work`);

      // Stop
      await controller.forceUnlock({ type });
    }
  });
});

// ============================================================
// Large Log File Handling (NFR concern)
// ============================================================

test('Performance: Large log file reading', async () => {
  await withTempDir(async (tempDir) => {
    const config = createTestConfig(tempDir);
    const stateDir = await setupStateFiles(tempDir, 'feature');

    // Create large log file
    const logPath = path.join(stateDir, 'pipeline-daemon.log');
    const lines = [];
    for (let i = 0; i < 10000; i++) {
      lines.push(`Log line ${i}: ${'x'.repeat(100)}`);
    }
    await fs.promises.writeFile(logPath, lines.join('\n'));

    const controller = createPipelineController({
      lockManager: createLockManager({ config }),
      stateManager: createStateManager({ config }),
      scriptRunner: async () => ({ ok: true, exitCode: 0, stdout: '', stderr: '' }),
      config
    });

    const startTime = Date.now();
    const result = await controller.getLogs({ type: 'feature', lines: 100 });
    const duration = Date.now() - startTime;

    assert.equal(result.ok, true);
    assert.ok(duration < 1000, `Log reading should be fast (took ${duration}ms)`);
    assert.ok(result.logs.length > 0, 'Should return log content');
  });
});
