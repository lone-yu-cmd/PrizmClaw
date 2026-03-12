/**
 * Tests for F-013 /history command handler
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-013 /history Command Handler', () => {
  let historyHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const historyModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/history.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(historyModulePath.href);
    historyHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('historyMeta', () => {
    test('should export historyMeta with command metadata', async () => {
      assert.ok(historyHandler.historyMeta);
      assert.equal(historyHandler.historyMeta.name, 'history');
      assert.ok(historyHandler.historyMeta.description);
      assert.ok(historyHandler.historyMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(historyHandler.historyMeta.minRole, 'viewer');
    });

    test('should have h alias', async () => {
      assert.ok(historyHandler.historyMeta.aliases.includes('h'));
    });
  });

  describe('handleHistory', () => {
    test('should be exported', async () => {
      assert.ok(historyHandler.handleHistory);
      assert.ok(typeof historyHandler.handleHistory === 'function');
    });

    test('should show empty message when no history', async () => {
      const { handleHistory } = historyHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-history-empty',
        args: []
      };

      await handleHistory(handlerCtx);

      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('暂无命令历史'));
    });

    test('should show history with default count (10)', async () => {
      const { handleHistory } = historyHandler;

      // Add some command history
      const sessionId = 'test-session-history-10';
      for (let i = 0; i < 15; i++) {
        sessionStore.recordCommand(sessionId, `cmd${i}`, i % 2 === 0 ? 0 : 1);
      }

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId,
        args: []
      };

      await handleHistory(handlerCtx);

      assert.equal(replies.length, 1);
      // Should show 10 entries (default)
      const lines = replies[0].split('\n');
      // First line is header, then 10 command lines
      assert.ok(lines.length >= 11);
    });

    test('should respect count argument', async () => {
      const { handleHistory } = historyHandler;

      // Add some command history
      const sessionId = 'test-session-history-5';
      for (let i = 0; i < 20; i++) {
        sessionStore.recordCommand(sessionId, `cmd${i}`, 0);
      }

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId,
        args: ['5']
      };

      await handleHistory(handlerCtx);

      assert.equal(replies.length, 1);
      const lines = replies[0].split('\n');
      // Should show 5 entries
      assert.ok(lines.filter(l => l.match(/^\[\d+\]/)).length === 5);
    });

    test('should cap count at 100', async () => {
      const { handleHistory } = historyHandler;

      // Add lots of command history
      const sessionId = 'test-session-history-cap';
      for (let i = 0; i < 150; i++) {
        sessionStore.recordCommand(sessionId, `cmd${i}`, 0);
      }

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId,
        args: ['200'] // Request more than cap
      };

      await handleHistory(handlerCtx);

      const lines = replies[0].split('\n');
      // Should cap at 100
      assert.ok(lines.filter(l => l.match(/^\[\d+\]/)).length <= 100);
    });

    test('should reject invalid count argument', async () => {
      const { handleHistory } = historyHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-history-invalid',
        args: ['abc']
      };

      await handleHistory(handlerCtx);

      assert.ok(replies[0].includes('参数必须是正整数'));
    });

    test('should show exit code indicator', async () => {
      const { handleHistory } = historyHandler;

      const sessionId = 'test-session-history-exit';
      sessionStore.recordCommand(sessionId, 'ls', 0);
      sessionStore.recordCommand(sessionId, 'badcmd', 1);

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-6',
        sessionId,
        args: []
      };

      await handleHistory(handlerCtx);

      // Should contain checkmark for success and X for failure
      assert.ok(replies[0].includes('✓'));
      assert.ok(replies[0].includes('✗'));
    });

    test('should show most recent first', async () => {
      const { handleHistory } = historyHandler;

      const sessionId = 'test-session-history-order';
      sessionStore.recordCommand(sessionId, 'first', 0);
      sessionStore.recordCommand(sessionId, 'second', 0);
      sessionStore.recordCommand(sessionId, 'third', 0);

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-7',
        sessionId,
        args: []
      };

      await handleHistory(handlerCtx);

      const lines = replies[0].split('\n');
      // Find command lines
      const cmdLines = lines.filter(l => l.match(/^\[\d+\]/));
      // First should be "third" (most recent)
      assert.ok(cmdLines[0].includes('third'));
      // Last should be "first" (oldest)
      assert.ok(cmdLines[cmdLines.length - 1].includes('first'));
    });
  });
});
