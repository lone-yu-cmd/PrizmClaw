import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { loadPipelineInfraConfig } from '../../src/pipeline-infra/config-loader.js';
import { resolveFeaturePaths, resolveBugPaths, resolveDaemonLogPaths } from '../../src/pipeline-infra/path-policy.js';
import { createPipelineControlService } from '../../src/services/pipeline-control-service.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const PYTHON_SCRIPTS_DIR = path.join(PROJECT_ROOT, 'dev-pipeline', 'scripts');

function createTempProjectRoot(prefix = 'prizmclaw-f001-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'dev-pipeline'), { recursive: true });
  return root;
}

async function withPatchedEnv(patch, fn) {
  const backup = {};

  for (const key of Object.keys(patch)) {
    backup[key] = process.env[key];
    const value = patch[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      if (backup[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = backup[key];
      }
    }
  }
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  fs.chmodSync(filePath, 0o755);
}

function assertStructuredPipelineResult(result) {
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(typeof result.exitCode, 'number');
  assert.equal(typeof result.stdout, 'string');
  assert.equal(typeof result.stderr, 'string');
  assert.match(result.normalizedStatus, /^(success|failed|timed_out|crashed)$/);
}

function runPythonJson(code) {
  const result = spawnSync('python3', ['-c', code], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PYTHONPATH: PYTHON_SCRIPTS_DIR
    }
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `python3 failed with ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

test('US1: unified config loading and readable validation errors', () => {
  const projectRoot = createTempProjectRoot('prizmclaw-f001-us1-');

  const config = loadPipelineInfraConfig({
    cwd: '/unused',
    argv: ['--project-root', projectRoot, '--heartbeat-interval', '15'],
    env: {
      FEATURE_LIST_PATH: '/tmp/f001-feature-list.json',
      BUG_FIX_LIST_PATH: '/tmp/f001-bug-list.json',
      MAX_RETRIES: '5',
      SESSION_TIMEOUT: '120',
      AI_CLI: 'claude'
    }
  });

  assert.equal(config.projectRoot, projectRoot);
  assert.equal(config.featureListPath, '/tmp/f001-feature-list.json');
  assert.equal(config.bugFixListPath, '/tmp/f001-bug-list.json');
  assert.equal(config.maxRetries, 5);
  assert.equal(config.sessionTimeoutSec, 120);
  assert.equal(config.heartbeatIntervalSec, 15);
  assert.equal(config.platform, 'claude');

  assert.throws(
    () => loadPipelineInfraConfig({ cwd: projectRoot, env: { MAX_RETRIES: '0' }, argv: [] }),
    (error) => {
      assert.match(error.message, /MAX_RETRIES/);
      assert.match(error.message, /hint/i);
      assert.equal(error.code, 'CONFIG_INVALID');
      return true;
    }
  );
});

test('US2: path policy keeps stable naming and Python compatibility', () => {
  const jsFeature = resolveFeaturePaths({
    projectRoot: '/tmp/prizmclaw-f001-us2',
    featureId: 'F-001',
    title: 'Project Infrastructure Setup',
    sessionId: 'F-001-20260310020202'
  });

  assert.match(jsFeature.specsDir, /\.prizmkit\/specs\/001-project-infrastructure-setup$/);
  assert.match(jsFeature.sessionDir, /dev-pipeline\/state\/features\/F-001\/sessions\/F-001-20260310020202$/);
  assert.match(jsFeature.sessionStatus, /session-status\.json$/);

  const jsBug = resolveBugPaths({
    projectRoot: '/tmp/prizmclaw-f001-us2',
    bugId: 'B-001',
    sessionId: 'B-001-20260310020202'
  });
  assert.match(jsBug.sessionDir, /dev-pipeline\/bugfix-state\/bugs\/B-001\/sessions\/B-001-20260310020202$/);

  const daemonLogs = resolveDaemonLogPaths('/tmp/prizmclaw-f001-us2');
  assert.equal(daemonLogs.featureDaemonLog, '/tmp/prizmclaw-f001-us2/dev-pipeline/state/pipeline-daemon.log');
  assert.equal(daemonLogs.bugfixDaemonLog, '/tmp/prizmclaw-f001-us2/dev-pipeline/bugfix-state/pipeline-daemon.log');

  assert.throws(() => {
    resolveFeaturePaths({
      projectRoot: '/tmp/prizmclaw-f001-us2',
      featureId: '../F-001',
      title: 'Project Infrastructure Setup',
      sessionId: 'F-001-20260310020202'
    });
  }, /invalid path segment/i);

  assert.throws(() => {
    resolveBugPaths({
      projectRoot: '/tmp/prizmclaw-f001-us2',
      bugId: 'B-001',
      sessionId: '../../escape'
    });
  }, /invalid path segment/i);

  const pyFeature = runPythonJson(
    "import json; from path_policy import resolve_feature_paths; print(json.dumps(resolve_feature_paths('/tmp/prizmclaw-f001-us2','F-001','Project Infrastructure Setup','F-001-20260310020202')))"
  );
  const pyBug = runPythonJson(
    "import json; from path_policy import resolve_bug_paths; print(json.dumps(resolve_bug_paths('/tmp/prizmclaw-f001-us2','B-001','B-001-20260310020202')))"
  );

  assert.deepEqual(pyFeature, jsFeature);
  assert.deepEqual(pyBug, jsBug);
});

test('US3: pipeline-control service executes unified actions and maps edge results', async () => {
  const projectRoot = createTempProjectRoot('prizmclaw-f001-us3-');
  const pipelineDir = path.join(projectRoot, 'dev-pipeline');
  const featureListPath = path.join(projectRoot, 'feature-list.json');
  const bugListPath = path.join(projectRoot, 'bug-fix-list.json');

  fs.writeFileSync(featureListPath, JSON.stringify({ features: [] }), 'utf-8');
  fs.writeFileSync(bugListPath, JSON.stringify({ bugs: [] }), 'utf-8');

  writeExecutable(
    path.join(pipelineDir, 'run.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
action=\"\${1:-}\"
case \"$action\" in
  run)
    shift || true
    if [ \"\${SIMULATE_TIMEOUT:-0}\" = \"1\" ]; then sleep 1; fi
    if [ \"\${SIMULATE_FAIL:-0}\" = \"1\" ]; then
      echo \"feature-run-failed\" >&2
      exit 7
    fi
    echo \"feature-run:\${1:-all}\"
    ;;
  status)
    echo \"feature-status\"
    ;;
  reset)
    echo \"feature-reset\"
    ;;
  *)
    echo \"unsupported feature action\" >&2
    exit 2
    ;;
esac
`
  );

  writeExecutable(
    path.join(pipelineDir, 'run-bugfix.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
action=\"\${1:-}\"
case \"$action\" in
  run)
    shift || true
    echo \"bugfix-run:\${1:-all}\"
    ;;
  status)
    echo \"bugfix-status\"
    ;;
  reset)
    echo \"bugfix-reset\"
    ;;
  *)
    echo \"unsupported bugfix action\" >&2
    exit 2
    ;;
esac
`
  );

  writeExecutable(path.join(pipelineDir, 'launch-daemon.sh'), '#!/usr/bin/env bash\necho "feature-daemon-$1"\n');
  writeExecutable(path.join(pipelineDir, 'launch-bugfix-daemon.sh'), '#!/usr/bin/env bash\necho "bugfix-daemon-$1"\n');
  writeExecutable(path.join(pipelineDir, 'retry-feature.sh'), '#!/usr/bin/env bash\necho "feature-retry-$1"\n');
  writeExecutable(path.join(pipelineDir, 'retry-bug.sh'), '#!/usr/bin/env bash\necho "bugfix-retry-$1"\n');
  writeExecutable(
    path.join(pipelineDir, 'scripts', 'update-bug-status.py'),
    '#!/usr/bin/env python3\nimport argparse\nparser=argparse.ArgumentParser()\nparser.add_argument("--bug-id")\nparser.add_argument("--action")\nparser.add_argument("--bug-list")\nparser.add_argument("--state-dir")\nparser.add_argument("--project-root")\nargs=parser.parse_args()\nprint(f"bugfix-clean-{args.bug_id}-{args.action}")\n'
  );

  await withPatchedEnv(
    {
      PIPELINE_PROJECT_ROOT: projectRoot,
      PIPELINE_DIR: pipelineDir,
      FEATURE_LIST_PATH: featureListPath,
      BUG_FIX_LIST_PATH: bugListPath,
      AI_CLI: 'cbc',
      PRIZMKIT_PLATFORM: 'codebuddy'
    },
    async () => {
      const service = createPipelineControlService();

      const featureStart = await service.startPipeline({ pipelineType: 'feature', targetId: 'F-001' });
      assertStructuredPipelineResult(featureStart);
      assert.equal(featureStart.ok, true);
      assert.match(featureStart.stdout, /feature-run:F-001/);

      const featureLogs = await service.getPipelineLogs({ pipelineType: 'feature' });
      assertStructuredPipelineResult(featureLogs);
      assert.match(featureLogs.stdout, /feature-daemon-logs/);

      const featureRetryMissingId = await service.retryTarget({ pipelineType: 'feature' });
      assertStructuredPipelineResult(featureRetryMissingId);
      assert.equal(featureRetryMissingId.ok, false);
      assert.equal(featureRetryMissingId.errorCode, 'EXEC_FAILED');
      assert.match(featureRetryMissingId.stderr, /targetId is required/i);

      const timeoutResult = await service.startPipeline({
        pipelineType: 'feature',
        targetId: 'F-001',
        timeoutMs: 50,
        envOverrides: { SIMULATE_TIMEOUT: '1' }
      });
      assertStructuredPipelineResult(timeoutResult);
      assert.equal(timeoutResult.ok, false);
      assert.equal(timeoutResult.normalizedStatus, 'timed_out');
      assert.equal(timeoutResult.errorCode, 'EXEC_TIMEOUT');

      const nonZeroResult = await service.startPipeline({
        pipelineType: 'feature',
        targetId: 'F-001',
        envOverrides: { SIMULATE_FAIL: '1' }
      });
      assertStructuredPipelineResult(nonZeroResult);
      assert.equal(nonZeroResult.ok, false);
      assert.equal(nonZeroResult.normalizedStatus, 'failed');
      assert.equal(nonZeroResult.errorCode, 'EXEC_FAILED');
      assert.equal(nonZeroResult.exitCode, 7);
      assert.match(nonZeroResult.stderr, /feature-run-failed/);

      const bugStatus = await service.getPipelineStatus({ pipelineType: 'bugfix' });
      assertStructuredPipelineResult(bugStatus);
      assert.match(bugStatus.stdout, /bugfix-status/);

      const bugRetry = await service.retryTarget({ pipelineType: 'bugfix', targetId: 'B-001' });
      assertStructuredPipelineResult(bugRetry);
      assert.match(bugRetry.stdout, /bugfix-retry-B-001/);

      const bugReset = await service.resetTarget({ pipelineType: 'bugfix', targetId: 'B-001' });
      assertStructuredPipelineResult(bugReset);
      assert.match(bugReset.stdout, /bugfix-clean-B-001-clean/);

      fs.rmSync(path.join(pipelineDir, 'retry-bug.sh'));
      const missingScript = await service.retryTarget({ pipelineType: 'bugfix', targetId: 'B-001' });
      assertStructuredPipelineResult(missingScript);
      assert.equal(missingScript.ok, false);
      assert.equal(missingScript.errorCode, 'SCRIPT_NOT_FOUND');
    }
  );
});

test('US4: static checks run and start flow remains available with Telegram disabled', async () => {
  const typecheck = spawnSync('npm', ['run', 'typecheck'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8'
  });
  assert.equal(typecheck.status, 0, `typecheck failed: ${typecheck.stderr || typecheck.stdout}`);

  const lint = spawnSync('npm', ['run', 'lint'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8'
  });
  assert.equal(lint.status, 0, `lint failed: ${lint.stderr || lint.stdout}`);

  await new Promise((resolve, reject) => {
    const child = spawn('node', ['src/index.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ENABLE_TELEGRAM: 'false',
        WEB_PORT: '18787',
        PIPELINE_PROJECT_ROOT: PROJECT_ROOT
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let sawStartup = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`start command did not boot in time. Output: ${output}`));
    }, 8000);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      if (!sawStartup && text.includes('Web server running at')) {
        sawStartup = true;
        child.kill('SIGTERM');
      }
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!sawStartup) {
        reject(new Error(`start command exited before startup log. Output: ${output}`));
        return;
      }

      assert.equal(code, 0, `start process exited with ${code}. Output: ${output}`);
      resolve();
    });
  });
});
