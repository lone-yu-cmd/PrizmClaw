import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { loadPipelineInfraConfig } from '../../src/pipeline-infra/config-loader.js';

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
