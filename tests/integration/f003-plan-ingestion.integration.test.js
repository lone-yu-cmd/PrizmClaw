/**
 * Integration Tests for F-003: Plan Ingestion
 * Covers file upload flow, version switching, and pipeline integration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function createTempPlansDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-f003-'));
  fs.mkdirSync(path.join(tempDir, 'feature-list'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'bug-fix-list'), { recursive: true });
  return tempDir;
}

function createValidFeatureList(name = 'TestApp') {
  return JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: name,
    features: [
      {
        id: 'F-001',
        title: 'Test Feature',
        description: 'A test feature',
        priority: 1,
        dependencies: [],
        acceptance_criteria: ['AC1: Test passes'],
        status: 'pending'
      }
    ]
  });
}

function createValidBugFixList(name = 'TestProject') {
  return JSON.stringify({
    $schema: 'dev-pipeline-bug-fix-list-v1',
    project_name: name,
    bugs: [
      {
        id: 'B-001',
        title: 'Test Bug',
        description: 'A test bug',
        severity: 'medium',
        error_source: { type: 'user_report' },
        verification_type: 'manual',
        acceptance_criteria: ['AC1: Bug is fixed'],
        status: 'pending'
      }
    ]
  });
}

// ============================================================
// US-1: Upload Plan File Integration Tests
// ============================================================
test('US-1: Complete upload flow for feature-list', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    // Simulate upload
    const content = createValidFeatureList('IntegrationTestApp');
    const validationResult = service.validate(content);

    assert.equal(validationResult.valid, true, 'Validation should pass');
    assert.equal(validationResult.type, 'feature-list');

    // Save
    const saveResult = await service.save('feature-list', content, { uploadedBy: 12345 });
    assert.equal(saveResult.success, true);
    assert.ok(saveResult.version);

    // Set as current
    const setCurrentResult = await service.setCurrent('feature-list', saveResult.version);
    assert.equal(setCurrentResult, true);

    // Verify content
    const savedContent = await service.getVersion('feature-list', saveResult.version);
    assert.ok(savedContent);
    const parsed = JSON.parse(savedContent);
    assert.equal(parsed.app_name, 'IntegrationTestApp');
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

test('US-1: Complete upload flow for bug-fix-list', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    const content = createValidBugFixList('IntegrationBugProject');
    const validationResult = service.validate(content);

    assert.equal(validationResult.valid, true);
    assert.equal(validationResult.type, 'bug-fix-list');

    const saveResult = await service.save('bug-fix-list', content, { uploadedBy: 12345 });
    assert.equal(saveResult.success, true);

    await service.setCurrent('bug-fix-list', saveResult.version);

    const current = await service.getCurrent('bug-fix-list');
    assert.equal(current.version, saveResult.version);
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

// ============================================================
// US-2: Schema Validation Integration Tests
// ============================================================
test('US-2: Invalid schema returns field-level errors', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const invalidContent = JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'Test',
    features: [
      {
        id: 'INVALID', // Wrong format
        title: '', // Empty title
        description: 'Test',
        priority: -1, // Negative
        dependencies: [],
        acceptance_criteria: [],
        status: 'invalid-status'
      }
    ]
  });

  const result = service.validate(invalidContent);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);

  // Check error formatting
  const formatted = service.formatValidationErrors(result.errors);
  assert.ok(formatted.includes('❌'));
});

test('US-2: Valid file is not saved on validation failure', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    // First save a valid version
    const validContent = createValidFeatureList('ValidApp');
    const saveResult = await service.save('feature-list', validContent, { uploadedBy: 123 });
    await service.setCurrent('feature-list', saveResult.version);

    // Try to save invalid content (should fail validation before save)
    const invalidContent = JSON.stringify({
      $schema: 'dev-pipeline-feature-list-v1',
      // Missing required fields
    });

    const validationResult = service.validate(invalidContent);
    assert.equal(validationResult.valid, false);

    // Original version should still be current
    const current = await service.getCurrent('feature-list');
    assert.equal(current.version, saveResult.version);
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

// ============================================================
// US-3: Version Management Integration Tests
// ============================================================
test('US-3: Version listing shows all versions', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    // Save multiple versions
    await service.save('feature-list', createValidFeatureList('App1'), { uploadedBy: 123 });
    await new Promise(r => setTimeout(r, 1100));
    await service.save('feature-list', createValidFeatureList('App2'), { uploadedBy: 123 });
    await new Promise(r => setTimeout(r, 1100));
    await service.save('feature-list', createValidFeatureList('App3'), { uploadedBy: 123 });

    const versions = await service.listVersions('feature-list');

    assert.equal(versions.length, 3);
    // Should be sorted by most recent first
    assert.ok(versions[0].version > versions[1].version);
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

test('US-3: Version switching updates active path', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    // Save two versions
    const v1 = await service.save('feature-list', createValidFeatureList('App1'), { uploadedBy: 123 });
    await service.setCurrent('feature-list', v1.version);

    await new Promise(r => setTimeout(r, 1100));
    const v2 = await service.save('feature-list', createValidFeatureList('App2'), { uploadedBy: 123 });
    await service.setCurrent('feature-list', v2.version);

    // Active path should be v2
    let activePath = service.getActivePath('feature-list');
    assert.ok(activePath.includes(v2.version));

    // Switch to v1
    await service.setCurrent('feature-list', v1.version);

    activePath = service.getActivePath('feature-list');
    assert.ok(activePath.includes(v1.version));
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

test('US-3: Rollback switches to previous version', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    const v1 = await service.save('feature-list', createValidFeatureList('App1'), { uploadedBy: 123 });
    await service.setCurrent('feature-list', v1.version);

    await new Promise(r => setTimeout(r, 1100));
    const v2 = await service.save('feature-list', createValidFeatureList('App2'), { uploadedBy: 123 });
    await service.setCurrent('feature-list', v2.version);

    // Rollback
    const result = await service.rollback('feature-list');

    assert.ok(result);
    assert.equal(result.previousVersion, v2.version);
    assert.equal(result.currentVersion, v1.version);

    // Verify current
    const current = await service.getCurrent('feature-list');
    assert.equal(current.version, v1.version);
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

// ============================================================
// US-4: Plan Status Query Integration Tests
// ============================================================
test('US-4: Status query returns complete information', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const service = createPlanIngestionService({ plansDir });

    const content = JSON.stringify({
      $schema: 'dev-pipeline-feature-list-v1',
      app_name: 'StatusTestApp',
      features: [
        { id: 'F-001', title: 'A', description: 'A', priority: 1, dependencies: [], acceptance_criteria: ['AC'], status: 'pending' },
        { id: 'F-002', title: 'B', description: 'B', priority: 2, dependencies: [], acceptance_criteria: ['AC'], status: 'in_progress' },
        { id: 'F-003', title: 'C', description: 'C', priority: 3, dependencies: [], acceptance_criteria: ['AC'], status: 'completed' }
      ]
    });

    const saveResult = await service.save('feature-list', content, { uploadedBy: 123 });
    await service.setCurrent('feature-list', saveResult.version);

    const current = await service.getCurrent('feature-list');
    const versions = await service.listVersions('feature-list');

    assert.ok(current);
    assert.equal(current.version, saveResult.version);

    const versionInfo = versions.find(v => v.version === current.version);
    assert.equal(versionInfo.itemCount, 3);
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

// ============================================================
// US-6: Pipeline Integration Tests
// ============================================================
test('US-6: resolvePlanListPath returns active path', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const { resolvePlanListPath } = await import('../../src/services/pipeline-control-service.js');

    const service = createPlanIngestionService({ plansDir });

    const saveResult = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 123 });
    await service.setCurrent('feature-list', saveResult.version);

    const activePath = await resolvePlanListPath({
      planType: 'feature-list',
      planService: service
    });

    assert.ok(activePath);
    assert.ok(activePath.includes(saveResult.version));
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});

test('US-6: resolvePlanListPath with version returns specific path', async () => {
  const plansDir = createTempPlansDir();

  try {
    const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
    const { resolvePlanListPath } = await import('../../src/services/pipeline-control-service.js');

    const service = createPlanIngestionService({ plansDir });

    // Save multiple versions
    await service.save('feature-list', createValidFeatureList('App1'), { uploadedBy: 123 });
    await new Promise(r => setTimeout(r, 1100));
    const v2 = await service.save('feature-list', createValidFeatureList('App2'), { uploadedBy: 123 });
    await service.setCurrent('feature-list', v2.version);

    // Request specific version
    const specificPath = await resolvePlanListPath({
      planType: 'feature-list',
      version: v2.version,
      planService: service
    });

    assert.ok(specificPath);
    assert.ok(specificPath.includes(v2.version));
  } finally {
    fs.rmSync(plansDir, { recursive: true, force: true });
  }
});
