/**
 * Tests for plan-ingestion-service.js
 * Covers T-010 (schema loader), T-011 (plan validator), T-012 (version manager),
 * T-013 (plan registry), T-014 (error formatting)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// We'll import dynamically after setup
let createPlanIngestionService;

function createTempPlansDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-plans-'));
  fs.mkdirSync(path.join(tempDir, 'feature-list'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'bug-fix-list'), { recursive: true });
  return tempDir;
}

function createValidFeatureList() {
  return JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'TestApp',
    app_description: 'A test application',
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

function createValidBugFixList() {
  return JSON.stringify({
    $schema: 'dev-pipeline-bug-fix-list-v1',
    project_name: 'TestProject',
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
// T-010: Schema Loader Tests
// ============================================================
test('T-010: loadSchema should load feature-list schema', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const schema = service.loadSchema('feature-list');
  assert.ok(schema);
  assert.equal(typeof schema, 'object'); // Raw schema object
});

test('T-010: loadSchema should load bug-fix-list schema', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const schema = service.loadSchema('bug-fix-list');
  assert.ok(schema);
  assert.equal(typeof schema, 'object'); // Raw schema object
});

test('T-010: loadSchema should throw for unknown schema type', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  assert.throws(
    () => service.loadSchema('unknown-type'),
    /unknown.*schema/i
  );
});

// ============================================================
// T-011: Plan Validator Tests
// ============================================================
test('T-011: validate should identify feature-list type', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const result = service.validate(createValidFeatureList());

  assert.equal(result.valid, true);
  assert.equal(result.type, 'feature-list');
  assert.ok(result.summary);
  assert.equal(result.summary.name, 'TestApp');
  assert.equal(result.summary.itemCount, 1);
});

test('T-011: validate should identify bug-fix-list type', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const result = service.validate(createValidBugFixList());

  assert.equal(result.valid, true);
  assert.equal(result.type, 'bug-fix-list');
  assert.ok(result.summary);
  assert.equal(result.summary.name, 'TestProject');
  assert.equal(result.summary.itemCount, 1);
});

test('T-011: validate should return unknown type for missing schema', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const result = service.validate(JSON.stringify({ foo: 'bar' }));

  assert.equal(result.valid, false);
  assert.equal(result.type, 'unknown');
});

test('T-011: validate should return field-level errors', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const invalidContent = JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'TestApp',
    features: [
      {
        id: 'INVALID-ID', // Should match F-\\d{3}
        title: 'Test',
        description: 'Test',
        priority: -1, // Should be >= 1
        dependencies: [],
        acceptance_criteria: [],
        status: 'invalid-status'
      }
    ]
  });

  const result = service.validate(invalidContent);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  // Check that errors have path and message
  for (const error of result.errors) {
    assert.ok(error.path, 'Error should have path');
    assert.ok(error.message, 'Error should have message');
  }
});

test('T-011: validate should return status breakdown in summary', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const content = JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'TestApp',
    features: [
      { id: 'F-001', title: 'A', description: 'A', priority: 1, dependencies: [], acceptance_criteria: ['AC'], status: 'pending' },
      { id: 'F-002', title: 'B', description: 'B', priority: 2, dependencies: [], acceptance_criteria: ['AC'], status: 'in_progress' },
      { id: 'F-003', title: 'C', description: 'C', priority: 3, dependencies: [], acceptance_criteria: ['AC'], status: 'pending' }
    ]
  });

  const result = service.validate(content);

  assert.equal(result.valid, true);
  assert.deepEqual(result.summary.statusBreakdown, { pending: 2, in_progress: 1 });
});

test('T-011: validate should handle invalid JSON', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const result = service.validate('not valid json');

  assert.equal(result.valid, false);
  assert.equal(result.type, 'unknown');
  assert.ok(result.errors.length > 0);
  assert.match(result.errors[0].message, /json/i);
});

// ============================================================
// T-014: Error Formatting Tests
// ============================================================
test('T-014: formatValidationErrors should format errors with field paths', async () => {
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ projectRoot: PROJECT_ROOT });

  const errors = [
    { path: 'features[0].id', message: 'Invalid ID format' },
    { path: 'features[1].priority', message: 'Must be positive' }
  ];

  const formatted = service.formatValidationErrors(errors);

  assert.match(formatted, /features\[0\].id/);
  assert.match(formatted, /Invalid ID format/);
  assert.match(formatted, /features\[1\].priority/);
  assert.match(formatted, /Must be positive/);
});

// ============================================================
// T-012: Version Manager Tests
// ============================================================
test('T-012: save should create versioned file', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const result = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });

  assert.equal(result.success, true);
  assert.ok(result.version);
  assert.match(result.version, /^v\d{8}-\d{6}$/);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-012: listVersions should return version list', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  // Save two versions
  await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  await new Promise(r => setTimeout(r, 1100)); // Ensure different timestamp
  await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });

  const versions = await service.listVersions('feature-list');

  assert.equal(versions.length, 2);
  assert.ok(versions[0].version);
  assert.ok(versions[0].timestamp);
  assert.ok(versions[0].itemCount);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-012: getVersion should return content', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const saved = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  const content = await service.getVersion('feature-list', saved.version);

  assert.ok(content);
  const parsed = JSON.parse(content);
  assert.equal(parsed.app_name, 'TestApp');

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-012: getVersion should return null for non-existent version', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const content = await service.getVersion('feature-list', 'v99999999-999999');

  assert.equal(content, null);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

// ============================================================
// T-013: Plan Registry Tests
// ============================================================
test('T-013: setCurrent should update _current.json', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const saved = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  const success = await service.setCurrent('feature-list', saved.version);

  assert.equal(success, true);

  const current = await service.getCurrent('feature-list');
  assert.ok(current);
  assert.equal(current.version, saved.version);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-013: getActivePath should return path to current version', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const saved = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  await service.setCurrent('feature-list', saved.version);

  const activePath = service.getActivePath('feature-list');

  assert.ok(activePath);
  assert.match(activePath, /feature-list/);
  assert.match(activePath, new RegExp(saved.version));

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-013: rollback should switch to previous version', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  // Save and set first version
  const v1 = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  await service.setCurrent('feature-list', v1.version);

  // Save and set second version
  await new Promise(r => setTimeout(r, 1100));
  const v2 = await service.save('feature-list', JSON.stringify({
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'TestApp2',
    features: [
      { id: 'F-001', title: 'Test', description: 'Test', priority: 1, dependencies: [], acceptance_criteria: ['AC'], status: 'pending' }
    ]
  }), { uploadedBy: 12345 });
  await service.setCurrent('feature-list', v2.version);

  // Rollback
  const result = await service.rollback('feature-list');

  assert.ok(result);
  assert.equal(result.previousVersion, v2.version);
  assert.equal(result.currentVersion, v1.version);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-013: rollback should return null when no previous version', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  // Only one version
  const v1 = await service.save('feature-list', createValidFeatureList(), { uploadedBy: 12345 });
  await service.setCurrent('feature-list', v1.version);

  const result = await service.rollback('feature-list');

  assert.equal(result, null);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});

test('T-013: getCurrent should return null when no version set', async () => {
  const plansDir = createTempPlansDir();
  const { createPlanIngestionService } = await import('../../src/services/plan-ingestion-service.js');
  const service = createPlanIngestionService({ plansDir });

  const current = await service.getCurrent('feature-list');

  assert.equal(current, null);

  // Cleanup
  fs.rmSync(plansDir, { recursive: true, force: true });
});
