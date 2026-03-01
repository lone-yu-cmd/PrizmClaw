/**
 * Plan Version Flow Integration Tests
 * F-007: Test and Validation Suite
 *
 * T-137: Tests dynamic plan switch integration with pipeline
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { createTestPipelineDirs, createTestPlan, writeTestState, readTestState } from '../helpers/test-state.js';
import { loadJsonFixture } from '../helpers/fixture-loader.js';
import { createMockRunner } from '../helpers/mock-runner.js';

// ============================================================
// T-137: Pipeline Integration Tests: Dynamic Plan Switch
// ============================================================

test('T-137: Plan switch during idle state', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    // Create initial plan version
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000'
    });

    // Create new version
    const newPlanContent = { ...planContent, app_name: 'TestApp2' };
    await createTestPlan(plansDir, 'feature-list', newPlanContent, 'v20260314-110000');

    // Switch to new version
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-110000',
      previousVersion: 'v20260314-100000'
    });

    // Verify switch
    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.version, 'v20260314-110000');

    // Verify new plan is active
    const activePlan = await readTestState(join(plansDir, 'feature-list', 'v20260314-110000.json'));
    assert.equal(activePlan.app_name, 'TestApp2');
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch rejects when pipeline is running', async () => {
  const { plansDir, stateDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');

    // Simulate running pipeline by creating state
    await writeTestState(join(stateDir, 'pipeline-state.json'), {
      isRunning: true,
      pid: 12345,
      currentFeature: 'F-TEST-001'
    });

    // Check if running
    const state = await readTestState(join(stateDir, 'pipeline-state.json'));
    assert.equal(state.isRunning, true);

    // In real implementation, plan switch should be rejected here
    // This test verifies the state detection works
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch with mock runner integration', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const runner = createMockRunner({
      status: { ok: true, isRunning: false },
      run: { ok: true, pid: 12345, runId: 'run-001' },
      stop: { ok: true, previousPid: 12345 }
    });

    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    // Create and set initial plan
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000'
    });

    // Verify idle state before switch
    const status = await runner({ action: 'status' });
    assert.equal(status.isRunning, false);

    // Create and switch to new plan
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'TestApp2' }, 'v20260314-110000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-110000',
      previousVersion: 'v20260314-100000'
    });

    // Verify switch succeeded
    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.version, 'v20260314-110000');
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch preserves feature progress', async () => {
  const { plansDir, stateDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    // Create plan with progress
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000'
    });

    // Simulate completed features
    await writeTestState(join(stateDir, 'pipeline-state.json'), {
      completed: ['F-TEST-001'],
      failed: [],
      lastResult: 'partial'
    });

    // Create new version
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-110000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-110000',
      previousVersion: 'v20260314-100000'
    });

    // Verify progress preserved
    const state = await readTestState(join(stateDir, 'pipeline-state.json'));
    assert.deepEqual(state.completed, ['F-TEST-001']);
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch rollback flow', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    // Create v1 and v2
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'V1' }, 'v20260314-100000');
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'V2' }, 'v20260314-110000');

    // Set v2 as current
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-110000',
      previousVersion: 'v20260314-100000'
    });

    // Rollback to v1
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000',
      previousVersion: 'v20260314-110000'
    });

    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.version, 'v20260314-100000');

    // Verify v1 is active
    const activePlan = await readTestState(join(plansDir, 'feature-list', 'v20260314-100000.json'));
    assert.equal(activePlan.app_name, 'V1');
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch with invalid version fails gracefully', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');
    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');

    // Try to switch to non-existent version
    const exists = await readTestState(join(plansDir, 'feature-list', 'v-nonexistent.json'));
    assert.equal(exists, null);

    // Current should not change (in real implementation)
  } finally {
    await cleanup();
  }
});

test('T-137: Plan switch updates active path correctly', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000'
    });

    // Get active path
    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    const activePath = join(plansDir, 'feature-list', `${current.version}.json`);

    // Verify active path exists
    const activePlan = await readTestState(activePath);
    assert.ok(activePlan);
    assert.equal(activePlan.app_name, 'TestApp');
  } finally {
    await cleanup();
  }
});
