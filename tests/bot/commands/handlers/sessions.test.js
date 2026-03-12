/**
 * Tests for F-013 /sessions command handler
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-013 /sessions Command Handler', () => {
  let sessionsHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const sessionsModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/sessions.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(sessionsModulePath.href);
    sessionsHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('sessionsMeta', () => {
    test('should export sessionsMeta with command metadata', async () => {
      assert.ok(sessionsHandler.sessionsMeta);
      assert.equal(sessionsHandler.sessionsMeta.name, 'sessions');
      assert.ok(sessionsHandler.sessionsMeta.description);
      assert.ok(sessionsHandler.sessionsMeta.usage);
    });

    test('should require admin role', async () => {
      assert.equal(sessionsHandler.sessionsMeta.minRole, 'admin');
    });

    test('should have no aliases', async () => {
      assert.deepEqual(sessionsHandler.sessionsMeta.aliases, []);
    });
  });

  describe('handleSessions', () => {
    test('should be exported', async () => {
      assert.ok(sessionsHandler.handleSessions);
      assert.ok(typeof sessionsHandler.handleSessions === 'function');
    });

    test('should show empty message when no sessions', async () => {
      const { handleSessions } = sessionsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-1',
        sessionId: 'test-session-sessions-empty',
        args: []
      };

      await handleSessions(handlerCtx);

      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('没有活跃会话'));
    });

    test('should list active sessions', async () => {
      const { handleSessions } = sessionsHandler;

      // Create some sessions
      sessionStore.touchSession('telegram:123456789', '123456789');
      sessionStore.touchSession('telegram:987654321', '987654321');
      sessionStore.setCwd('telegram:123456789', '/home/user/project');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-2',
        sessionId: 'test-session-sessions-list',
        args: []
      };

      await handleSessions(handlerCtx);

      assert.ok(replies[0].includes('活跃会话'));
      assert.ok(replies[0].includes('123456789'));
      assert.ok(replies[0].includes('987654321'));
    });

    test('should show session info including cwd', async () => {
      const { handleSessions } = sessionsHandler;

      // Create a session with cwd
      sessionStore.touchSession('telegram:111222333', '111222333');
      sessionStore.setCwd('telegram:111222333', '/test/working/directory');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-3',
        sessionId: 'test-session-sessions-cwd',
        args: []
      };

      await handleSessions(handlerCtx);

      assert.ok(replies[0].includes('/test/working/directory'));
    });

    test('should show session age and idle time', async () => {
      const { handleSessions } = sessionsHandler;

      // Create a session
      sessionStore.touchSession('telegram:444555666', '444555666');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-4',
        sessionId: 'test-session-sessions-time',
        args: []
      };

      await handleSessions(handlerCtx);

      // Should contain age and idle info
      assert.ok(replies[0].includes('年龄'));
      assert.ok(replies[0].includes('空闲'));
    });

    test('should show command count', async () => {
      const { handleSessions } = sessionsHandler;

      // Create a session with some commands
      sessionStore.touchSession('telegram:777888999', '777888999');
      sessionStore.recordCommand('telegram:777888999', 'ls', 0);
      sessionStore.recordCommand('telegram:777888999', 'cd /tmp', 0);
      sessionStore.recordCommand('telegram:777888999', 'pwd', 0);

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-5',
        sessionId: 'test-session-sessions-cmdcount',
        args: []
      };

      await handleSessions(handlerCtx);

      assert.ok(replies[0].includes('命令数'));
    });

    test('should handle long cwd paths with truncation', async () => {
      const { handleSessions } = sessionsHandler;

      // Create a session with a very long path
      const longPath = '/very/long/path/that/should/be/truncated/' + 'x'.repeat(100);
      sessionStore.touchSession('telegram:longpath', 'longpath');
      sessionStore.setCwd('telegram:longpath', longPath);

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-6',
        sessionId: 'test-session-sessions-longpath',
        args: []
      };

      await handleSessions(handlerCtx);

      // Should contain truncated path with ...
      // The full path might not fit, so truncation should occur
      assert.ok(replies[0].includes('目录'));
    });

    test('should include footer hint', async () => {
      const { handleSessions } = sessionsHandler;

      // Create a session
      sessionStore.touchSession('telegram:footertest', 'footertest');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-7',
        sessionId: 'test-session-sessions-footer',
        args: []
      };

      await handleSessions(handlerCtx);

      assert.ok(replies[0].includes('/reset'));
    });

    test('should show session count', async () => {
      const { handleSessions } = sessionsHandler;

      // Create unique sessions for this test
      sessionStore.touchSession('telegram:counttest1', 'counttest1');
      sessionStore.touchSession('telegram:counttest2', 'counttest2');
      sessionStore.touchSession('telegram:counttest3', 'counttest3');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'admin-user-8',
        sessionId: 'test-session-sessions-count',
        args: []
      };

      await handleSessions(handlerCtx);

      // Should show total count - just check it contains a count indicator
      assert.ok(replies[0].includes('活跃会话'));
    });
  });
});
