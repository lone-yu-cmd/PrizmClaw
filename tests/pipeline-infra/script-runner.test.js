import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPipelineCommand,
  normalizePipelineResult
} from '../../src/pipeline-infra/script-runner.js';

const baseConfig = {
  projectRoot: '/repo',
  pipelineDir: '/repo/dev-pipeline'
};

test('buildPipelineCommand should map feature run/status/logs/reset actions', () => {
  const runCmd = buildPipelineCommand(
    { pipelineType: 'feature', action: 'run', targetId: 'F-001', listPath: '/repo/feature-list.json' },
    baseConfig
  );
  assert.equal(runCmd.command, '/repo/dev-pipeline/run.sh');
  assert.deepEqual(runCmd.args, ['run', 'F-001', '/repo/feature-list.json']);

  const logsCmd = buildPipelineCommand({ pipelineType: 'feature', action: 'logs' }, baseConfig);
  assert.equal(logsCmd.command, '/repo/dev-pipeline/launch-daemon.sh');
  assert.deepEqual(logsCmd.args, ['logs']);

  const resetCmd = buildPipelineCommand(
    { pipelineType: 'feature', action: 'reset', targetId: 'F-001', listPath: '/repo/feature-list.json' },
    baseConfig
  );
  assert.equal(resetCmd.command, '/repo/dev-pipeline/reset-feature.sh');
  assert.deepEqual(resetCmd.args, ['F-001', '--clean', '/repo/feature-list.json']);
});

test('buildPipelineCommand should map bugfix logs/retry/reset actions', () => {
  const logsCmd = buildPipelineCommand({ pipelineType: 'bugfix', action: 'logs' }, baseConfig);
  assert.equal(logsCmd.command, '/repo/dev-pipeline/launch-bugfix-daemon.sh');
  assert.deepEqual(logsCmd.args, ['logs']);

  const retryCmd = buildPipelineCommand(
    { pipelineType: 'bugfix', action: 'retry', targetId: 'B-001', listPath: '/repo/bug-fix-list.json' },
    baseConfig
  );
  assert.equal(retryCmd.command, '/repo/dev-pipeline/retry-bug.sh');
  assert.deepEqual(retryCmd.args, ['B-001', '/repo/bug-fix-list.json']);

  const resetCmd = buildPipelineCommand(
    { pipelineType: 'bugfix', action: 'reset', targetId: 'B-001', listPath: '/repo/bug-fix-list.json' },
    baseConfig
  );
  assert.equal(resetCmd.command, '/repo/dev-pipeline/scripts/update-bug-status.py');
  assert.deepEqual(resetCmd.args, [
    '--bug-list',
    '/repo/bug-fix-list.json',
    '--state-dir',
    '/repo/dev-pipeline/bugfix-state',
    '--bug-id',
    'B-001',
    '--project-root',
    '/repo',
    '--action',
    'clean'
  ]);
});

test('normalizePipelineResult should map exit outcomes to normalized status and error', () => {
  assert.deepEqual(
    normalizePipelineResult({ exitCode: 0, signal: null, stdout: 'ok', stderr: '' }),
    {
      ok: true,
      exitCode: 0,
      signal: undefined,
      stdout: 'ok',
      stderr: '',
      normalizedStatus: 'success',
      errorCode: undefined
    }
  );

  assert.equal(
    normalizePipelineResult({ exitCode: 124, signal: null, stdout: '', stderr: '' }).normalizedStatus,
    'timed_out'
  );

  const crashed = normalizePipelineResult({ exitCode: 143, signal: 'SIGTERM', stdout: '', stderr: '' });
  assert.equal(crashed.normalizedStatus, 'crashed');
  assert.equal(crashed.errorCode, 'EXEC_FAILED');

  const failed = normalizePipelineResult({ exitCode: 1, signal: null, stdout: '', stderr: 'err' });
  assert.equal(failed.normalizedStatus, 'failed');
  assert.equal(failed.errorCode, 'EXEC_FAILED');
});
