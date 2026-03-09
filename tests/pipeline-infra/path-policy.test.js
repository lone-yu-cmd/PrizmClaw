import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  computeFeatureSlug,
  resolveFeaturePaths,
  resolveBugPaths,
  resolveDaemonLogPaths
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
