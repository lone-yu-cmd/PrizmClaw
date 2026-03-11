/**
 * Tests for test helpers
 * F-007: Test and Validation Suite
 *
 * Verifies that all test helper modules work correctly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

// Import all helpers at module level
import {
  getFixturePath,
  loadFixture,
  loadJsonFixture,
  fixtureExists
} from './fixture-loader.js';

import {
  createMockRunner,
  createStatefulMockRunner
} from './mock-runner.js';

import {
  createMockContext,
  createAdminContext,
  createOperatorContext,
  createViewerContext,
  createDocumentContext,
  createCommandContext
} from './mock-telegram.js';

import {
  createTestStateDir,
  createTestPipelineDirs,
  writeTestState,
  readTestState,
  createTestPlan
} from './test-state.js';

// ============================================================
// Fixture Loader Tests
// ============================================================

test('fixture-loader: getFixturePath returns correct path', () => {
  const path = getFixturePath('plans/valid-feature-list.json');
  assert.ok(path.includes('fixtures'));
  assert.ok(path.includes('plans'));
  assert.ok(path.includes('valid-feature-list.json'));
});

test('fixture-loader: loadFixture loads file content', () => {
  const content = loadFixture('plans/valid-feature-list.json');
  assert.ok(content.includes('$schema'));
  assert.ok(content.includes('TestApp'));
});

test('fixture-loader: loadFixture throws for non-existent file', () => {
  assert.throws(
    () => loadFixture('non-existent-file.json'),
    /Fixture not found/
  );
});

test('fixture-loader: loadJsonFixture parses JSON correctly', () => {
  const data = loadJsonFixture('plans/valid-feature-list.json');
  assert.equal(data.$schema, 'dev-pipeline-feature-list-v1');
  assert.equal(data.app_name, 'TestApp');
  assert.ok(Array.isArray(data.features));
});

test('fixture-loader: loadJsonFixture throws for invalid JSON', () => {
  assert.throws(
    () => loadJsonFixture('plans/invalid-bad-json.json'),
    /Invalid JSON/
  );
});

test('fixture-loader: fixtureExists returns true for existing fixture', () => {
  assert.equal(fixtureExists('plans/valid-feature-list.json'), true);
});

test('fixture-loader: fixtureExists returns false for non-existing fixture', () => {
  assert.equal(fixtureExists('non-existent.json'), false);
});

// ============================================================
// Mock Runner Tests
// ============================================================

test('mock-runner: createMockRunner returns function', () => {
  const runner = createMockRunner();
  assert.equal(typeof runner, 'function');
});

test('mock-runner: returns default response for unmocked action', async () => {
  const runner = createMockRunner();
  const result = await runner({ action: 'unknown' });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedStatus, 'success');
});

test('mock-runner: returns configured response', async () => {
  const runner = createMockRunner({
    run: { ok: true, pid: 12345, runId: 'run-001' }
  });

  const result = await runner({ action: 'run' });
  assert.equal(result.ok, true);
  assert.equal(result.pid, 12345);
  assert.equal(result.runId, 'run-001');
});

test('mock-runner: supports response sequencing', async () => {
  const runner = createMockRunner({
    status: [
      { ok: true, isRunning: true },
      { ok: true, isRunning: false }
    ]
  });

  const result1 = await runner({ action: 'status' });
  assert.equal(result1.isRunning, true);

  const result2 = await runner({ action: 'status' });
  assert.equal(result2.isRunning, false);
});

test('mock-runner: callLog tracks calls', async () => {
  const runner = createMockRunner();
  await runner({ action: 'run', targetId: 'F-001' });
  await runner({ action: 'status' });

  const log = runner.getCallLog();
  assert.equal(log.length, 2);
  assert.equal(log[0].action, 'run');
  assert.equal(log[0].params.targetId, 'F-001');
});

test('mock-runner: getCalls filters by action', async () => {
  const runner = createMockRunner();
  await runner({ action: 'run' });
  await runner({ action: 'status' });
  await runner({ action: 'run' });

  const runCalls = runner.getCalls('run');
  assert.equal(runCalls.length, 2);
});

test('mock-runner: addResponse adds new response', async () => {
  const runner = createMockRunner();
  runner.addResponse('run', { ok: true, pid: 999 });

  const result = await runner({ action: 'run' });
  assert.equal(result.pid, 999);
});

test('mock-runner: createStatefulMockRunner tracks state', async () => {
  const runner = createStatefulMockRunner();
  let state = runner.getState();
  assert.equal(state.isRunning, false);

  await runner({ action: 'run' });
  state = runner.getState();
  assert.equal(state.isRunning, true);

  await runner({ action: 'stop' });
  state = runner.getState();
  assert.equal(state.isRunning, false);
});

test('mock-runner: createStatefulMockRunner prevents duplicate start', async () => {
  const runner = createStatefulMockRunner({ startRunning: true });
  const result = await runner({ action: 'run' });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'ALREADY_RUNNING');
});

// ============================================================
// Mock Telegram Tests
// ============================================================

test('mock-telegram: createMockContext creates context', () => {
  const ctx = createMockContext();
  assert.ok(ctx.message);
  assert.ok(ctx.chat);
  assert.ok(ctx.from);
  assert.equal(typeof ctx.reply, 'function');
});

test('mock-telegram: createMockContext applies overrides', () => {
  const ctx = createMockContext({
    message: { text: '/start' }
  });

  assert.equal(ctx.message.text, '/start');
});

test('mock-telegram: reply captures messages', async () => {
  const ctx = createMockContext();
  await ctx.reply('Hello');
  await ctx.reply('World');

  const replies = ctx._getReplies();
  assert.equal(replies.length, 2);
  assert.equal(replies[0].text, 'Hello');
  assert.equal(replies[1].text, 'World');
});

test('mock-telegram: _getLastReply returns last reply', async () => {
  const ctx = createMockContext();
  await ctx.reply('First');
  await ctx.reply('Last');

  const last = ctx._getLastReply();
  assert.equal(last.text, 'Last');
});

test('mock-telegram: createAdminContext sets admin permission', () => {
  const ctx = createAdminContext();
  assert.equal(ctx.state.permission, 'admin');
});

test('mock-telegram: createOperatorContext sets operator permission', () => {
  const ctx = createOperatorContext();
  assert.equal(ctx.state.permission, 'operator');
});

test('mock-telegram: createViewerContext sets viewer permission', () => {
  const ctx = createViewerContext();
  assert.equal(ctx.state.permission, 'viewer');
});

test('mock-telegram: createDocumentContext creates document message', () => {
  const ctx = createDocumentContext({
    file_name: 'test-plan.json',
    file_size: 2048
  });

  assert.ok(ctx.message.document);
  assert.equal(ctx.message.document.file_name, 'test-plan.json');
  assert.equal(ctx.message.document.file_size, 2048);
});

test('mock-telegram: createCommandContext creates command message', () => {
  const ctx = createCommandContext('/pipeline run --type=feature');
  assert.equal(ctx.message.text, '/pipeline run --type=feature');
});

// ============================================================
// Test State Tests
// ============================================================

test('test-state: createTestStateDir creates directory', async () => {
  const { path, cleanup } = await createTestStateDir();
  assert.ok(path);

  await cleanup();
});

test('test-state: createTestPipelineDirs creates full structure', async () => {
  const { tempDir, stateDir, bugfixStateDir, plansDir, cleanup } = await createTestPipelineDirs();

  assert.ok(tempDir);
  assert.ok(stateDir);
  assert.ok(bugfixStateDir);
  assert.ok(plansDir);

  await cleanup();
});

test('test-state: writeTestState and readTestState work together', async () => {
  const { path, cleanup } = await createTestStateDir();

  const testData = { foo: 'bar', nested: { value: 42 } };
  const filePath = join(path, 'test.json');

  await writeTestState(filePath, testData);
  const loaded = await readTestState(filePath);

  assert.deepEqual(loaded, testData);

  await cleanup();
});

test('test-state: readTestState returns null for non-existent file', async () => {
  const result = await readTestState('/non/existent/path.json');
  assert.equal(result, null);
});

test('test-state: createTestPlan creates plan file', async () => {
  const { plansDir, cleanup } = await createTestPipelineDirs();

  const planContent = {
    $schema: 'dev-pipeline-feature-list-v1',
    app_name: 'TestApp',
    features: []
  };

  const planPath = await createTestPlan(plansDir, 'feature-list', planContent);
  const loaded = await readTestState(planPath);

  assert.equal(loaded.app_name, 'TestApp');

  await cleanup();
});
