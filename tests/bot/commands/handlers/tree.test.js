/**
 * Tests for F-010 /tree command handler
 * T-013: Create tree.test.js unit tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

describe('F-010 /tree Command Handler', () => {
  let treeHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const treeModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/tree.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(treeModulePath.href);
    treeHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('treeMeta', () => {
    test('should export treeMeta with command metadata', async () => {
      assert.ok(treeHandler.treeMeta);
      assert.equal(treeHandler.treeMeta.name, 'tree');
      assert.ok(treeHandler.treeMeta.description);
      assert.ok(treeHandler.treeMeta.usage);
    });

    test('should require viewer role', async () => {
      assert.equal(treeHandler.treeMeta.minRole, 'viewer');
    });
  });

  describe('handleTree', () => {
    test('should be exported', async () => {
      assert.ok(treeHandler.handleTree);
      assert.ok(typeof treeHandler.handleTree === 'function');
    });

    test('should show current directory tree', async () => {
      const { handleTree } = treeHandler;

      sessionStore.setCwd('test-session-tree-1', '/tmp');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-tree-1',
        args: []
      };

      await handleTree(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show tree structure markers
      assert.ok(replies[0].includes('目录树') || replies[0].includes('/tmp'));
    });

    test('should show specified directory tree', async () => {
      const { handleTree } = treeHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-tree-2',
        args: ['/tmp']
      };

      await handleTree(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('/tmp'));
    });

    test('should respect --depth option', async () => {
      const { handleTree } = treeHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-tree-3',
        args: ['/tmp', '--depth=1']
      };

      await handleTree(handlerCtx);

      assert.ok(replies.length > 0);
      // Should show depth info
      assert.ok(replies[0].includes('深度') || replies[0].includes('/tmp'));
    });

    test('should handle non-existent directory', async () => {
      const { handleTree } = treeHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-tree-4',
        args: ['/nonexistent/directory/path/12345']
      };

      await handleTree(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('不存在') || replies[0].includes('❌'));
    });

    test('should use ASCII tree characters', async () => {
      const { handleTree } = treeHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-tree-5',
        args: ['/tmp']
      };

      await handleTree(handlerCtx);

      // Tree output should contain tree characters
      const fullOutput = replies.join('\n');
      const hasTreeChars = fullOutput.includes('├') ||
                           fullOutput.includes('└') ||
                           fullOutput.includes('│') ||
                           fullOutput.includes('📁');
      assert.ok(hasTreeChars, 'Output should contain tree characters');
    });
  });
});
