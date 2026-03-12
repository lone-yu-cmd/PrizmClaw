/**
 * F-001: Project Infrastructure Setup — Integration Tests
 *
 * Covers all 4 user stories from spec.md:
 *   US-1: Unified config validation with batch error collection
 *   US-2: Standardized directory structure convention
 *   US-3: Reusable CLI entry wrapper
 *   US-4: TypeScript build and lint baseline
 *
 * Also verifies cross-module data flow and barrel exports.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Import everything through the barrel (index.js) — tests T-102 / AC re-exports
import {
  loadPipelineInfraConfig,
  loadAndValidateConfig,
  DIRECTORY_CONVENTION,
  resolvePlansPaths,
  EXIT_CODES,
  createCliEntry,
  INFRA_ERROR_CODES,
  createInfraError,
  isInfraErrorCode,
  computeFeatureSlug,
  resolveFeaturePaths,
  resolveBugPaths,
  resolveDaemonLogPaths,
} from '../../src/pipeline-infra/index.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const PYTHON_SCRIPTS_DIR = path.join(PROJECT_ROOT, 'dev-pipeline', 'scripts');

function createTempProjectRoot(prefix = 'prizmclaw-f001-integ-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'dev-pipeline'), { recursive: true });
  return root;
}

function runPythonJson(code) {
  const result = spawnSync('python3', ['-c', code], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONPATH: PYTHON_SCRIPTS_DIR },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `python3 exited ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

// ============================================================
// Section 1: Barrel Exports (T-102) — all F-001 symbols reachable
// ============================================================

test('INT-F001-EXPORTS: all F-001 symbols are importable from index.js', () => {
  // US-1: loadAndValidateConfig
  assert.equal(typeof loadAndValidateConfig, 'function');
  assert.equal(typeof loadPipelineInfraConfig, 'function');

  // US-2: DIRECTORY_CONVENTION + resolvePlansPaths
  assert.equal(typeof DIRECTORY_CONVENTION, 'object');
  assert.equal(typeof resolvePlansPaths, 'function');

  // US-3: createCliEntry + EXIT_CODES
  assert.equal(typeof createCliEntry, 'function');
  assert.equal(typeof EXIT_CODES, 'object');

  // Pre-existing (backward-compat)
  assert.equal(typeof INFRA_ERROR_CODES, 'object');
  assert.equal(typeof createInfraError, 'function');
  assert.equal(typeof isInfraErrorCode, 'function');
  assert.equal(typeof computeFeatureSlug, 'function');
  assert.equal(typeof resolveFeaturePaths, 'function');
  assert.equal(typeof resolveBugPaths, 'function');
  assert.equal(typeof resolveDaemonLogPaths, 'function');
});

// ============================================================
// Section 2: US-1 — Unified Config Validation (batch errors)
// ============================================================

test('INT-F001-US1-AC1.1: loadAndValidateConfig collects ALL errors at once', () => {
  // Provide a project root without dev-pipeline AND several invalid integers
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-nopipe-'));

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: {
      MAX_RETRIES: 'not-a-number',
      SESSION_TIMEOUT: '-99',
      HEARTBEAT_INTERVAL: '0',
      PRIZMKIT_PLATFORM: 'unsupported',
    },
    argv: [],
  });

  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  // At minimum: pipelineDir missing, MAX_RETRIES, HEARTBEAT_INTERVAL, PRIZMKIT_PLATFORM
  assert.ok(result.errors.length >= 4, `Expected >= 4 errors, got ${result.errors.length}: ${JSON.stringify(result.errors.map(e => e.field))}`);
  assert.equal(result.config, undefined);

  const fields = result.errors.map(e => e.field);
  assert.ok(fields.includes('pipelineDir'), 'Should report pipelineDir missing');
  assert.ok(fields.includes('MAX_RETRIES'), 'Should report MAX_RETRIES error');
  assert.ok(fields.includes('HEARTBEAT_INTERVAL'), 'Should report HEARTBEAT_INTERVAL error');
  assert.ok(fields.includes('PRIZMKIT_PLATFORM'), 'Should report PRIZMKIT_PLATFORM error');
});

test('INT-F001-US1-AC1.2: each error includes field, message, hint, code', () => {
  const projectRoot = createTempProjectRoot();

  const result = loadAndValidateConfig({
    cwd: projectRoot,
    env: { MAX_RETRIES: '-1' },
    argv: [],
  });

  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.field === 'MAX_RETRIES');
  assert.ok(err, 'Should have a MAX_RETRIES error');
  assert.equal(typeof err.field, 'string');
  assert.equal(typeof err.message, 'string');
  assert.ok(err.message.length > 0);
  assert.ok(err.hint, 'Error should include a hint for resolution');
  assert.equal(typeof err.code, 'string');
  assert.equal(err.code, INFRA_ERROR_CODES.CONFIG_INVALID);
});

test('INT-F001-US1-AC1.3: valid config returns frozen object', () => {
  const projectRoot = createTempProjectRoot();

  const result = loadAndValidateConfig({ cwd: projectRoot, env: {}, argv: [] });

  assert.equal(result.ok, true);
  assert.ok(result.config);
  assert.ok(Object.isFrozen(result.config), 'Config should be frozen');
  assert.equal(result.config.projectRoot, projectRoot);
  assert.equal(result.errors, undefined);
});

test('INT-F001-US1-AC1.3: loadAndValidateConfig returns same config shape as loadPipelineInfraConfig', () => {
  const projectRoot = createTempProjectRoot();
  const input = { cwd: projectRoot, env: {}, argv: [] };

  const direct = loadPipelineInfraConfig(input);
  const batch = loadAndValidateConfig(input);

  assert.equal(batch.ok, true);
  assert.deepEqual(batch.config, direct);
});

test('INT-F001-US1-AC1.4: startup log is emitted in src/index.js (structural check)', () => {
  // We verify the startup summary log fields exist in src/index.js by reading the file content
  // (actual runtime is verified by the existing f001-user-stories US4 test)
  const indexContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/index.js'), 'utf-8');
  assert.ok(indexContent.includes('Config loaded successfully'), 'index.js should have startup summary log');
  assert.ok(indexContent.includes('enableTelegram'), 'Startup log should include enableTelegram');
  assert.ok(indexContent.includes('webPort'), 'Startup log should include webPort');
  assert.ok(indexContent.includes('pipelineDir'), 'Startup log should include pipelineDir');
  assert.ok(indexContent.includes('platform'), 'Startup log should include platform');
  assert.ok(indexContent.includes('logLevel'), 'Startup log should include logLevel');
});

// ============================================================
// Section 3: US-2 — Standardized Directory Structure Convention
// ============================================================

test('INT-F001-US2-AC2.1: DIRECTORY_CONVENTION has all spec-required keys', () => {
  const requiredKeys = [
    'pipelineDir', 'featureStateDir', 'bugfixStateDir',
    'featureListFile', 'bugFixListFile', 'plansDir',
    'specsDir', 'logsDir', 'sessionLogsDir', 'daemonLogFile',
  ];
  for (const key of requiredKeys) {
    assert.ok(key in DIRECTORY_CONVENTION, `Missing key: ${key}`);
    assert.equal(typeof DIRECTORY_CONVENTION[key], 'string');
    assert.ok(DIRECTORY_CONVENTION[key].length > 0, `${key} should be non-empty`);
  }
  assert.ok(Object.isFrozen(DIRECTORY_CONVENTION));
});

test('INT-F001-US2-AC2.1: DIRECTORY_CONVENTION values match plan spec exactly', () => {
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

test('INT-F001-US2-AC2.2: resolvePlansPaths returns absolute plansDir', () => {
  const result = resolvePlansPaths('/tmp/test-project');
  assert.equal(result.plansDir, path.join('/tmp/test-project', 'plans'));
  assert.ok(path.isAbsolute(result.plansDir));
});

test('INT-F001-US2-AC2.3: existing path functions remain backward-compatible', () => {
  const root = '/tmp/compat-test';

  const featurePaths = resolveFeaturePaths({
    projectRoot: root,
    featureId: 'F-002',
    title: 'Some Feature',
    sessionId: 'F-002-20250101',
  });
  assert.ok(featurePaths.specsDir.includes('.prizmkit/specs/'));
  assert.ok(featurePaths.sessionDir.includes('dev-pipeline/state/features/F-002'));

  const bugPaths = resolveBugPaths({
    projectRoot: root,
    bugId: 'B-010',
    sessionId: 'B-010-20250101',
  });
  assert.ok(bugPaths.bugDir.includes('dev-pipeline/bugfix-state/bugs/B-010'));

  const daemonPaths = resolveDaemonLogPaths(root);
  assert.ok(daemonPaths.featureDaemonLog.endsWith('pipeline-daemon.log'));
  assert.ok(daemonPaths.bugfixDaemonLog.endsWith('pipeline-daemon.log'));
});

test('INT-F001-US2-AC2.4: Python DIRECTORY_CONVENTION matches JS exactly', () => {
  const pyResult = runPythonJson(
    "import json; from path_policy import DIRECTORY_CONVENTION; print(json.dumps(DIRECTORY_CONVENTION))"
  );
  assert.deepEqual(pyResult, { ...DIRECTORY_CONVENTION });
});

test('INT-F001-US2-AC2.4: Python resolve_plans_paths matches JS', () => {
  const jsResult = resolvePlansPaths('/tmp/parity-test');
  const pyResult = runPythonJson(
    "import json; from path_policy import resolve_plans_paths; print(json.dumps(resolve_plans_paths('/tmp/parity-test')))"
  );
  assert.deepEqual(pyResult, jsResult);
});

// ============================================================
// Section 4: US-3 — Reusable CLI Entry Wrapper
// ============================================================

test('INT-F001-US3-AC3.1: createCliEntry returns { run, config, logger }', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'integ-test',
    argv: ['--project-root', projectRoot],
    exitFn: () => {},
  });

  assert.equal(typeof ctx.run, 'function');
  assert.ok(ctx.config, 'Should have config');
  assert.ok(Object.isFrozen(ctx.config), 'Config from CLI entry should be frozen');
  assert.ok(ctx.logger, 'Should have logger');
  assert.equal(typeof ctx.logger.info, 'function');
  assert.equal(typeof ctx.logger.error, 'function');
  assert.ok(ctx.flags instanceof Map);
  assert.ok(Array.isArray(ctx.positionalArgs));
});

test('INT-F001-US3-AC3.2: --help triggers exit code 2', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'integ-test',
    argv: ['--project-root', projectRoot, '--help'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, EXIT_CODES.USAGE_ERROR);
  assert.equal(exitCode, 2);
});

test('INT-F001-US3-AC3.2: unknown args trigger exit code 2', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'integ-test',
    argv: ['--project-root', projectRoot, '--totally-bogus'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, EXIT_CODES.USAGE_ERROR);
});

test('INT-F001-US3-AC3.2: unhandled errors in run() trigger exit code 1', async () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  const ctx = createCliEntry({
    name: 'integ-test',
    argv: ['--project-root', projectRoot],
    exitFn: (code) => { exitCode = code; },
  });

  await ctx.run(async () => {
    throw new Error('Simulated runtime failure');
  });

  assert.equal(exitCode, EXIT_CODES.RUNTIME_ERROR);
  assert.equal(exitCode, 1);
});

test('INT-F001-US3-AC3.2: successful run() triggers exit code 0', async () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  const ctx = createCliEntry({
    name: 'integ-test',
    argv: ['--project-root', projectRoot],
    exitFn: (code) => { exitCode = code; },
  });

  await ctx.run(async () => {
    // success — do nothing
  });

  assert.equal(exitCode, EXIT_CODES.SUCCESS);
  assert.equal(exitCode, 0);
});

test('INT-F001-US3-AC3.3: EXIT_CODES has correct values per convention', () => {
  assert.equal(EXIT_CODES.SUCCESS, 0);
  assert.equal(EXIT_CODES.RUNTIME_ERROR, 1);
  assert.equal(EXIT_CODES.USAGE_ERROR, 2);
  assert.equal(EXIT_CODES.TIMEOUT, 124);
  assert.ok(Object.isFrozen(EXIT_CODES));
});

test('INT-F001-US3-AC3.4: EXIT_CODES are documented in error-codes.js (structural)', () => {
  const errorCodesContent = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src/pipeline-infra/error-codes.js'),
    'utf-8'
  );
  assert.ok(errorCodesContent.includes('EXIT_CODES'), 'error-codes.js should export EXIT_CODES');
  assert.ok(errorCodesContent.includes('SUCCESS'), 'Should document SUCCESS');
  assert.ok(errorCodesContent.includes('RUNTIME_ERROR'), 'Should document RUNTIME_ERROR');
  assert.ok(errorCodesContent.includes('USAGE_ERROR'), 'Should document USAGE_ERROR');
  assert.ok(errorCodesContent.includes('TIMEOUT'), 'Should document TIMEOUT');
});

// ============================================================
// Section 5: US-4 — TypeScript Build and Lint Baseline
// ============================================================

test('INT-F001-US4-AC4.1: tsconfig.json includes src/**/*.js', () => {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'tsconfig.json'), 'utf-8'));
  assert.ok(tsconfig.include.includes('src/**/*.js'), 'tsconfig should include src/**/*.js');
});

test('INT-F001-US4-AC4.2: eslint.config.js has required rules baseline', () => {
  const eslintContent = fs.readFileSync(path.join(PROJECT_ROOT, 'eslint.config.js'), 'utf-8');
  const requiredRules = ['no-undef', 'no-debugger', 'no-duplicate-case', 'eqeqeq'];
  for (const rule of requiredRules) {
    assert.ok(eslintContent.includes(rule), `eslint.config.js should include rule: ${rule}`);
  }
});

test('INT-F001-US4-AC4.3: npm run typecheck passes', () => {
  const result = spawnSync('npm', ['run', 'typecheck'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, `typecheck failed: ${result.stderr || result.stdout}`);
});

test('INT-F001-US4-AC4.4: npm run lint passes with zero warnings', () => {
  const result = spawnSync('npm', ['run', 'lint'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, `lint failed: ${result.stderr || result.stdout}`);
});

// ============================================================
// Section 6: Cross-Module Data Flow Integration
// ============================================================

test('INT-F001-CROSS: CLI entry wrapper uses config-loader which uses error-codes (full chain)', () => {
  const projectRoot = createTempProjectRoot();
  let _exitCode = null;

  // createCliEntry internally calls loadPipelineInfraConfig which uses EXIT_CODES from error-codes
  const ctx = createCliEntry({
    name: 'cross-module-test',
    flags: {
      verbose: { type: 'boolean', default: false, description: 'Verbose mode' },
      count: { type: 'number', default: 1, description: 'Count' },
    },
    argv: ['--project-root', projectRoot, '--verbose', '--count', '42', 'pos1', 'pos2'],
    exitFn: (code) => { _exitCode = code; },
  });

  // Verify the full chain resolved correctly
  assert.equal(ctx.config.projectRoot, projectRoot);
  assert.ok(Object.isFrozen(ctx.config));
  assert.equal(ctx.flags.get('verbose'), true);
  assert.equal(ctx.flags.get('count'), 42);
  assert.deepEqual(ctx.positionalArgs, ['pos1', 'pos2']);
});

test('INT-F001-CROSS: loadAndValidateConfig and loadPipelineInfraConfig agree on valid input', () => {
  const projectRoot = createTempProjectRoot();
  const input = {
    cwd: projectRoot,
    env: { AI_CLI: 'cbc', MAX_RETRIES: '5' },
    argv: [],
  };

  const failFast = loadPipelineInfraConfig(input);
  const batch = loadAndValidateConfig(input);

  assert.equal(batch.ok, true);
  assert.deepEqual(batch.config, failFast);
});

test('INT-F001-CROSS: DIRECTORY_CONVENTION.plansDir is used by resolvePlansPaths', () => {
  const root = '/tmp/cross-check';
  const result = resolvePlansPaths(root);
  assert.equal(result.plansDir, path.join(root, DIRECTORY_CONVENTION.plansDir));
});

test('INT-F001-CROSS: DIRECTORY_CONVENTION.daemonLogFile matches resolveDaemonLogPaths output', () => {
  const root = '/tmp/cross-check';
  const daemonPaths = resolveDaemonLogPaths(root);
  const expectedPath = path.join(root, DIRECTORY_CONVENTION.daemonLogFile);
  assert.equal(daemonPaths.featureDaemonLog, expectedPath);
});

// ============================================================
// Section 7: Boundary Conditions and Edge Cases
// ============================================================

test('INT-F001-EDGE: loadAndValidateConfig with empty projectRoot fallback to cwd', () => {
  // When no --project-root and no PIPELINE_PROJECT_ROOT, falls back to cwd
  const projectRoot = createTempProjectRoot();
  const result = loadAndValidateConfig({ cwd: projectRoot, env: {}, argv: [] });
  assert.equal(result.ok, true);
  assert.equal(result.config.projectRoot, projectRoot);
});

test('INT-F001-EDGE: DIRECTORY_CONVENTION is truly immutable', () => {
  assert.throws(() => {
    // @ts-ignore
    DIRECTORY_CONVENTION.newKey = 'value';
  });
  assert.throws(() => {
    // @ts-ignore
    DIRECTORY_CONVENTION.pipelineDir = 'mutated';
  });
});

test('INT-F001-EDGE: EXIT_CODES is truly immutable', () => {
  assert.throws(() => {
    // @ts-ignore
    EXIT_CODES.SUCCESS = 99;
  });
  assert.throws(() => {
    // @ts-ignore
    EXIT_CODES.NEW_CODE = 42;
  });
});

test('INT-F001-EDGE: createCliEntry with missing required positional args exits 2', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'edge-test',
    requiredArgs: ['featureId', 'sessionId'],
    argv: ['--project-root', projectRoot, 'only-one-arg'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, EXIT_CODES.USAGE_ERROR);
});
