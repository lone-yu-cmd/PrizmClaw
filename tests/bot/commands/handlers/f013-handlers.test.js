/**
 * Tests for F-013 Command Handlers
 * Tasks 4.5-4.7: Tests for history, alias, and sessions handlers
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const testFixturesDir = path.join(__dirname, '../../fixtures/handlers-f013');
const testAliasPath = path.join(testFixturesDir, 'aliases.json');

describe('F-013 Command Handlers', () => {
  let sessionStore;
  let aliasStore;
  let handleHistory;
  let handleAlias;
  let handleSessions;

  beforeEach(async () => {
    // Clean up test fixtures directory
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testFixturesDir, { recursive: true });

    // Import modules using absolute paths
    const sessionModule = await import(path.join(projectRoot, 'src/services/session-store.js'));
    sessionStore = sessionModule.sessionStore;

    const aliasModule = await import(path.join(projectRoot, 'src/services/alias-store.js'));
    aliasStore = aliasModule.aliasStore;
    aliasStore.reset();
    await aliasStore.initAliasStore({ persistencePath: testAliasPath });

    const historyModule = await import(path.join(projectRoot, 'src/bot/commands/handlers/history.js'));
    handleHistory = historyModule.handleHistory;

    const aliasHandlerModule = await import(path.join(projectRoot, 'src/bot/commands/handlers/alias.js'));
    handleAlias = aliasHandlerModule.handleAlias;

    const sessionsModule = await import(path.join(projectRoot, 'src/bot/commands/handlers/sessions.js'));
    handleSessions = sessionsModule.handleSessions;
  });

  afterEach(async () => {
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  // Task 4.5: History Handler Tests
  describe('handleHistory', () => {
    test('should show empty message when no history', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-1',
        args: []
      };

      await handleHistory(ctx);

      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('暂无命令历史记录'));
    });

    test('should show command history with default count (10)', async () => {
      // Record some commands
      sessionStore.recordCommand('test-history-2', 'ls -la', 0);
      sessionStore.recordCommand('test-history-2', 'cd /tmp', 0);
      sessionStore.recordCommand('test-history-2', 'cat file.txt', 1);

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-2',
        args: []
      };

      await handleHistory(ctx);

      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('命令历史'));
      assert.ok(replies[0].includes('ls -la'));
      assert.ok(replies[0].includes('cd /tmp'));
      assert.ok(replies[0].includes('cat file.txt'));
    });

    test('should respect count argument', async () => {
      // Record 15 commands
      for (let i = 0; i < 15; i++) {
        sessionStore.recordCommand('test-history-3', `cmd${i}`, 0);
      }

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-3',
        args: ['5']
      };

      await handleHistory(ctx);

      assert.equal(replies.length, 1);
      // Should show only 5 commands
      assert.ok(replies[0].includes('5 条命令'));
    });

    test('should cap count at 100', async () => {
      // Record 50 commands
      for (let i = 0; i < 50; i++) {
        sessionStore.recordCommand('test-history-4', `cmd${i}`, 0);
      }

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-4',
        args: ['200'] // Request 200 but should cap at 100
      };

      await handleHistory(ctx);

      assert.ok(replies[0].includes('50 条命令')); // Only 50 exist
    });

    test('should reject invalid count argument', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-5',
        args: ['invalid']
      };

      await handleHistory(ctx);

      assert.ok(replies[0].includes('参数必须是正整数'));
    });

    test('should show exit code indicator', async () => {
      sessionStore.recordCommand('test-history-6', 'success-cmd', 0);
      sessionStore.recordCommand('test-history-6', 'fail-cmd', 1);

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        sessionId: 'test-history-6',
        args: []
      };

      await handleHistory(ctx);

      assert.ok(replies[0].includes('✓'));
      assert.ok(replies[0].includes('✗'));
    });
  });

  // Task 4.6: Alias Handler Tests
  describe('handleAlias', () => {
    test('should show empty message when no aliases', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: []
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('还没有定义任何别名'));
    });

    test('should define an alias', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: ['ll=ls', '-la']
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('已定义别名'));
      assert.ok(replies[0].includes('ll'));
      assert.ok(replies[0].includes('ls -la'));

      // Verify alias was stored
      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, 'ls -la');
    });

    test('should list all aliases', async () => {
      await aliasStore.setAlias('123456789', 'll', 'ls -la');
      await aliasStore.setAlias('123456789', 'gp', 'git pull');

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: []
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('ll'));
      assert.ok(replies[0].includes('ls -la'));
      assert.ok(replies[0].includes('gp'));
      assert.ok(replies[0].includes('git pull'));
    });

    test('should delete an alias', async () => {
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: ['del', 'll']
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('已删除别名'));

      // Verify alias was deleted
      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, null);
    });

    test('should show error for non-existent alias delete', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: ['del', 'nonexistent']
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('不存在'));
    });

    test('should show error for invalid alias definition', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg),
        userId: '123456789',
        args: ['invalid']
      };

      await handleAlias(ctx);

      assert.ok(replies[0].includes('用法'));
    });
  });

  // Task 4.7: Sessions Handler Tests
  describe('handleSessions', () => {
    test('should show empty message when no sessions', async () => {
      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg)
      };

      await handleSessions(ctx);

      assert.ok(replies[0].includes('没有活跃会话'));
    });

    test('should list all active sessions', async () => {
      // Create sessions
      sessionStore.touchSession('telegram:111', 'user111');
      sessionStore.touchSession('telegram:222', 'user222');
      sessionStore.setCwd('telegram:111', '/home/user1');
      sessionStore.recordCommand('telegram:111', 'ls', 0);

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg)
      };

      await handleSessions(ctx);

      assert.ok(replies[0].includes('活跃会话'));
      assert.ok(replies[0].includes('telegram:111'));
      assert.ok(replies[0].includes('telegram:222'));
      assert.ok(replies[0].includes('user111'));
      assert.ok(replies[0].includes('user222'));
    });

    test('should show session details', async () => {
      sessionStore.touchSession('telegram:detail-test', 'user-detail');
      sessionStore.setCwd('telegram:detail-test', '/home/user/project');
      sessionStore.recordCommand('telegram:detail-test', 'npm test', 0);

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg)
      };

      await handleSessions(ctx);

      assert.ok(replies[0].includes('用户: user-detail'));
      assert.ok(replies[0].includes('目录:'));
      assert.ok(replies[0].includes('/home/user/project'));
      assert.ok(replies[0].includes('命令数: 1'));
    });

    test('should show age and idle time', async () => {
      sessionStore.touchSession('telegram:age-test', 'user-age');

      const replies = [];
      const ctx = {
        reply: async (msg) => replies.push(msg)
      };

      await handleSessions(ctx);

      assert.ok(replies[0].includes('年龄:'));
      assert.ok(replies[0].includes('空闲:'));
    });
  });
});
