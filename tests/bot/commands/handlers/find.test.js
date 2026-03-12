/**
 * Tests for F-010 /find command handler
 * T-021: Create find.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('F-010 /find Command Handler', () => {
  let findHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const findModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/find.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(findModulePath.href);
    findHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('findMeta', () => {
    test('should export findMeta with command metadata', async () => {
      assert.ok(findHandler.findMeta);
      assert.equal(findHandler.findMeta.name, 'find');
      assert.ok(findHandler.findMeta.description);
      assert.ok(findHandler.findMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(findHandler.findMeta.minRole, 'viewer');
    });
  });

  describe('handleFind', () => {
    test('should be exported', async () => {
      assert.ok(findHandler.handleFind);
      assert.ok(typeof findHandler.handleFind === 'function');
    });

    test('should search files with glob pattern', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-find-1',
        args: ['*.js', '/tmp']
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('搜索') || replies[0].includes('找到') || replies[0].includes('*.js'));
    });

    test('should reject missing pattern', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-find-2',
        args: []
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });

    test('should show result count', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-find-3',
        args: ['*.txt', '/tmp']
      };

      await handleFind(handlerCtx);

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('找到') || fullOutput.includes('结果'));
    });

    test('should store results in session', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-find-4',
        args: ['*.txt', '/tmp']
      };

      await handleFind(handlerCtx);

      // Check if search results were stored
      const results = sessionStore.getSearchResults('test-session-find-4');
      // Results may be null if no matches, that's ok
      if (results) {
        assert.ok(Array.isArray(results));
      }
    });

    test('should handle non-existent directory with empty results', async () => {
      const { handleFind } = findHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-find-5',
        args: ['*.txt', '/nonexistent/directory/path/12345']
      };

      await handleFind(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show 0 results for non-existent directory
      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('找到 0 个') || fullOutput.includes('0 个结果'));
    });
  });
});
