import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  computeFeatureSlug,
  resolveFeaturePaths,
  resolveBugPaths,
  resolveDaemonLogPaths,
  DIRECTORY_CONVENTION,
  resolvePlansPaths
} from '../../src/pipeline-infra/path-policy.js';

test('computeFeatureSlug should normalize id and title', () => {
  const slug = computeFeatureSlug('F-1', 'Project Infrastructure Setup!');
  assert.equal(slug, '001-project-infrastructure-setup');
});

test('resolveFeaturePaths should return standardized feature paths', () => {
  const projectRoot = '/tmp/prizmclaw';
  const paths = resolveFeaturePaths({
    projectRoot,
    featureId: 'F-001',
    title: 'Project Infrastructure Setup',
    sessionId: 'F-001-20260310010101'
  });

  assert.equal(paths.featureSlug, '001-project-infrastructure-setup');
  assert.equal(paths.specsDir, path.join(projectRoot, '.prizmkit/specs/001-project-infrastructure-setup'));
  assert.equal(
    paths.sessionDir,
    path.join(projectRoot, 'dev-pipeline/state/features/F-001/sessions/F-001-20260310010101')
  );
  assert.equal(paths.sessionLog, path.join(paths.sessionDir, 'logs/session.log'));
  assert.equal(paths.sessionStatus, path.join(paths.sessionDir, 'session-status.json'));
});

test('resolveBugPaths should return standardized bug paths', () => {
  const projectRoot = '/tmp/prizmclaw';
  const paths = resolveBugPaths({
    projectRoot,
    bugId: 'B-011',
    sessionId: 'B-011-20260310010101'
  });

  assert.equal(paths.bugDir, path.join(projectRoot, 'dev-pipeline/bugfix-state/bugs/B-011'));
  assert.equal(
    paths.sessionDir,
    path.join(projectRoot, 'dev-pipeline/bugfix-state/bugs/B-011/sessions/B-011-20260310010101')
  );
  assert.equal(paths.sessionLog, path.join(paths.sessionDir, 'logs/session.log'));
  assert.equal(paths.sessionStatus, path.join(paths.sessionDir, 'session-status.json'));
});

test('resolveDaemonLogPaths should include explicit daemon log policy', () => {
  const paths = resolveDaemonLogPaths('/tmp/prizmclaw');

  assert.equal(paths.featureDaemonLog, '/tmp/prizmclaw/dev-pipeline/state/pipeline-daemon.log');
  assert.equal(paths.bugfixDaemonLog, '/tmp/prizmclaw/dev-pipeline/bugfix-state/pipeline-daemon.log');
});

test('path resolvers should reject unsafe path segments', () => {
  assert.throws(() => {
    resolveFeaturePaths({
      projectRoot: '/tmp/prizmclaw',
      featureId: '../F-001',
      title: 'X',
      sessionId: 'bad'
    });
  }, /invalid path segment/i);

  assert.throws(() => {
    resolveBugPaths({
      projectRoot: '/tmp/prizmclaw',
      bugId: 'B-001',
      sessionId: '../../escape'
    });
  }, /invalid path segment/i);
});

// F-001 T-011: DIRECTORY_CONVENTION tests
test('DIRECTORY_CONVENTION should be a frozen object', () => {
  assert.ok(Object.isFrozen(DIRECTORY_CONVENTION));
});

test('DIRECTORY_CONVENTION should contain all required keys', () => {
  const requiredKeys = [
    'pipelineDir',
    'featureStateDir',
    'bugfixStateDir',
    'featureListFile',
    'bugFixListFile',
    'plansDir',
    'specsDir',
    'logsDir',
    'sessionLogsDir',
    'daemonLogFile',
  ];
  for (const key of requiredKeys) {
    assert.ok(key in DIRECTORY_CONVENTION, `Missing key: ${key}`);
    assert.equal(typeof DIRECTORY_CONVENTION[key], 'string', `${key} should be a string`);
  }
});

test('DIRECTORY_CONVENTION should have correct values', () => {
  assert.equal(DIRECTORY_CONVENTION.pipelineDir, 'dev-pipeline');
  assert.equal(DIRECTORY_CONVENTION.featureStateDir, 'dev-pipeline/state');
  assert.equal(DIRECTORY_CONVENTION.bugfixStateDir, 'dev-pipeline/bugfix-state');
  assert.equal(DIRECTORY_CONVENTION.featureListFile, 'feature-list.json');
  assert.equal(DIRECTORY_CONVENTION.bugFixListFile, 'bug-fix-list.json');
  assert.equal(DIRECTORY_CONVENTION.plansDir, 'plans');
  assert.equal(DIRECTORY_CONVENTION.specsDir, '.prizmkit/specs');
  assert.equal(DIRECTORY_CONVENTION.logsDir, 'logs');
  assert.equal(DIRECTORY_CONVENTION.daemonLogFile, 'dev-pipeline/state/pipeline-daemon.log');
});

test('DIRECTORY_CONVENTION values should all be non-empty strings', () => {
  for (const [key, value] of Object.entries(DIRECTORY_CONVENTION)) {
    assert.equal(typeof value, 'string', `${key} should be a string`);
    assert.ok(value.length > 0, `${key} should be non-empty`);
  }
});

// F-001 T-011: resolvePlansPaths tests
test('resolvePlansPaths should return plansDir based on projectRoot', () => {
  const result = resolvePlansPaths('/tmp/prizmclaw');
  assert.equal(result.plansDir, path.join('/tmp/prizmclaw', 'plans'));
});

test('resolvePlansPaths should resolve relative projectRoot', () => {
  const result = resolvePlansPaths('.');
  assert.equal(typeof result.plansDir, 'string');
  assert.ok(path.isAbsolute(result.plansDir));
});
