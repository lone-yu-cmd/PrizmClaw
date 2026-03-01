/**
 * Tests for F-009 /more command handler
 * T-4.2: Create /more command handler
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 /more Command Handler', () => {
  let moreHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const moreModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/more.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(moreModulePath.href);
    moreHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('moreMeta', () => {
    test('should export moreMeta with command metadata', async () => {
      assert.ok(moreHandler.moreMeta);
      assert.equal(moreHandler.moreMeta.name, 'more');
      assert.ok(moreHandler.moreMeta.description);
      assert.ok(moreHandler.moreMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(moreHandler.moreMeta.minRole, 'viewer');
    });
  });

  describe('handleMore', () => {
    test('should be exported', async () => {
      assert.ok(moreHandler.handleMore);
      assert.ok(typeof moreHandler.handleMore === 'function');
    });

    test('should return next page when pages exist', async () => {
      const { handleMore } = moreHandler;

      // Setup: store pages in session
      sessionStore.setOutputPages('test-session-more-1', ['page 1 content', 'page 2 content']);

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        from: { id: 'test-user-1' },
        chat: { id: 'test-chat-1' }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-more-1'
      };

      await handleMore(handlerCtx);

      assert.ok(replies.length > 0);
      assert.equal(replies[0], 'page 1 content');
    });

    test('should indicate no more output when exhausted', async () => {
      const { handleMore } = moreHandler;

      // No pages set
      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        from: { id: 'test-user-2' },
        chat: { id: 'test-chat-2' }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-more-2'
      };

      await handleMore(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('没有更多') || replies[0].includes('no more'));
    });

    test('should consume pages sequentially', async () => {
      const { handleMore } = moreHandler;

      // Setup: store pages in session
      sessionStore.setOutputPages('test-session-more-3', ['first', 'second', 'third']);

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        from: { id: 'test-user-3' },
        chat: { id: 'test-chat-3' }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-more-3'
      };

      // First call
      await handleMore(handlerCtx);
      assert.equal(replies[0], 'first');

      // Second call
      await handleMore(handlerCtx);
      assert.equal(replies[1], 'second');

      // Third call
      await handleMore(handlerCtx);
      assert.equal(replies[2], 'third');

      // Fourth call - no more
      await handleMore(handlerCtx);
      assert.ok(replies[3].includes('没有更多') || replies[3].includes('no more'));
    });
  });
});
