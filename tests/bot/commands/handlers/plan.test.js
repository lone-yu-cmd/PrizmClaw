/**
 * Tests for plan.js command handler
 * Covers T-101 through T-106 subcommands.
 *
 * These tests verify:
 * 1. The handler correctly parses and routes subcommands
 * 2. The handler formats responses correctly
 * 3. The handler validates inputs properly
 *
 * For service-level tests (version management, validation), see:
 * - tests/services/plan-ingestion-service.test.js
 * - tests/integration/f003-plan-ingestion.integration.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// T-101: /plan upload hint tests
// ============================================================
test('T-101: handlePlan with no subcommand shows upload hint', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  const reply = replies[0];
  assert.ok(reply.includes('计划文件管理') || reply.includes('上传'));
  assert.ok(reply.includes('/plan status'));
  assert.ok(reply.includes('/plan versions'));
});

// ============================================================
// T-102: /plan versions command tests
// ============================================================
test('T-102: handlePlan versions requires type argument', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'versions', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('请指定') || replies[0].includes('类型'));
});

// ============================================================
// T-103: /plan use command tests
// ============================================================
test('T-103: handlePlan use requires type argument', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'use', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('用法') || replies[0].includes('feature-list'));
});

test('T-103: handlePlan use requires version argument', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'use', args: ['feature-list'], options: {} },
    params: { _args: ['feature-list'] },
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('版本号') || replies[0].includes('v20'));
});

// ============================================================
// T-104: /plan status command tests
// ============================================================
test('T-104: handlePlan status works without arguments', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'status', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  // Should show status for both types
  const reply = replies[0];
  assert.ok(reply.includes('特性列表') || reply.includes('feature'));
  assert.ok(reply.includes('Bug') || reply.includes('bug'));
});

// ============================================================
// T-105: /plan rollback command tests
// ============================================================
test('T-105: handlePlan rollback requires type argument', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'rollback', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('用法') || replies[0].includes('feature-list'));
});

// ============================================================
// T-106: /plan validate command tests
// ============================================================
test('T-106: handlePlan validate shows help message', async () => {
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');
  const replies = [];

  await handlePlan({
    ctx: { from: { id: 12345 }, message: { text: '' } },
    parsed: { command: 'plan', subcommand: 'validate', args: [], options: {} },
    params: {},
    reply: async (text) => { replies.push(text); }
  });

  assert.ok(replies.length > 0);
  assert.ok(replies[0].includes('校验') || replies[0].includes('schema'));
  assert.ok(replies[0].includes('dev-pipeline-feature-list-v1'));
  assert.ok(replies[0].includes('dev-pipeline-bug-fix-list-v1'));
});

// ============================================================
// planMeta tests
// ============================================================
test('planMeta has correct metadata', async () => {
  const { planMeta } = await import('../../src/bot/commands/handlers/plan.js');

  assert.equal(planMeta.name, 'plan');
  assert.deepEqual(planMeta.aliases, ['p']);
  assert.ok(planMeta.subcommands.length > 0);
  assert.ok(planMeta.subcommands.some(s => s.name === 'status'));
  assert.ok(planMeta.subcommands.some(s => s.name === 'versions'));
  assert.ok(planMeta.subcommands.some(s => s.name === 'use'));
  assert.ok(planMeta.subcommands.some(s => s.name === 'rollback'));
  assert.ok(planMeta.subcommands.some(s => s.name === 'validate'));
  assert.equal(planMeta.requiresAuth, true);
});

// ============================================================
// Type normalization tests (via normalizePlanType indirectly)
// ============================================================
test('normalizePlanType accepts various formats', async () => {
  // Test that the handler accepts various type formats
  const { handlePlan } = await import('../../src/bot/commands/handlers/plan.js');

  const testCases = [
    { input: 'feature-list', expected: 'feature' },
    { input: 'feature', expected: 'feature' },
    { input: 'bug-fix-list', expected: 'bug' },
    { input: 'bugfix', expected: 'bug' },
    { input: 'bug', expected: 'bug' }
  ];

  for (const { input } of testCases) {
    const replies = [];
    await handlePlan({
      ctx: { from: { id: 12345 }, message: { text: '' } },
      parsed: { command: 'plan', subcommand: 'versions', args: [input], options: {} },
      params: { _args: [input] },
      reply: async (text) => { replies.push(text); }
    });
    // Should not show "please specify type" error for valid types
    assert.ok(!replies[0].includes('请指定') || replies[0].includes('历史版本') || replies[0].includes('暂无'),
      `Type "${input}" should be accepted`);
  }
});
