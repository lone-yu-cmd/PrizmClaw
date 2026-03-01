import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-012 /sysinfo Command Handler', () => {
  let sysinfoHandler;
  let replies;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const sysinfoPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/sysinfo.js`);
    const module = await import(sysinfoPath.href);
    sysinfoHandler = module;
    replies = [];
  });

  describe('sysinfoMeta', () => {
    test('should export sysinfoMeta with command metadata', async () => {
      assert.ok(sysinfoHandler.sysinfoMeta);
      assert.equal(sysinfoHandler.sysinfoMeta.name, 'sysinfo');
    });

    test('should have correct minRole for sysinfo command', async () => {
      assert.equal(sysinfoHandler.sysinfoMeta.minRole, 'viewer');
    });

    test('should have description', async () => {
      assert.ok(sysinfoHandler.sysinfoMeta.description);
    });
  });

  describe('handleSysinfo', () => {
    test('should return system info message', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      const reply = replies[0];

      // Should contain key system info sections
      assert.ok(reply.includes('CPU') || reply.includes('cpu'), 'Should mention CPU');
      assert.ok(reply.includes('内存') || reply.includes('Memory') || reply.includes('memory'), 'Should mention memory');
    });

    test('should format output with structured sections', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      // Should have structured output with tree-like indicators (├ └)
      assert.ok(reply.includes('├') || reply.includes('└'), 'Should have tree-style formatting');
    });

    test('should include hostname', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      assert.ok(reply.includes('主机') || reply.includes('Hostname') || reply.includes('hostname'), 'Should include hostname');
    });

    test('should include uptime', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await sysinfoHandler.handleSysinfo(handlerCtx);

      const reply = replies[0];
      assert.ok(reply.includes('运行时间') || reply.includes('Uptime') || reply.includes('uptime'), 'Should include uptime');
    });
  });
});
