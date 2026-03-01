import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { createCliEntry } from '../../src/pipeline-infra/cli-entry.js';

function createTempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-cli-'));
  fs.mkdirSync(path.join(root, 'dev-pipeline'), { recursive: true });
  return root;
}

// =============================================================
// T-101: cli-entry unit tests
// =============================================================

test('createCliEntry returns context object with run, config, logger, flags, positionalArgs', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'test-script',
    argv: ['--project-root', projectRoot],
    exitFn: () => {},
  });

  assert.equal(typeof ctx.run, 'function');
  assert.ok(ctx.config);
  assert.ok(ctx.logger);
  assert.ok(ctx.flags instanceof Map);
  assert.ok(Array.isArray(ctx.positionalArgs));
});

test('createCliEntry parses --help flag and calls exitFn with USAGE_ERROR code', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'test-script',
    description: 'A test script',
    argv: ['--project-root', projectRoot, '--help'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, 2);
});

test('createCliEntry exits with USAGE_ERROR on unknown flags', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'test-script',
    flags: {
      verbose: { type: 'boolean', description: 'Verbose output' },
    },
    argv: ['--project-root', projectRoot, '--unknown-flag'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, 2);
});

test('createCliEntry parses custom flags correctly', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'test-script',
    flags: {
      verbose: { type: 'boolean', default: false, description: 'Verbose output' },
      count: { type: 'number', default: 5, description: 'Count' },
      name: { type: 'string', default: 'world', description: 'Name' },
    },
    argv: ['--project-root', projectRoot, '--verbose', '--count', '10', '--name', 'hello'],
    exitFn: () => {},
  });

  assert.equal(ctx.flags.get('verbose'), true);
  assert.equal(ctx.flags.get('count'), 10);
  assert.equal(ctx.flags.get('name'), 'hello');
});

test('createCliEntry uses flag defaults when not provided', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'test-script',
    flags: {
      verbose: { type: 'boolean', default: false, description: 'Verbose output' },
      count: { type: 'number', default: 42, description: 'Count' },
    },
    argv: ['--project-root', projectRoot],
    exitFn: () => {},
  });

  assert.equal(ctx.flags.get('verbose'), false);
  assert.equal(ctx.flags.get('count'), 42);
});

test('createCliEntry collects positional args', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'test-script',
    argv: ['--project-root', projectRoot, 'arg1', 'arg2'],
    exitFn: () => {},
  });

  assert.deepEqual(ctx.positionalArgs, ['arg1', 'arg2']);
});

test('createCliEntry exits with USAGE_ERROR when required args missing', () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  createCliEntry({
    name: 'test-script',
    requiredArgs: ['featureId', 'sessionId'],
    argv: ['--project-root', projectRoot, 'F-001'],
    exitFn: (code) => { exitCode = code; },
  });

  assert.equal(exitCode, 2);
});

test('run() wraps main function with error handling and exits 0 on success', async () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  const ctx = createCliEntry({
    name: 'test-script',
    argv: ['--project-root', projectRoot],
    exitFn: (code) => { exitCode = code; },
  });

  await ctx.run(async () => {
    // success
  });

  assert.equal(exitCode, 0);
});

test('run() exits with RUNTIME_ERROR code on unhandled error', async () => {
  const projectRoot = createTempProjectRoot();
  let exitCode = null;

  const ctx = createCliEntry({
    name: 'test-script',
    argv: ['--project-root', projectRoot],
    exitFn: (code) => { exitCode = code; },
  });

  await ctx.run(async () => {
    throw new Error('Something went wrong');
  });

  assert.equal(exitCode, 1);
});

test('createCliEntry logger is a pino-like logger instance', () => {
  const projectRoot = createTempProjectRoot();
  const ctx = createCliEntry({
    name: 'test-script',
    argv: ['--project-root', projectRoot],
    exitFn: () => {},
  });

  assert.equal(typeof ctx.logger.info, 'function');
  assert.equal(typeof ctx.logger.error, 'function');
  assert.equal(typeof ctx.logger.warn, 'function');
  assert.equal(typeof ctx.logger.debug, 'function');
});
