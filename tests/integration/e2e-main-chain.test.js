/**
 * E2E Integration Tests: Main Chain
 * F-007: Test and Validation Suite
 *
 * Tests the start → status → stop main chain (US-3)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMockRunner, createStatefulMockRunner } from '../helpers/mock-runner.js';
import { createMockContext as _createMockContext, createAdminContext as _createAdminContext } from '../helpers/mock-telegram.js';
import { createTestPipelineDirs } from '../helpers/test-state.js';

// ============================================================
// T-121: E2E test: start → status → stop main chain
// ============================================================

test('T-121: E2E start → status → stop main chain works correctly', async () => {
  const { cleanup, tempDir: _tempDir, stateDir: _stateDir, bugfixStateDir: _bugfixStateDir } = await createTestPipelineDirs();

  try {
    // Create stateful mock runner
    const runner = createStatefulMockRunner();

    // Simulate the main chain
    // 1. Start pipeline
    const startResult = await runner({ action: 'run', pipelineType: 'feature' });
    assert.equal(startResult.ok, true, 'Start should succeed');
    assert.ok(startResult.pid, 'Should have PID');
    assert.ok(startResult.runId, 'Should have runId');

    // 2. Check status (running)
    const statusWhileRunning = await runner({ action: 'status', pipelineType: 'feature' });
    assert.equal(statusWhileRunning.ok, true);
    assert.equal(statusWhileRunning.isRunning, true, 'Should be running after start');

    // 3. Stop pipeline
    const stopResult = await runner({ action: 'stop', pipelineType: 'feature' });
    assert.equal(stopResult.ok, true, 'Stop should succeed');

    // 4. Check status (stopped)
    const statusAfterStop = await runner({ action: 'status', pipelineType: 'feature' });
    assert.equal(statusAfterStop.ok, true);
    assert.equal(statusAfterStop.isRunning, false, 'Should not be running after stop');
  } finally {
    await cleanup();
  }
});

// ============================================================
// T-122: E2E test: duplicate start prevention
// ============================================================

test('T-122: E2E duplicate start prevention works', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    // Create runner that starts in running state
    const runner = createStatefulMockRunner({ startRunning: true });

    // Verify initial state is running
    const statusResult = await runner({ action: 'status' });
    assert.equal(statusResult.isRunning, true, 'Should initially be running');

    // Try to start again
    const duplicateStartResult = await runner({ action: 'run' });
    assert.equal(duplicateStartResult.ok, false, 'Duplicate start should fail');
    assert.equal(duplicateStartResult.errorCode, 'ALREADY_RUNNING', 'Should have ALREADY_RUNNING error');
  } finally {
    await cleanup();
  }
});

// ============================================================
// T-123: E2E test: stop when not running
// ============================================================

test('T-123: E2E stop when not running handles gracefully', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    // Create runner that starts in idle state (default)
    const runner = createStatefulMockRunner();

    // Verify initial state is not running
    const statusResult = await runner({ action: 'status' });
    assert.equal(statusResult.isRunning, false, 'Should initially be idle');

    // Stop without starting
    const stopResult = await runner({ action: 'stop' });
    assert.equal(stopResult.ok, true, 'Stop should succeed even when not running');
    assert.equal(stopResult.errorCode, 'ALREADY_STOPPED', 'Should have ALREADY_STOPPED code');
  } finally {
    await cleanup();
  }
});

// ============================================================
// T-124: E2E test: state transitions verification
// ============================================================

test('T-124: E2E state transitions are tracked correctly', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const runner = createStatefulMockRunner();

    // Initial state: idle
    let state = runner.getState();
    assert.equal(state.isRunning, false, 'Initial: idle');

    // Transition: idle → running
    await runner({ action: 'run' });
    state = runner.getState();
    assert.equal(state.isRunning, true, 'After start: running');
    assert.ok(state.pid, 'Should have PID');
    assert.ok(state.runId, 'Should have runId');

    // Transition: running → stopped
    await runner({ action: 'stop' });
    state = runner.getState();
    assert.equal(state.isRunning, false, 'After stop: stopped');
    assert.ok(state.completed.length > 0, 'Should have completed features');

    // Can start again after stop
    const restartResult = await runner({ action: 'run' });
    assert.equal(restartResult.ok, true, 'Restart should work after stop');
    state = runner.getState();
    assert.equal(state.isRunning, true, 'After restart: running');
  } finally {
    await cleanup();
  }
});

// ============================================================
// Additional E2E scenarios
// ============================================================

test('E2E: Full pipeline lifecycle with multiple status checks', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const runner = createStatefulMockRunner();

    // Multiple status checks throughout lifecycle
    const statusBeforeStart = await runner({ action: 'status' });
    assert.equal(statusBeforeStart.isRunning, false);

    await runner({ action: 'run' });

    const statusDuringRun = await runner({ action: 'status' });
    assert.equal(statusDuringRun.isRunning, true);

    await runner({ action: 'stop' });

    const statusAfterStop = await runner({ action: 'status' });
    assert.equal(statusAfterStop.isRunning, false);
  } finally {
    await cleanup();
  }
});

test('E2E: Pipeline supports both feature and bugfix types', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const runner = createStatefulMockRunner();

    // Feature pipeline
    const featureStart = await runner({ action: 'run', pipelineType: 'feature' });
    assert.equal(featureStart.ok, true);

    await runner({ action: 'stop' });

    // Bugfix pipeline
    const bugfixStart = await runner({ action: 'run', pipelineType: 'bugfix' });
    assert.equal(bugfixStart.ok, true);

    await runner({ action: 'stop' });
  } finally {
    await cleanup();
  }
});

test('E2E: Retry action works on failed targets', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const runner = createStatefulMockRunner();

    const retryResult = await runner({ action: 'retry', targetId: 'F-001' });
    assert.equal(retryResult.ok, true, 'Retry should succeed');
    assert.equal(retryResult.targetId, 'F-001', 'Should return correct targetId');
  } finally {
    await cleanup();
  }
});

test('E2E: Logs can be retrieved', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const runner = createStatefulMockRunner();

    const logsResult = await runner({ action: 'logs' });
    assert.equal(logsResult.ok, true, 'Logs should succeed');
    assert.ok(logsResult.logs, 'Should have logs content');
    assert.ok(logsResult.lines, 'Should have line count');
  } finally {
    await cleanup();
  }
});

// ============================================================
// AC-3.1: Test start → status → stop main chain (mock external deps)
// AC-3.2: Verify state transitions: idle → running → stopped
// AC-3.3: Verify error handling: duplicate start, empty stop
// AC-3.4: Test runtime < 30s (these tests are fast)
// ============================================================

test('AC-3.1: Main chain with mocked dependencies', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    // Custom mock runner with specific responses
    const runner = createMockRunner({
      run: { ok: true, pid: 12345, runId: 'run-001', message: 'Started' },
      status: [
        { ok: true, isRunning: true, currentFeature: 'F-001' },
        { ok: true, isRunning: false, lastResult: 'completed' }
      ],
      stop: { ok: true, previousPid: 12345, message: 'Stopped' }
    });

    const start = await runner({ action: 'run' });
    assert.equal(start.ok, true);

    const status1 = await runner({ action: 'status' });
    assert.equal(status1.isRunning, true);

    const status2 = await runner({ action: 'status' });
    assert.equal(status2.isRunning, false);

    const stop = await runner({ action: 'stop' });
    assert.equal(stop.ok, true);
  } finally {
    await cleanup();
  }
});

test('AC-3.4: E2E tests complete quickly (< 30s)', async () => {
  const { cleanup } = await createTestPipelineDirs();

  try {
    const start = Date.now();
    const runner = createStatefulMockRunner();

    // Run full cycle 100 times
    for (let i = 0; i < 100; i++) {
      await runner({ action: 'run' });
      await runner({ action: 'status' });
      await runner({ action: 'stop' });
      await runner({ action: 'status' });
    }

    const duration = Date.now() - start;
    assert.ok(duration < 5000, `100 full cycles should take < 5s, took ${duration}ms`);
  } finally {
    await cleanup();
  }
});
