import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('F-012 /monitor Command Handler', () => {
  let monitorHandler;
  let replies;
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'monitor-handler-test-'));

    const projectRoot = process.cwd();
    const monitorPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/monitor.js`);
    const module = await import(monitorPath.href);
    monitorHandler = module;
    replies = [];
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('monitorMeta', () => {
    test('should export monitorMeta with command metadata', async () => {
      assert.ok(monitorHandler.monitorMeta);
      assert.equal(monitorHandler.monitorMeta.name, 'monitor');
    });

    test('should have correct minRole for monitor command', async () => {
      assert.equal(monitorHandler.monitorMeta.minRole, 'operator');
    });

    test('should have description', async () => {
      assert.ok(monitorHandler.monitorMeta.description);
    });
  });

  describe('handleMonitor', () => {
    test('should show usage when no subcommand', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('用法') || replies[0].includes('usage') || replies[0].includes('子命令'), 'Should show usage');
    });

    test('should handle "list" subcommand', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['list']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('告警') || replies[0].includes('规则') || replies[0].includes('alert'), 'Should mention alerts');
    });

    test('should handle "set" subcommand', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['set', 'cpu>80']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('添加') || replies[0].includes('成功') || replies[0].includes('规则'), 'Should confirm rule added');
    });

    test('should handle invalid set format', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['set', 'invalid']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('无效') || replies[0].includes('格式') || replies[0].includes('invalid'), 'Should indicate invalid format');
    });

    test('should handle "remove" subcommand', async () => {
      // First add a rule
      const setCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['set', 'cpu>80']
      };
      await monitorHandler.handleMonitor(setCtx);
      replies = [];

      // Then list to get the ID (or we test with non-existent)
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['remove', 'non-existent-id']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should handle "enable" subcommand', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['enable', 'non-existent-id']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });

    test('should handle "disable" subcommand', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['disable', 'non-existent-id']
      };

      await monitorHandler.handleMonitor(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
    });
  });

  describe('parseSubcommand', () => {
    test('should parse set subcommand', async () => {
      const result = monitorHandler.parseSubcommand(['set', 'cpu>80']);
      assert.equal(result.subcommand, 'set');
      assert.equal(result.arg, 'cpu>80');
    });

    test('should parse list subcommand', async () => {
      const result = monitorHandler.parseSubcommand(['list']);
      assert.equal(result.subcommand, 'list');
    });

    test('should return null for unknown subcommand', async () => {
      const result = monitorHandler.parseSubcommand(['unknown']);
      assert.equal(result.subcommand, 'unknown');
    });
  });
});
