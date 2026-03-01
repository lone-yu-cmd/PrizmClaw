import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-012 /ps Command Handler', () => {
  let psHandler;
  let replies;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const psPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/ps.js`);
    const module = await import(psPath.href);
    psHandler = module;
    replies = [];
  });

  describe('psMeta', () => {
    test('should export psMeta with command metadata', async () => {
      assert.ok(psHandler.psMeta);
      assert.equal(psHandler.psMeta.name, 'ps');
    });

    test('should have correct minRole for ps command', async () => {
      assert.equal(psHandler.psMeta.minRole, 'viewer');
    });

    test('should have description', async () => {
      assert.ok(psHandler.psMeta.description);
    });
  });

  describe('handlePs', () => {
    test('should return process list', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      const reply = replies[0];

      // Should contain process-related info
      assert.ok(reply.includes('进程') || reply.includes('PID') || reply.includes('pid'), 'Should mention processes');
    });

    test('should support --sort=cpu option', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['--sort=cpu']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should support --sort=memory option', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['--sort=memory']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should support filter keyword', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['node']
      };

      await psHandler.handlePs(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should limit process count by default', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await psHandler.handlePs(handlerCtx);

      // Check that we don't get an excessive number of processes
      const reply = replies[0];
      const lines = reply.split('\n').filter(l => l.trim());
      // Default limit is 20, plus header lines
      assert.ok(lines.length <= 30, 'Should limit process count');
    });
  });

  describe('parseOptions', () => {
    test('should parse sort option', async () => {
      const options = psHandler.parseOptions(['--sort=cpu']);
      assert.equal(options.sortBy, 'cpu');
    });

    test('should parse limit option', async () => {
      const options = psHandler.parseOptions(['--limit=5']);
      assert.equal(options.limit, 5);
    });

    test('should treat non-option args as filter', async () => {
      const options = psHandler.parseOptions(['node', 'server']);
      assert.equal(options.filter, 'node server');
    });

    test('should handle mixed options and filter', async () => {
      const options = psHandler.parseOptions(['--sort=memory', 'python']);
      assert.equal(options.sortBy, 'memory');
      assert.equal(options.filter, 'python');
    });
  });
});
