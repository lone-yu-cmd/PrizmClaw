/**
 * Tests for F-010 /tail command handler
 * T-019: Create tail.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('F-010 /tail Command Handler', () => {
  let tailHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const tailModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/tail.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(tailModulePath.href);
    tailHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('tailMeta', () => {
    test('should export tailMeta with command metadata', async () => {
      assert.ok(tailHandler.tailMeta);
      assert.equal(tailHandler.tailMeta.name, 'tail');
      assert.ok(tailHandler.tailMeta.description);
      assert.ok(tailHandler.tailMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(tailHandler.tailMeta.minRole, 'viewer');
    });
  });

  describe('handleTail', () => {
    test('should be exported', async () => {
      assert.ok(tailHandler.handleTail);
      assert.ok(typeof tailHandler.handleTail === 'function');
    });

    test('should show last 10 lines by default', async () => {
      const { handleTail } = tailHandler;

      // Create a test file with 20 lines
      const tmpFile = path.join('/tmp', `test-tail-${Date.now()}.txt`);
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(tmpFile, lines.join('\n'));

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-tail-1',
        args: [tmpFile]
      };

      await handleTail(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 11'));
      assert.ok(fullOutput.includes('Line 20'));
      assert.ok(!fullOutput.includes('Line 10'));
    });

    test('should show last N lines when specified', async () => {
      const { handleTail } = tailHandler;

      const tmpFile = path.join('/tmp', `test-tail-${Date.now()}.txt`);
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(tmpFile, lines.join('\n'));

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-tail-2',
        args: ['5', tmpFile]
      };

      await handleTail(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 16'));
      assert.ok(fullOutput.includes('Line 20'));
      assert.ok(!fullOutput.includes('Line 15'));
    });

    test('should handle files with fewer than N lines', async () => {
      const { handleTail } = tailHandler;

      const tmpFile = path.join('/tmp', `test-tail-${Date.now()}.txt`);
      await fs.writeFile(tmpFile, 'Line 1\nLine 2\nLine 3');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-tail-3',
        args: ['10', tmpFile]
      };

      await handleTail(handlerCtx);

      await fs.unlink(tmpFile).catch(() => {});

      const fullOutput = replies.join('\n');
      assert.ok(fullOutput.includes('Line 1'));
      assert.ok(fullOutput.includes('Line 3'));
    });

    test('should reject missing file path', async () => {
      const { handleTail } = tailHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-tail-4',
        args: []
      };

      await handleTail(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });
  });
});
