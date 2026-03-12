/**
 * Tests for F-010 /head command handler
 * T-017: Create head.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('F-010 /head Command Handler', () => {
  let headHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const headModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/head.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(headModulePath.href);
    headHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('headMeta', () => {
    test('should export headMeta with command metadata', async () => {
      assert.ok(headHandler.headMeta);
      assert.equal(headHandler.headMeta.name, 'head');
      assert.ok(headHandler.headMeta.description);
      assert.ok(headHandler.headMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(headHandler.headMeta.minRole, 'viewer');
    });
  });

  describe('handleHead', () => {
    test('should be exported', async () => {
      assert.ok(headHandler.handleHead);
      assert.ok(typeof headHandler.handleHead === 'function');
    });

    test('should show first 10 lines by default', async () => {
      const { handleHead } = headHandler;

      // Create a test file with 20 lines
      const tmpFile = path.join('/tmp', `test-head-${Date.now()}.txt`);
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(tmpFile, lines.join('\n'));

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-head-1',
        args: [tmpFile]
      };

      await handleHead(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 1'));
      assert.ok(fullOutput.includes('Line 10'));
      assert.ok(!fullOutput.includes('Line 11'));
    });

    test('should show first N lines when specified', async () => {
      const { handleHead } = headHandler;

      const tmpFile = path.join('/tmp', `test-head-${Date.now()}.txt`);
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(tmpFile, lines.join('\n'));

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-head-2',
        args: ['5', tmpFile]
      };

      await handleHead(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 1'));
      assert.ok(fullOutput.includes('Line 5'));
      assert.ok(!fullOutput.includes('Line 6'));
      assert.ok(!fullOutput.includes('Line 10'));
    });

    test('should handle files with fewer than N lines', async () => {
      const { handleHead } = headHandler;

      const tmpFile = path.join('/tmp', `test-head-${Date.now()}.txt`);
      await fs.writeFile(tmpFile, 'Line 1\nLine 2\nLine 3');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-head-3',
        args: ['10', tmpFile]
      };

      await handleHead(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 1'));
      assert.ok(fullOutput.includes('Line 3'));
    });

    test('should reject missing file path', async () => {
      const { handleHead } = headHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-head-4',
        args: []
      };

      await handleHead(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });
  });
});
