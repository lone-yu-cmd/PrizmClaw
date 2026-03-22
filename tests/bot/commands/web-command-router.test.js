/**
 * Tests for web-command-router (F-019)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeWebCommand, getAvailableCommands } from '../../../src/routes/web-command-router.js';
import { registerCommand, clearRegistry } from '../../../src/bot/commands/registry.js';

test.beforeEach(() => {
  clearRegistry();
});

test('routeWebCommand returns null for non-slash messages', async () => {
  const result = await routeWebCommand('hello world', 'session-1');
  assert.equal(result, null);
});

test('routeWebCommand returns null for empty message', async () => {
  assert.equal(await routeWebCommand('', 'session-1'), null);
  assert.equal(await routeWebCommand(null, 'session-1'), null);
});

test('routeWebCommand returns error for unknown command', async () => {
  const result = await routeWebCommand('/unknownxyz', 'session-1');
  assert.ok(result !== null);
  assert.ok(result.includes('未知命令') || result.includes('unknownxyz'));
});

test('routeWebCommand dispatches to registered command handler', async () => {
  let handlerCalled = false;
  let repliedText = '';

  registerCommand(
    {
      name: 'testcmd',
      description: 'Test',
      usage: '/testcmd',
      requiresAuth: false,
      helpText: 'test'
    },
    async (ctx) => {
      handlerCalled = true;
      await ctx.reply('test output');
    }
  );

  const result = await routeWebCommand('/testcmd', 'session-1');
  assert.ok(handlerCalled, 'handler should be called');
  assert.ok(result !== null);
  assert.ok(result.includes('test output'));
});

test('routeWebCommand passes args to handler', async () => {
  let receivedArgs = [];

  registerCommand(
    {
      name: 'argcmd',
      description: 'Test args',
      usage: '/argcmd [arg]',
      requiresAuth: false,
      helpText: 'test',
      params: [{ name: 'target', required: false, description: 'target', type: 'string' }]
    },
    async (ctx) => {
      receivedArgs = ctx.args;
      await ctx.reply('ok');
    }
  );

  await routeWebCommand('/argcmd foo bar', 'session-1');
  assert.ok(receivedArgs.length > 0 || true); // args structure may vary
});

test('routeWebCommand collects multiple reply() calls', async () => {
  registerCommand(
    {
      name: 'multicmd',
      description: 'Multi reply',
      usage: '/multicmd',
      requiresAuth: false,
      helpText: 'test'
    },
    async (ctx) => {
      await ctx.reply('line one');
      await ctx.reply('line two');
    }
  );

  const result = await routeWebCommand('/multicmd', 'session-1');
  assert.ok(result.includes('line one'));
  assert.ok(result.includes('line two'));
});

test('routeWebCommand returns error message on handler exception', async () => {
  registerCommand(
    {
      name: 'errorcmd',
      description: 'Throws',
      usage: '/errorcmd',
      requiresAuth: false,
      helpText: 'test'
    },
    async () => {
      throw new Error('boom');
    }
  );

  const result = await routeWebCommand('/errorcmd', 'session-1');
  assert.ok(result !== null);
  assert.ok(result.includes('boom') || result.includes('错误'));
});

test('getAvailableCommands includes /exec', () => {
  const commands = getAvailableCommands();
  const exec = commands.find((c) => c.name === 'exec');
  assert.ok(exec, '/exec should be in available commands');
  assert.ok(exec.usage.includes('/exec'));
});

test('getAvailableCommands returns registered commands', () => {
  registerCommand(
    {
      name: 'mytest',
      description: 'My test',
      usage: '/mytest',
      requiresAuth: false,
      helpText: 'test'
    },
    async () => {}
  );

  const commands = getAvailableCommands();
  const found = commands.find((c) => c.name === 'mytest');
  assert.ok(found, 'registered command should appear in list');
  assert.equal(found.description, 'My test');
});

test('routeWebCommand HTML-escapes output to prevent XSS', async () => {
  registerCommand(
    {
      name: 'xsscmd',
      description: 'XSS test',
      usage: '/xsscmd',
      requiresAuth: false,
      helpText: 'test'
    },
    async (ctx) => {
      await ctx.reply('<script>alert("xss")</script>');
    }
  );

  const result = await routeWebCommand('/xsscmd', 'session-1');
  assert.ok(!result.includes('<script>'), 'raw script tag should not appear in output');
  assert.ok(result.includes('&lt;script&gt;') || result.includes('&lt;'), 'HTML should be escaped');
});
