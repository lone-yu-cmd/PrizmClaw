import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  computeFeatureSlug,
  resolveFeaturePaths,
  resolveBugPaths,
  resolveDaemonLogPaths,
  DIRECTORY_CONVENTION,
  resolvePlansPaths
} from '../../src/pipeline-infra/path-policy.js';

const PROJECT_ROOT = '/tmp/prizmclaw-compat';
const SCRIPTS_DIR = path.resolve(process.cwd(), 'dev-pipeline/scripts');

function runPython(code) {
  const result = spawnSync('python3', ['-c', code], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PYTHONPATH: SCRIPTS_DIR
    }
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Python execution failed with status ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

test('Python and JS should compute identical feature slug', () => {
  const jsSlug = computeFeatureSlug('F-001', 'Project Infrastructure Setup');
  const py = runPython("import json; from path_policy import compute_feature_slug; print(json.dumps({'slug': compute_feature_slug('F-001', 'Project Infrastructure Setup')}))");

  assert.equal(py.slug, jsSlug);
});

test('Python and JS should resolve identical feature paths', () => {
  const js = resolveFeaturePaths({
    projectRoot: PROJECT_ROOT,
    featureId: 'F-001',
    title: 'Project Infrastructure Setup',
    sessionId: 'F-001-20260310020202'
  });

  const py = runPython(
    "import json; from path_policy import resolve_feature_paths; print(json.dumps(resolve_feature_paths('/tmp/prizmclaw-compat', 'F-001', 'Project Infrastructure Setup', 'F-001-20260310020202')))"
  );

  assert.deepEqual(py, js);
});

test('Python and JS should resolve identical bug and daemon log paths', () => {
  const jsBug = resolveBugPaths({
    projectRoot: PROJECT_ROOT,
    bugId: 'B-100',
    sessionId: 'B-100-20260310020202'
  });
  const jsDaemon = resolveDaemonLogPaths(PROJECT_ROOT);

  const py = runPython(
    "import json; from path_policy import resolve_bug_paths, resolve_daemon_log_paths; print(json.dumps({'bug': resolve_bug_paths('/tmp/prizmclaw-compat', 'B-100', 'B-100-20260310020202'), 'daemon': resolve_daemon_log_paths('/tmp/prizmclaw-compat')}))"
  );

  assert.deepEqual(py.bug, jsBug);
  assert.deepEqual(py.daemon, {
    featureDaemonLog: jsDaemon.featureDaemonLog,
    bugfixDaemonLog: jsDaemon.bugfixDaemonLog
  });
});

// F-001 T-012: DIRECTORY_CONVENTION parity tests
test('Python and JS should have identical DIRECTORY_CONVENTION keys and values', () => {
  const py = runPython(
    "import json; from path_policy import DIRECTORY_CONVENTION; print(json.dumps(DIRECTORY_CONVENTION))"
  );

  assert.deepEqual(py, { ...DIRECTORY_CONVENTION });
});

test('Python and JS should resolve identical plans paths', () => {
  const js = resolvePlansPaths(PROJECT_ROOT);
  const py = runPython(
    "import json; from path_policy import resolve_plans_paths; print(json.dumps(resolve_plans_paths('/tmp/prizmclaw-compat')))"
  );

  assert.deepEqual(py, js);
});
