/**
 * Tests for F-010 /download command handler
 * T-053: Create download.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('F-010 /download Command Handler', () => {
  let downloadHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const downloadModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/download.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(downloadModulePath.href);
    downloadHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('downloadMeta', () => {
    test('should export downloadMeta with command metadata', async () => {
      assert.ok(downloadHandler.downloadMeta);
      assert.equal(downloadHandler.downloadMeta.name, 'download');
      assert.ok(downloadHandler.downloadMeta.description);
      assert.ok(downloadHandler.downloadMeta.usage);
    });

    test('should have dl alias', async () => {
      assert.ok(downloadHandler.downloadMeta.aliases);
      assert.ok(downloadHandler.downloadMeta.aliases.includes('dl'));
    });

    test('should require operator role', async () => {
      assert.equal(downloadHandler.downloadMeta.minRole, 'operator');
    });
  });

  describe('handleDownload', () => {
    test('should be exported', async () => {
      assert.ok(downloadHandler.handleDownload);
      assert.ok(typeof downloadHandler.handleDownload === 'function');
    });

    test('should reject missing path', async () => {
      const { handleDownload } = downloadHandler;

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        replyWithDocument: async () => {},
        replyWithPhoto: async () => {}
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-download-1',
        args: []
      };

      await handleDownload(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });

    test('should handle non-existent file', async () => {
      const { handleDownload } = downloadHandler;

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        replyWithDocument: async () => {},
        replyWithPhoto: async () => {}
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-download-2',
        args: ['/nonexistent/file/path/12345.txt']
      };

      await handleDownload(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('❌'));
    });

    test('should reject directory path', async () => {
      const { handleDownload } = downloadHandler;

      const replies = [];
      const mockCtx = {
        reply: (msg) => replies.push(msg),
        replyWithDocument: async () => {},
        replyWithPhoto: async () => {}
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-download-3',
        args: ['/tmp']
      };

      await handleDownload(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('目录') || replies[0].includes('❌'));
    });

    test('should require operator role', async () => {
      // The role check is done by the command routing layer, not the handler itself
      assert.equal(downloadHandler.downloadMeta.minRole, 'operator');
    });
  });
});
