/**
 * Tests for F-010 /ls command handler
 * T-011: Create ls.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('F-010 /ls Command Handler', () => {
  let lsHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const lsModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/ls.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(lsModulePath.href);
    lsHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('lsMeta', () => {
    test('should export lsMeta with command metadata', async () => {
      assert.ok(lsHandler.lsMeta);
      assert.equal(lsHandler.lsMeta.name, 'ls');
      assert.ok(lsHandler.lsMeta.description);
      assert.ok(lsHandler.lsMeta.usage);
    });

    test('should have dir alias', async () => {
      assert.ok(lsHandler.lsMeta.aliases);
      assert.ok(lsHandler.lsMeta.aliases.includes('dir'));
    });

    test('should require viewer role', async () => {
      assert.equal(lsHandler.lsMeta.minRole, 'viewer');
    });
  });

  describe('handleLs', () => {
    test('should be exported', async () => {
      assert.ok(lsHandler.handleLs);
      assert.ok(typeof lsHandler.handleLs === 'function');
    });

    test('should list current directory when no path provided', async () => {
      const { handleLs } = lsHandler;

      // Set cwd to /tmp
      sessionStore.setCwd('test-session-ls-1', '/tmp');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-ls-1',
        args: []
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show directory path and item count
      assert.ok(replies[0].includes('/tmp') || replies[0].includes('目录'));
    });

    test('should list specified directory', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-ls-2',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('/tmp'));
    });

    test('should handle non-existent directory', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-ls-3',
        args: ['/nonexistent/directory/path/12345']
      };

      await handleLs(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('❌'));
    });

    test('should format output with emojis and file info', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-ls-4',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      // Output should contain folder/file emojis
      const hasEmojis = replies.some(r => r.includes('📁') || r.includes('📄'));
      assert.ok(hasEmojis, 'Output should contain file/folder emojis');
    });

    test('should show item count', async () => {
      const { handleLs } = lsHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-ls-5',
        args: ['/tmp']
      };

      await handleLs(handlerCtx);

      // Should show count
      const hasCount = replies.some(r => r.includes('项') || r.includes('共'));
      assert.ok(hasCount, 'Output should show item count');
    });
  });
});
