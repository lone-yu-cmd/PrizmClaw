/**
 * Tests for F-020 /output command handler
 * src/bot/commands/handlers/output.js
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('/output Command Handler', () => {
  let outputModule;
  let mockOutputHistoryService;

  beforeEach(async () => {
    // We need to import the module fresh each time to avoid caching issues.
    // Since output.js depends on a singleton outputHistoryService, we test
    // the handler by passing a mock service in handlerCtx.

    const projectRoot = process.cwd();
    const modulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/output.js`);
    outputModule = await import(modulePath.href);

    // Create a fresh mock service for each test
    mockOutputHistoryService = {
      addOutput: () => {},
      getHistory: (sessionKey, count) => [],
      clearHistory: () => {}
    };
  });

  describe('outputMeta', () => {
    test('should export outputMeta with correct command name', () => {
      assert.ok(outputModule.outputMeta);
      assert.equal(outputModule.outputMeta.name, 'output');
    });

    test('should have description and usage', () => {
      assert.ok(outputModule.outputMeta.description);
      assert.ok(outputModule.outputMeta.usage);
    });

    test('should require viewer role', () => {
      assert.equal(outputModule.outputMeta.minRole, 'viewer');
    });

    test('should require auth', () => {
      assert.equal(outputModule.outputMeta.requiresAuth, true);
    });
  });

  describe('handleOutput', () => {
    test('should be exported as a function', () => {
      assert.ok(outputModule.handleOutput);
      assert.equal(typeof outputModule.handleOutput, 'function');
    });

    test('should show message when no history available', async () => {
      const { handleOutput } = outputModule;

      mockOutputHistoryService.getHistory = () => [];

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'test-chat' }, from: { id: 'test-user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user',
        sessionId: 'test-session',
        args: [],
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      assert.ok(replies.length > 0, 'Should have replied');
      // Message should indicate no history
      assert.ok(
        replies[0].includes('没有') || replies[0].includes('no') || replies[0].includes('暂无') || replies[0].includes('历史'),
        `Expected "no history" message, got: ${replies[0]}`
      );
    });

    test('should show history entries with default count of 5', async () => {
      const { handleOutput } = outputModule;

      const entries = [
        { prompt: 'ls -la', output: 'drwxr-xr-x ...', timestamp: Date.now() - 5000, index: 1 },
        { prompt: 'pwd', output: '/home/user', timestamp: Date.now() - 4000, index: 2 },
        { prompt: 'echo hello', output: 'hello', timestamp: Date.now() - 3000, index: 3 }
      ];

      mockOutputHistoryService.getHistory = (sessionKey, count) => {
        assert.equal(count, 5, 'Default count should be 5');
        return entries;
      };

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'test-chat' }, from: { id: 'test-user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user',
        sessionId: 'test-session',
        args: [],
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      assert.ok(replies.length > 0, 'Should have replied');
      // All entries should appear somewhere in the output
      const combined = replies.join('\n');
      assert.ok(combined.includes('ls -la'), 'Should include first prompt');
      assert.ok(combined.includes('pwd'), 'Should include second prompt');
      assert.ok(combined.includes('echo hello'), 'Should include third prompt');
    });

    test('should respect custom count from args', async () => {
      const { handleOutput } = outputModule;

      let requestedCount = null;
      mockOutputHistoryService.getHistory = (sessionKey, count) => {
        requestedCount = count;
        return [];
      };

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'test-chat' }, from: { id: 'test-user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['3'],
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      assert.equal(requestedCount, 3, 'Should request 3 entries');
    });

    test('should cap count at 20 (max)', async () => {
      const { handleOutput } = outputModule;

      let requestedCount = null;
      mockOutputHistoryService.getHistory = (sessionKey, count) => {
        requestedCount = count;
        return [];
      };

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'test-chat' }, from: { id: 'test-user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['100'], // exceeds max
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      assert.ok(requestedCount <= 20, `Count should be capped at 20, got ${requestedCount}`);
    });

    test('should use sessionId to query history', async () => {
      const { handleOutput } = outputModule;

      let queriedSession = null;
      mockOutputHistoryService.getHistory = (sessionKey, count) => {
        queriedSession = sessionKey;
        return [];
      };

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'my-chat' }, from: { id: 'my-user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'my-user',
        sessionId: 'my-session',
        args: [],
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      assert.ok(queriedSession !== null, 'Should have queried with a session key');
      // Session key should be based on the sessionId
      assert.ok(
        queriedSession.includes('my-session') || queriedSession === 'my-session' || queriedSession.includes('telegram:my-session'),
        `Session key should include sessionId, got: ${queriedSession}`
      );
    });

    test('should include truncated output preview in response', async () => {
      const { handleOutput } = outputModule;

      const longOutput = 'x'.repeat(500);
      const entries = [
        { prompt: 'test-cmd', output: longOutput, timestamp: Date.now(), index: 1 }
      ];

      mockOutputHistoryService.getHistory = () => entries;

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'chat' }, from: { id: 'user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'user',
        sessionId: 'session',
        args: [],
        outputHistoryService: mockOutputHistoryService
      };

      await handleOutput(handlerCtx);

      const combined = replies.join('\n');
      assert.ok(combined.includes('test-cmd'), 'Should show the prompt');
      // The 500-char output should be truncated in preview
      assert.ok(combined.length < 500 + 300, 'Response should not include full 500-char output verbatim plus overhead');
    });

    test('should handle invalid count arg gracefully', async () => {
      const { handleOutput } = outputModule;

      let requestedCount = null;
      mockOutputHistoryService.getHistory = (sessionKey, count) => {
        requestedCount = count;
        return [];
      };

      const replies = [];
      const handlerCtx = {
        ctx: { chat: { id: 'chat' }, from: { id: 'user' } },
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'user',
        sessionId: 'session',
        args: ['abc'], // invalid number
        outputHistoryService: mockOutputHistoryService
      };

      // Should not throw
      await assert.doesNotReject(async () => await handleOutput(handlerCtx));
      // Should fall back to default (5)
      assert.equal(requestedCount, 5, 'Invalid count should fall back to default 5');
    });
  });
});
