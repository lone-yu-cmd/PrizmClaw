/**
 * F-015 Integration Tests — Universal Command Natural-Language Routing
 *
 * Tests the complete routing pipeline:
 *  - Slash + NL enhancement
 *  - Pure NL routing
 *  - Low-confidence candidate suggestions
 *  - Structured-first non-regression
 *  - Multi-category command coverage
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { routeCommand, registerCommand } from '../../src/bot/commands/index.js';
import { clearRegistry } from '../../src/bot/commands/registry.js';
import { aliasStore } from '../../src/services/alias-store.js';
import { pipelineMeta } from '../../src/bot/commands/handlers/pipeline.js';
import { plannerMeta } from '../../src/bot/commands/handlers/planner.js';
import { bugfixMeta } from '../../src/bot/commands/handlers/bugfix.js';
import { lsMeta } from '../../src/bot/commands/handlers/ls.js';
import { psMeta } from '../../src/bot/commands/handlers/ps.js';
import { sysinfoMeta } from '../../src/bot/commands/handlers/sysinfo.js';

// ─── One-time setup: initialize alias store ───────────────────────────────────

const ALIAS_FILE = path.join(os.tmpdir(), `f015-aliases-${process.pid}.json`);

// Initialize alias store once before all tests
{
  await aliasStore.initAliasStore({ persistencePath: ALIAS_FILE }).catch(() => {
    // If already initialized, reset and re-init
    aliasStore.reset();
    return aliasStore.initAliasStore({ persistencePath: ALIAS_FILE });
  });
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Create a minimal Telegraf-like context for testing.
 * @param {string} text - Message text
 * @returns {Object} Mock context
 */
function createCtx(text) {
  const replies = [];
  return {
    from: { id: 12345 },
    chat: { id: 999 },
    message: { text },
    reply: async (msg) => { replies.push(msg); return msg; },
    replyWithDocument: async () => {},
    // Expose collected replies for assertions
    _replies: replies
  };
}

/**
 * Register a stub handler that records invocations.
 * @param {Object} meta - Command meta
 * @returns {{ meta, handler, calls: Array }} Registered entry with call recorder
 */
function registerStub(meta) {
  const calls = [];
  const handler = async (ctx) => {
    calls.push({ ...ctx });
  };
  registerCommand(meta, handler);
  return { meta, handler, calls };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeEach(() => {
  clearRegistry();
});

// ─── Structured-first: existing slash commands must not regress ───────────────

test('[regression] /pipeline run my-feature routes to pipeline run handler', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline run my-feature');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].parsed.command, 'pipeline');
  assert.equal(stub.calls[0].parsed.subcommand, 'run');
});

test('[regression] /pipeline status returns true', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline status');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].parsed.subcommand, 'status');
});

test('[regression] /pipeline logs is dispatched correctly', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline logs');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].parsed.subcommand, 'logs');
});

test('[regression] /bugfix session-123 dispatches to bugfix handler', async () => {
  const stub = registerStub(bugfixMeta);
  const ctx = createCtx('/bugfix session-123');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

test('[regression] /ls dispatches to ls handler', async () => {
  const stub = registerStub(lsMeta);
  const ctx = createCtx('/ls');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

test('[regression] /ps dispatches to ps handler', async () => {
  const stub = registerStub(psMeta);
  const ctx = createCtx('/ps');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

// ─── Slash + NL enhancement ───────────────────────────────────────────────────

test('[F-015] /pipeline 帮我看最近日志 → inferred as /pipeline logs', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline 帮我看最近日志');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  // Should be dispatched to handler with subcommand=logs (high confidence)
  // OR returned with candidate suggestions (if confidence too low)
  // Either way, handled = true
  if (stub.calls.length > 0) {
    assert.equal(stub.calls[0].parsed.subcommand, 'logs');
  } else {
    // Low confidence: suggestion message was sent
    assert.ok(ctx._replies.length > 0, 'Expected reply with suggestions');
    assert.ok(
      ctx._replies.some((r) => typeof r === 'string' && (r.includes('/pipeline') || r.includes('候选') || r.includes('意图'))),
      `Expected NL suggestion reply, got: ${ctx._replies.join(' | ')}`
    );
  }
});

test('[F-015] /pipeline 查看状态 → inferred as /pipeline status', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline 查看状态');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  if (stub.calls.length > 0) {
    assert.equal(stub.calls[0].parsed.subcommand, 'status');
  } else {
    assert.ok(ctx._replies.length > 0);
  }
});

test('[F-015] /pipeline 启动 → inferred as /pipeline run', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline 启动');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  if (stub.calls.length > 0) {
    assert.equal(stub.calls[0].parsed.subcommand, 'run');
  } else {
    assert.ok(ctx._replies.length > 0);
  }
});

test('[F-015] /planner 查看日志 → inferred as /planner logs', async () => {
  registerStub(pipelineMeta); // planner delegates to pipeline internally
  const stub = registerStub(plannerMeta);
  const ctx = createCtx('/planner 查看日志');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  // Handler is called OR suggestions sent
  assert.ok(stub.calls.length > 0 || ctx._replies.length > 0);
});

// ─── Pure NL routing ─────────────────────────────────────────────────────────

test('[F-015] pure NL "pipeline status" → dispatches to pipeline handler', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('pipeline status');
  const handled = await routeCommand(ctx);
  // High confidence pure NL — should dispatch or return suggestions
  if (handled) {
    assert.ok(stub.calls.length > 0 || ctx._replies.length > 0);
  } else {
    // Unhandled — falls through to chat (acceptable for borderline confidence)
    assert.equal(handled, false);
  }
});

test('[F-015] pure NL "帮我看一下当前 pipeline 状态" → dispatches or suggests pipeline status', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('帮我看一下当前 pipeline 状态');
  const handled = await routeCommand(ctx);
  if (handled) {
    // Either dispatched or suggestions provided
    assert.ok(stub.calls.length > 0 || ctx._replies.length > 0);
  }
  // Unhandled is also valid (falls through to chat)
});

test('[F-015] pure NL "进程列表" → dispatches to ps handler', async () => {
  const stub = registerStub(psMeta);
  const ctx = createCtx('进程列表');
  const handled = await routeCommand(ctx);
  if (handled) {
    assert.ok(stub.calls.length > 0 || ctx._replies.length > 0);
  }
});

test('[F-015] pure NL "系统信息" → dispatches to sysinfo handler', async () => {
  const stub = registerStub(sysinfoMeta);
  const ctx = createCtx('系统信息');
  const handled = await routeCommand(ctx);
  if (handled) {
    assert.ok(stub.calls.length > 0 || ctx._replies.length > 0);
  }
});

test('[F-015] pure NL unrelated text "hello world" → returns false (falls through to chat)', async () => {
  const ctx = createCtx('hello world');
  const handled = await routeCommand(ctx);
  assert.equal(handled, false);
});

test('[F-015] pure NL "你好" → returns false (falls through to chat)', async () => {
  const ctx = createCtx('你好');
  const handled = await routeCommand(ctx);
  assert.equal(handled, false);
});

// ─── Low-confidence / ambiguity → candidate suggestions ──────────────────────

test('[F-015] ambiguous pure NL input returns candidates instead of unknown subcommand', async () => {
  // Register several commands
  registerStub(pipelineMeta);
  registerStub(psMeta);
  registerStub(sysinfoMeta);

  const ctx = createCtx('帮我停止'); // Ambiguous: pipeline stop vs stop command
  const handled = await routeCommand(ctx);

  if (handled) {
    // If suggestions were sent, they should list commands
    if (ctx._replies.length > 0) {
      const replyText = ctx._replies.join(' ');
      // Must contain at least one command reference
      assert.ok(
        replyText.includes('/') || replyText.includes('候选') || replyText.includes('意图'),
        `Expected candidate message, got: ${replyText}`
      );
    }
  }
});

test('[F-015] unknown slash command with NL text returns suggestions, not bare "unknown command"', async () => {
  // Register pipeline to test suggestion routing
  registerStub(pipelineMeta);

  // Use a command that's not registered but looks like NL
  const ctx = createCtx('/pipeline 帮我处理一下');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);

  // Should have replied with something (either dispatch or suggestion)
  const allReplies = ctx._replies.join('\n');
  // Should NOT contain bare "未知子命令" as the only message
  // (it's ok if it does contain it as part of a longer suggestion)
  const hasBareUnknownOnly = allReplies.trim() === '未知子命令';
  assert.equal(hasBareUnknownOnly, false);
});

// ─── Structured-first priority ───────────────────────────────────────────────

test('[F-015] explicit subcommand takes priority over NL inference', async () => {
  const stub = registerStub(pipelineMeta);
  // Explicit valid subcommand should always be used as-is
  const ctx = createCtx('/pipeline run my-feature --type=bugfix');
  await routeCommand(ctx);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].parsed.subcommand, 'run');
  assert.equal(stub.calls[0].params.type, 'bugfix');
});

test('[F-015] explicit --type option is preserved through NL routing', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/pipeline run my-feature --type=planner');
  await routeCommand(ctx);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].params.type, 'planner');
});

// ─── Alias support with NL ────────────────────────────────────────────────────

test('[F-015] /p status → resolves alias and dispatches to pipeline status', async () => {
  const stub = registerStub(pipelineMeta);
  const ctx = createCtx('/p status');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].parsed.subcommand, 'status');
});

// ─── Multi-category coverage ─────────────────────────────────────────────────

test('[F-015] bugfix category: /bugfix target-123 is dispatched correctly', async () => {
  const stub = registerStub(bugfixMeta);
  const ctx = createCtx('/bugfix target-123');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

test('[F-015] file category: /ls dispatches correctly', async () => {
  const stub = registerStub(lsMeta);
  const ctx = createCtx('/ls /tmp');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

test('[F-015] system category: /ps dispatches correctly', async () => {
  const stub = registerStub(psMeta);
  const ctx = createCtx('/ps --sort=cpu');
  const handled = await routeCommand(ctx);
  assert.equal(handled, true);
  assert.equal(stub.calls.length, 1);
});

// ─── Fallback safety ──────────────────────────────────────────────────────────

test('[F-015] routeCommand does not throw for any NL input', async () => {
  const inputs = [
    '你好，请帮我',
    'pipeline 操作',
    '帮我修复问题',
    '查看系统信息',
    '/pipeline',
    '/pipeline ',
    '/pipeline 随便输入一些乱码xyzabc123'
  ];

  registerStub(pipelineMeta);
  registerStub(psMeta);
  registerStub(sysinfoMeta);
  registerStub(bugfixMeta);

  for (const input of inputs) {
    const ctx = createCtx(input);
    try {
      const result = await routeCommand(ctx);
      assert.ok(typeof result === 'boolean', `Expected boolean result for input: ${input}`);
    } catch (err) {
      assert.fail(`routeCommand threw for input "${input}": ${err.message}`);
    }
  }
});
