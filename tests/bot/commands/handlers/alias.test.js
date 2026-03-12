/**
 * Tests for F-013 /alias command handler
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../../../fixtures/alias-handler-f013');
const testAliasesPath = path.join(testFixturesDir, 'aliases.json');

describe('F-013 /alias Command Handler', () => {
  let aliasHandler;
  let aliasStore;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testFixturesDir, { recursive: true });

    const projectRoot = process.cwd();
    const aliasModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/alias.js`);
    const storeModulePath = new URL(`file://${projectRoot}/src/services/alias-store.js`);

    const module = await import(aliasModulePath.href);
    aliasHandler = module;
    const storeModule = await import(storeModulePath.href);
    aliasStore = storeModule.aliasStore;
    aliasStore.reset();
    await aliasStore.initAliasStore({ persistencePath: testAliasesPath });
  });

  afterEach(async () => {
    // Clean up
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('aliasMeta', () => {
    test('should export aliasMeta with command metadata', async () => {
      assert.ok(aliasHandler.aliasMeta);
      assert.equal(aliasHandler.aliasMeta.name, 'alias');
      assert.ok(aliasHandler.aliasMeta.description);
      assert.ok(aliasHandler.aliasMeta.usage);
    });

    test('should require operator role', async () => {
      assert.equal(aliasHandler.aliasMeta.minRole, 'operator');
    });

    test('should have no aliases', async () => {
      assert.deepEqual(aliasHandler.aliasMeta.aliases, []);
    });
  });

  describe('handleAlias', () => {
    test('should be exported', async () => {
      assert.ok(aliasHandler.handleAlias);
      assert.ok(typeof aliasHandler.handleAlias === 'function');
    });

    test('should list empty aliases message', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-alias-1',
        args: []
      };

      await handleAlias(handlerCtx);

      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('还没有定义任何别名'));
    });

    test('should define an alias', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-alias-2',
        args: ['ll=ls -la']
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('已定义别名'));
      assert.ok(replies[0].includes('ll'));
      assert.ok(replies[0].includes('ls -la'));

      // Verify it was stored
      const cmd = aliasStore.getAlias('test-user-2', 'll');
      assert.equal(cmd, 'ls -la');
    });

    test('should list existing aliases', async () => {
      const { handleAlias } = aliasHandler;

      // Create some aliases
      await aliasStore.setAlias('test-user-3', 'll', 'ls -la');
      await aliasStore.setAlias('test-user-3', 'gp', 'git pull');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-3',
        sessionId: 'test-session-alias-3',
        args: []
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('ll = ls -la'));
      assert.ok(replies[0].includes('gp = git pull'));
    });

    test('should delete an alias', async () => {
      const { handleAlias } = aliasHandler;

      // Create an alias
      await aliasStore.setAlias('test-user-4', 'll', 'ls -la');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-4',
        sessionId: 'test-session-alias-4',
        args: ['del', 'll']
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('已删除别名'));

      // Verify it was deleted
      const cmd = aliasStore.getAlias('test-user-4', 'll');
      assert.equal(cmd, null);
    });

    test('should handle delete non-existent alias', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-5',
        sessionId: 'test-session-alias-5',
        args: ['del', 'nonexistent']
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('不存在'));
    });

    test('should handle delete without name', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-6',
        sessionId: 'test-session-alias-6',
        args: ['del']
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('用法'));
    });

    test('should reject invalid alias format', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-7',
        sessionId: 'test-session-alias-7',
        args: ['invalid-no-equals']
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('用法'));
    });

    test('should handle alias with spaces in command', async () => {
      const { handleAlias } = aliasHandler;

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-8',
        sessionId: 'test-session-alias-8',
        args: ['gpl=git', 'pull', 'origin', 'main']
      };

      await handleAlias(handlerCtx);

      // The handler joins args with space
      assert.ok(replies[0].includes('已定义别名'));
    });

    test('should isolate aliases by user', async () => {
      const { handleAlias } = aliasHandler;

      // User 1 creates alias
      await aliasStore.setAlias('user-1', 'll', 'ls -la');

      // User 2 should have no aliases
      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'user-2',
        sessionId: 'test-session-alias-user2',
        args: []
      };

      await handleAlias(handlerCtx);

      assert.ok(replies[0].includes('还没有定义任何别名'));
    });
  });
});
