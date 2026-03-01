import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { loadPipelineInfraConfig, loadAndValidateConfig } from '../../src/pipeline-infra/config-loader.js';

function createTempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-infra-'));
  fs.mkdirSync(path.join(root, 'dev-pipeline'), { recursive: true });
  return root;
}

test('loadPipelineInfraConfig should load defaults from cwd', () => {
  const projectRoot = createTempProjectRoot();
  const config = loadPipelineInfraConfig({ env: {}, cwd: projectRoot, argv: [] });

  assert.equal(config.projectRoot, projectRoot);
  assert.equal(config.pipelineDir, path.join(projectRoot, 'dev-pipeline'));
  assert.equal(config.featureListPath, path.join(projectRoot, 'feature-list.json'));
  assert.equal(config.bugFixListPath, path.join(projectRoot, 'bug-fix-list.json'));
  assert.equal(config.stateDir, path.join(projectRoot, 'dev-pipeline/state'));
  assert.equal(config.bugfixStateDir, path.join(projectRoot, 'dev-pipeline/bugfix-state'));
  assert.equal(config.maxRetries, 3);
  assert.equal(config.sessionTimeoutSec, 0);
  assert.equal(config.heartbeatIntervalSec, 30);
  assert.equal(config.aiCli, 'cbc');
  assert.equal(config.platform, 'codebuddy');
});

test('loadPipelineInfraConfig should parse env and argv overrides', () => {
  const projectRoot = createTempProjectRoot();
  const config = loadPipelineInfraConfig({
    cwd: '/should-not-be-used',
    argv: ['--project-root', projectRoot, '--heartbeat-interval', '15'],
    env: {
      FEATURE_LIST_PATH: '/tmp/custom-feature-list.json',
      BUG_FIX_LIST_PATH: '/tmp/custom-bug-list.json',
      MAX_RETRIES: '7',
      SESSION_TIMEOUT: '120',
      AI_CLI: 'claude'
    }
  });

  assert.equal(config.projectRoot, projectRoot);
  assert.equal(config.featureListPath, '/tmp/custom-feature-list.json');
  assert.equal(config.bugFixListPath, '/tmp/custom-bug-list.json');
  assert.equal(config.maxRetries, 7);
  assert.equal(config.sessionTimeoutSec, 120);
  assert.equal(config.heartbeatIntervalSec, 15);
  assert.equal(config.aiCli, 'claude');
  assert.equal(config.platform, 'claude');
});

test('loadPipelineInfraConfig should throw readable errors for invalid values', () => {
  const projectRoot = createTempProjectRoot();

  assert.throws(
    () => loadPipelineInfraConfig({ cwd: projectRoot, env: { MAX_RETRIES: '0' } }),
    (error) => {
      assert.match(error.message, /MAX_RETRIES/);
      assert.match(error.message, /hint/i);
      assert.equal(error.code, 'CONFIG_INVALID');
      return true;
    }
  );

  assert.throws(
    () => loadPipelineInfraConfig({ cwd: projectRoot, env: { PRIZMKIT_PLATFORM: 'invalid' } }),
    (error) => {
      assert.match(error.message, /PRIZMKIT_PLATFORM/);
      assert.equal(error.code, 'CONFIG_INVALID');
      return true;
    }
  );
});

test('loadPipelineInfraConfig should fail when dev-pipeline directory is missing', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-no-pipeline-'));

  assert.throws(
    () => loadPipelineInfraConfig({ cwd: projectRoot, env: {}, argv: [] }),
    (error) => {
      assert.match(error.message, /dev-pipeline/);
      assert.equal(error.code, 'CONFIG_MISSING');
      return true;
    }
  );
});

// T-003: plansDir configuration tests
test('loadPipelineInfraConfig should include plansDir with default value', () => {
  const projectRoot = createTempProjectRoot();
  const config = loadPipelineInfraConfig({ env: {}, cwd: projectRoot, argv: [] });

  assert.equal(config.plansDir, path.join(projectRoot, 'plans'));
});

test('loadPipelineInfraConfig should support PLANS_DIR env override', () => {
  const projectRoot = createTempProjectRoot();
  const config = loadPipelineInfraConfig({
    cwd: projectRoot,
    env: { PLANS_DIR: '/custom/plans' },
    argv: []
  });

  assert.equal(config.plansDir, '/custom/plans');
});

test('loadPipelineInfraConfig should support --plans-dir argv override', () => {
  const projectRoot = createTempProjectRoot();
  const config = loadPipelineInfraConfig({
    cwd: projectRoot,
    env: {},
    argv: ['--plans-dir', '/argv/plans']
  });

  assert.equal(config.plansDir, '/argv/plans');
});

// =============================================================
// F-001 T-020: loadAndValidateConfig batch validation tests
// =============================================================

test('loadAndValidateConfig should return ok:true with frozen config when valid', () => {
  const projectRoot = createTempProjectRoot();
  const result = loadAndValidateConfig({ env: {}, cwd: projectRoot, argv: [] });

  assert.equal(result.ok, true);
  assert.ok(result.config);
  assert.equal(result.config.projectRoot, projectRoot);
  assert.ok(Object.isFrozen(result.config));
  assert.equal(result.errors, undefined);
});

test('loadAndValidateConfig should return ok:false with ALL errors when multiple fields invalid', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-no-pipeline-'));

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: {
      MAX_RETRIES: '0',
      HEARTBEAT_INTERVAL: '-1',
    },
    argv: []
  });

  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  // Should have collected multiple errors (pipelineDir missing + MAX_RETRIES + HEARTBEAT_INTERVAL)
  assert.ok(result.errors.length >= 2, `Expected at least 2 errors, got ${result.errors.length}`);
  assert.equal(result.config, undefined);
});

test('loadAndValidateConfig errors should have field, message, code properties', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-validate-'));

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: { PRIZMKIT_PLATFORM: 'invalid' },
    argv: []
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);

  for (const err of result.errors) {
    assert.equal(typeof err.field, 'string', 'Error should have a field property');
    assert.equal(typeof err.message, 'string', 'Error should have a message property');
    assert.equal(typeof err.code, 'string', 'Error should have a code property');
  }
});

test('loadAndValidateConfig should report pipelineDir missing error', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-no-pipeline2-'));

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: {},
    argv: []
  });

  assert.equal(result.ok, false);
  const pipelineError = result.errors.find(e => e.field === 'pipelineDir');
  assert.ok(pipelineError, 'Should have a pipelineDir error');
  assert.equal(pipelineError.code, 'CONFIG_MISSING');
});

test('loadAndValidateConfig should collect integer validation errors', () => {
  const projectRoot = createTempProjectRoot();

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: {
      MAX_RETRIES: 'abc',
      SESSION_TIMEOUT: '-1',
      HEARTBEAT_INTERVAL: '0',
    },
    argv: []
  });

  assert.equal(result.ok, false);
  // Should have errors for MAX_RETRIES, SESSION_TIMEOUT, HEARTBEAT_INTERVAL
  const fields = result.errors.map(e => e.field);
  assert.ok(fields.includes('MAX_RETRIES'), 'Should report MAX_RETRIES error');
  assert.ok(fields.includes('HEARTBEAT_INTERVAL'), 'Should report HEARTBEAT_INTERVAL error');
});

test('loadAndValidateConfig should include hint in errors when available', () => {
  const projectRoot = createTempProjectRoot();

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: { MAX_RETRIES: '0' },
    argv: []
  });

  assert.equal(result.ok, false);
  const retriesError = result.errors.find(e => e.field === 'MAX_RETRIES');
  assert.ok(retriesError, 'Should have MAX_RETRIES error');
  assert.ok(retriesError.hint, 'Error should have a hint');
});

test('loadAndValidateConfig should accept same valid input as loadPipelineInfraConfig', () => {
  const projectRoot = createTempProjectRoot();
  const input = { env: {}, cwd: projectRoot, argv: [] };

  const directConfig = loadPipelineInfraConfig(input);
  const result = loadAndValidateConfig(input);

  assert.equal(result.ok, true);
  assert.deepEqual(result.config, directConfig);
});
