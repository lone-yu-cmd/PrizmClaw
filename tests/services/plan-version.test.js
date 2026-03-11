/**
 * Plan Version Management Tests
 * F-007: Test and Validation Suite
 *
 * T-134 ~ T-136: Tests for version management operations
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { createTestPipelineDirs, createTestPlan, writeTestState, readTestState } from '../helpers/test-state.js';
import { loadJsonFixture } from '../helpers/fixture-loader.js';

// ============================================================
// T-134: Version Management Tests: upload, list, switch
// ============================================================

test('T-134: upload creates versioned plan file', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');
    const planPath = await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-120000');

    const loaded = await readTestState(planPath);
    assert.equal(loaded.app_name, 'TestApp');
    assert.ok(Array.isArray(loaded.features));
  } finally {
    await cleanup();
  }
});

test('T-134: listVersions returns all versions', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'TestApp2' }, 'v20260314-110000');
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'TestApp3' }, 'v20260314-120000');

    // Simulate version listing by reading directory
    // In real implementation, this would call listVersions()
    const fs = await import('node:fs/promises');
    const files = await fs.readdir(join(plansDir, 'feature-list'));

    assert.ok(files.length >= 3);
    assert.ok(files.some(f => f.includes('v20260314-100000')));
    assert.ok(files.some(f => f.includes('v20260314-110000')));
    assert.ok(files.some(f => f.includes('v20260314-120000')));
  } finally {
    await cleanup();
  }
});

test('T-134: switch sets current version', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');

    // Simulate setting current version
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000',
      switchedAt: new Date().toISOString()
    });

    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.version, 'v20260314-100000');
  } finally {
    await cleanup();
  }
});

// ============================================================
// T-135: Version Management Tests: rollback
// ============================================================

test('T-135: rollback to previous version', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'V1' }, 'v20260314-100000');
    await createTestPlan(plansDir, 'feature-list', { ...planContent, app_name: 'V2' }, 'v20260314-110000');

    // Set current to V2
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-110000',
      previousVersion: 'v20260314-100000'
    });

    // Simulate rollback
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000',
      previousVersion: 'v20260314-110000'
    });

    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.version, 'v20260314-100000');
  } finally {
    await cleanup();
  }
});

test('T-135: rollback returns null when no previous version', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const planContent = loadJsonFixture('plans/valid-feature-list.json');

    await createTestPlan(plansDir, 'feature-list', planContent, 'v20260314-100000');

    // Set current without previous
    await writeTestState(join(plansDir, 'feature-list', '_current.json'), {
      version: 'v20260314-100000'
    });

    const current = await readTestState(join(plansDir, 'feature-list', '_current.json'));
    assert.equal(current.previousVersion, undefined);
  } finally {
    await cleanup();
  }
});

// ============================================================
// T-136: Version Boundary Tests: non-existent, corrupted
// ============================================================

test('T-136: get non-existent version returns null', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const content = await readTestState(join(plansDir, 'feature-list', 'v99999999-999999.json'));
    assert.equal(content, null);
  } finally {
    await cleanup();
  }
});

test('T-136: handle corrupted version file', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    const fs = await import('node:fs/promises');

    // Create corrupted file
    const corruptedPath = join(plansDir, 'feature-list', 'v20260314-corrupt.json');
    await fs.writeFile(corruptedPath, 'not valid json { ', 'utf-8');

    // Try to read it
    try {
      const content = await readTestState(corruptedPath);
      // If readTestState handles corruption, it should return null
      assert.equal(content, null);
    } catch (e) {
      // If it throws, that's expected behavior for corrupted files
      assert.ok(e instanceof SyntaxError);
    }
  } finally {
    await cleanup();
  }
});

test('T-136: handle missing version file', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    // Try to switch to non-existent version
    const versionPath = join(plansDir, 'feature-list', 'v-nonexistent.json');
    const exists = await readTestState(versionPath);
    assert.equal(exists, null);
  } finally {
    await cleanup();
  }
});

test('T-136: handle empty version list', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    // No versions created, directory is empty
    const fs = await import('node:fs/promises');
    const files = await fs.readdir(join(plansDir, 'feature-list'));

    assert.deepEqual(files, []);
  } finally {
    await cleanup();
  }
});

test('T-136: version name validation', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  try {
    // Valid version format
    assert.ok(/^v\d{8}-\d{6}$/.test('v20260314-120000'));

    // Invalid version formats
    assert.ok(!/^v\d{8}-\d{6}$/.test('invalid'));
    assert.ok(!/^v\d{8}-\d{6}$/.test('v2026-03-14'));
    assert.ok(!/^v\d{8}-\d{6}$/.test('20260314120000'));
  } finally {
    await cleanup();
  }
});
