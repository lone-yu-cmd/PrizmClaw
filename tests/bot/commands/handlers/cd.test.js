/**
 * Tests for F-009 /cd command handler
 * T-4.1: Create /cd command handler
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

describe('F-009 /cd Command Handler', () => {
  let cdHandler;
  let sessionStore;

  beforeEach(async () => {
    // Use absolute paths from project root
    const projectRoot = process.cwd();
    const cdModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/cd.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(cdModulePath.href);
    cdHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('cdMeta', () => {
    test('should export cdMeta with command metadata', async () => {
      assert.ok(cdHandler.cdMeta);
      assert.equal(cdHandler.cdMeta.name, 'cd');
      assert.ok(cdHandler.cdMeta.description);
      assert.ok(cdHandler.cdMeta.usage);
    });

    test('should require operator role', async () => {
      assert.equal(cdHandler.cdMeta.minRole, 'operator');
    });
  });

  describe('handleCd', () => {
    test('should be exported', async () => {
      assert.ok(cdHandler.handleCd);
      assert.ok(typeof cdHandler.handleCd === 'function');
    });

    test('should update session cwd with valid directory', async () => {
      const { handleCd } = cdHandler;

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
        sessionId: 'test-session-cd-1'
      };

      // Use a valid directory (tmp)
      handlerCtx.args = ['/tmp'];

      await handleCd(handlerCtx);

      const cwd = sessionStore.getCwd('test-session-cd-1');
      assert.equal(cwd, '/tmp');
    });

    test('should reply with success message', async () => {
      const { handleCd } = cdHandler;

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
        sessionId: 'test-session-cd-2',
        args: [os.homedir()]
      };

      await handleCd(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes(os.homedir()) || replies[0].includes('已切换'));
    });

    test('should reject invalid directory', async () => {
      const { handleCd } = cdHandler;

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
        sessionId: 'test-session-cd-3',
        args: ['/nonexistent/directory/path/12345']
      };

      await handleCd(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('无效') || replies[0].includes('错误'));
    });

    test('should show current directory when no path provided', async () => {
      const { handleCd } = cdHandler;

      // Set a known cwd first
      sessionStore.setCwd('test-session-cd-4', '/tmp');

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        from: { id: 'test-user-4' },
        chat: { id: 'test-chat-4' }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-cd-4',
        args: []
      };

      await handleCd(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('/tmp') || replies[0].includes('当前'));
    });
  });
});
