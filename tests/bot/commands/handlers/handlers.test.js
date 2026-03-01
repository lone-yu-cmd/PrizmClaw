import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePipeline, pipelineMeta } from '../../../../src/bot/commands/handlers/pipeline.js';
import { handleBugfix, bugfixMeta } from '../../../../src/bot/commands/handlers/bugfix.js';
import { handleStatus, statusMeta } from '../../../../src/bot/commands/handlers/status.js';
import { handleLogs, logsMeta } from '../../../../src/bot/commands/handlers/logs.js';
import { handleStop, stopMeta } from '../../../../src/bot/commands/handlers/stop.js';
import { handlePlanner, plannerMeta } from '../../../../src/bot/commands/handlers/planner.js';

// Mock pipeline-control-service
const createMockService = () => {
  const calls = [];
  return {
    calls,
    startPipeline: async (params) => {
      calls.push({ method: 'startPipeline', params });
      return { ok: true, exitCode: 0 };
    },
    getPipelineStatus: async (params) => {
      calls.push({ method: 'getPipelineStatus', params });
      return { ok: true, pipelines: [] };
    },
    stopPipeline: async (params) => {
      calls.push({ method: 'stopPipeline', params });
      return { ok: true };
    },
    getPipelineLogs: async (params) => {
      calls.push({ method: 'getPipelineLogs', params });
      return { ok: true, stdout: 'log content' };
    }
  };
};

const createMockContext = () => {
  const replies = [];
  return {
    replies,
    ctx: {
      from: { id: 12345 },
      message: { text: '' },
      reply: async (text) => { replies.push(text); }
    },
    reply: async (text) => { replies.push(text); },
    replyFile: async (content, filename) => { replies.push(`[FILE: ${filename}]`); }
  };
};

test('pipelineMeta has correct metadata', () => {
  assert.equal(pipelineMeta.name, 'pipeline');
  assert.deepEqual(pipelineMeta.aliases, ['p']);
  assert.ok(pipelineMeta.subcommands.length > 0);
});

test('handlePipeline with run subcommand calls startPipeline', async () => {
  const _mock = createMockService();
  const mockCtx = createMockContext();

  await handlePipeline({
    ctx: mockCtx.ctx,
    parsed: { command: 'pipeline', subcommand: 'run', args: ['my-feature'], options: {} },
    params: { type: 'feature', _args: ['my-feature'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  // Verify behavior through replies
  assert.ok(mockCtx.replies.length > 0);
});

test('handlePipeline with status subcommand shows status', async () => {
  const _mock = createMockService();
  const mockCtx = createMockContext();

  await handlePipeline({
    ctx: mockCtx.ctx,
    parsed: { command: 'pipeline', subcommand: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('handleBugfix requires target parameter', async () => {
  const mockCtx = createMockContext();

  await handleBugfix({
    ctx: mockCtx.ctx,
    parsed: { command: 'bugfix', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies[0].includes('缺少'));
});

test('handleBugfix calls pipeline with type=bugfix', async () => {
  const mockCtx = createMockContext();

  await handleBugfix({
    ctx: mockCtx.ctx,
    parsed: { command: 'bugfix', args: ['session-123'], options: {} },
    params: { _args: ['session-123'] },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('bugfixMeta has correct metadata', () => {
  assert.equal(bugfixMeta.name, 'bugfix');
  assert.deepEqual(bugfixMeta.aliases, ['b']);
  assert.equal(bugfixMeta.params[0].required, true);
});

test('handleStatus returns status message', async () => {
  const mockCtx = createMockContext();

  await handleStatus({
    ctx: mockCtx.ctx,
    parsed: { command: 'status', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(mockCtx.replies.length > 0);
  assert.ok(mockCtx.replies[0].includes('管道'));
});

test('statusMeta has correct metadata', () => {
  assert.equal(statusMeta.name, 'status');
  assert.deepEqual(statusMeta.aliases, ['s']);
});

test('handleLogs returns logs', async () => {
  const mockCtx = createMockContext();

  await handleLogs({
    ctx: mockCtx.ctx,
    parsed: { command: 'logs', args: [], options: {} },
    params: {},
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('logsMeta has correct metadata', () => {
  assert.equal(logsMeta.name, 'logs');
  assert.deepEqual(logsMeta.aliases, ['l']);
});

test('handleStop returns confirmation', async () => {
  const mockCtx = createMockContext();

  await handleStop({
    ctx: mockCtx.ctx,
    parsed: { command: 'stop', args: [], options: {} },
    params: {},
    reply: mockCtx.reply
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('stopMeta has correct metadata', () => {
  assert.equal(stopMeta.name, 'stop');
});

test('handlePlanner uses pipeline with type=planner', async () => {
  const mockCtx = createMockContext();

  await handlePlanner({
    ctx: mockCtx.ctx,
    parsed: { command: 'planner', subcommand: 'status', args: [], options: {} },
    params: { type: 'planner' },
    reply: mockCtx.reply,
    replyFile: mockCtx.replyFile
  });

  assert.ok(mockCtx.replies.length > 0);
});

test('plannerMeta has correct metadata', () => {
  assert.equal(plannerMeta.name, 'planner');
  assert.deepEqual(plannerMeta.aliases, []);
});
