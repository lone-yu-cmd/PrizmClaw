/**
 * Tests for F-010 /cat command handler
 * T-015: Create cat.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('F-010 /cat Command Handler', () => {
  let catHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const catModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/cat.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(catModulePath.href);
    catHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('catMeta', () => {
    test('should export catMeta with command metadata', async () => {
      assert.ok(catHandler.catMeta);
      assert.equal(catHandler.catMeta.name, 'cat');
      assert.ok(catHandler.catMeta.description);
      assert.ok(catHandler.catMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(catHandler.catMeta.minRole, 'viewer');
    });
  });

  describe('handleCat', () => {
    test('should be exported', async () => {
      assert.ok(catHandler.handleCat);
      assert.ok(typeof catHandler.handleCat === 'function');
    });

    test('should display text file content', async () => {
      const { handleCat } = catHandler;

      // Create a temp file
      const tmpFile = path.join('/tmp', `test-cat-${Date.now()}.txt`);
      await fs.writeFile(tmpFile, 'Hello, World!\nLine 2\nLine 3');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-cat-1',
        args: [tmpFile]
      };

      await handleCat(handlerCtx);

      // Cleanup
      await fs.unlink(tmpFile).catch(() => {});

      assert.ok(replies.length > 0);
      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Hello, World!'));
    });

    test('should show file path and size info', async () => {
      const { handleCat } = catHandler;

      const tmpFile = path.join('/tmp', `test-cat-${Date.now()}.txt`);
      await fs.writeFile(tmpFile, 'Test content');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-cat-2',
        args: [tmpFile]
      };

      await handleCat(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('文件') || fullOutput.includes(tmpFile));
      assert.ok(fullOutput.includes('字节') || fullOutput.includes('大小'));
    });

    test('should handle non-existent file', async () => {
      const { handleCat } = catHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-cat-3',
        args: ['/nonexistent/file/path/12345.txt']
      };

      await handleCat(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('❌'));
    });

    test('should reject missing file path', async () => {
      const { handleCat } = catHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-cat-4',
        args: []
      };

      await handleCat(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });

    test('should handle binary file with warning', async () => {
      const { handleCat } = catHandler;

      // Create a binary file (with null bytes)
      const tmpFile = path.join('/tmp', `test-cat-bin-${Date.now()}.bin`);
      await fs.writeFile(tmpFile, Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]));

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-cat-5',
        args: [tmpFile]
      };

      await handleCat(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('二进制') || fullOutput.includes('binary'));
    });
  });
});
