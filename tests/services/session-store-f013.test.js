/**
 * Tests for F-013 session store extensions
 * Tasks 1.2-1.5: Command history, env overrides, activity tracking, session metadata
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-013 SessionStore Extensions', () => {
  let sessionStore;

  beforeEach(async () => {
    // Import fresh module
    const module = await import('../../src/services/session-store.js');
    sessionStore = module.sessionStore;
  });

  // Task 1.2: Command History Tracking
  describe('recordCommand', () => {
    test('should record command with exit code', () => {
      sessionStore.recordCommand('test-session-history-1', 'ls -la', 0);
      const history = sessionStore.getCommandHistory('test-session-history-1');
      assert.equal(history.length, 1);
      assert.equal(history[0].command, 'ls -la');
      assert.equal(history[0].exitCode, 0);
      assert.ok(history[0].timestamp);
    });

    test('should record multiple commands in order', () => {
      sessionStore.recordCommand('test-session-history-2', 'cd /tmp', 0);
      sessionStore.recordCommand('test-session-history-2', 'ls', 0);
      sessionStore.recordCommand('test-session-history-2', 'cat file.txt', 1);
      const history = sessionStore.getCommandHistory('test-session-history-2');
      assert.equal(history.length, 3);
      assert.equal(history[0].command, 'cd /tmp');
      assert.equal(history[2].command, 'cat file.txt');
      assert.equal(history[2].exitCode, 1);
    });

    test('should limit history to SESSION_HISTORY_MAX', () => {
      // Record more than the default limit (100)
      for (let i = 0; i < 150; i++) {
        sessionStore.recordCommand('test-session-history-3', `cmd${i}`, 0);
      }
      const history = sessionStore.getCommandHistory('test-session-history-3');
      assert.equal(history.length, 100);
      // Should keep the most recent commands
      assert.equal(history[0].command, 'cmd50');
      assert.equal(history[99].command, 'cmd149');
    });
  });

  describe('getCommandHistory', () => {
    test('should return empty array for session without history', () => {
      const history = sessionStore.getCommandHistory('non-existent-session');
      assert.deepEqual(history, []);
    });

    test('should return limited history with limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        sessionStore.recordCommand('test-session-history-4', `cmd${i}`, 0);
      }
      const history = sessionStore.getCommandHistory('test-session-history-4', 5);
      assert.equal(history.length, 5);
      // Should return the most recent
      assert.equal(history[0].command, 'cmd15');
      assert.equal(history[4].command, 'cmd19');
    });

    test('should return all history when limit exceeds total', () => {
      sessionStore.recordCommand('test-session-history-5', 'cmd1', 0);
      sessionStore.recordCommand('test-session-history-5', 'cmd2', 0);
      const history = sessionStore.getCommandHistory('test-session-history-5', 100);
      assert.equal(history.length, 2);
    });
  });

  // Task 1.3: Env Overrides Tracking
  describe('setEnvOverride', () => {
    test('should set environment variable override', () => {
      sessionStore.setEnvOverride('test-session-env-1', 'NODE_ENV', 'development');
      const env = sessionStore.getEnvOverrides('test-session-env-1');
      assert.deepEqual(env, { NODE_ENV: 'development' });
    });

    test('should allow multiple env overrides', () => {
      sessionStore.setEnvOverride('test-session-env-2', 'NODE_ENV', 'test');
      sessionStore.setEnvOverride('test-session-env-2', 'DEBUG', 'true');
      const env = sessionStore.getEnvOverrides('test-session-env-2');
      assert.deepEqual(env, { NODE_ENV: 'test', DEBUG: 'true' });
    });

    test('should overwrite existing env override', () => {
      sessionStore.setEnvOverride('test-session-env-3', 'PATH', '/usr/bin');
      sessionStore.setEnvOverride('test-session-env-3', 'PATH', '/usr/local/bin');
      const env = sessionStore.getEnvOverrides('test-session-env-3');
      assert.deepEqual(env, { PATH: '/usr/local/bin' });
    });
  });

  describe('getEnvOverrides', () => {
    test('should return empty object for session without overrides', () => {
      const env = sessionStore.getEnvOverrides('non-existent-session');
      assert.deepEqual(env, {});
    });
  });

  // Task 1.4: Activity Tracking
  describe('touchSession', () => {
    test('should set last activity timestamp', () => {
      const before = Date.now();
      sessionStore.touchSession('test-session-activity-1', '123456789');
      const after = Date.now();
      const lastActivity = sessionStore.getLastActivity('test-session-activity-1');
      assert.ok(lastActivity >= before);
      assert.ok(lastActivity <= after);
    });

    test('should update user ID', () => {
      sessionStore.touchSession('test-session-activity-2', '987654321');
      const userId = sessionStore.getUserId('test-session-activity-2');
      assert.equal(userId, '987654321');
    });

    test('should update last activity on subsequent calls', async () => {
      sessionStore.touchSession('test-session-activity-3', '111');
      const first = sessionStore.getLastActivity('test-session-activity-3');
      await new Promise((r) => setTimeout(r, 10));
      sessionStore.touchSession('test-session-activity-3', '111');
      const second = sessionStore.getLastActivity('test-session-activity-3');
      assert.ok(second > first);
    });
  });

  describe('getLastActivity', () => {
    test('should return null for session without activity', () => {
      const lastActivity = sessionStore.getLastActivity('non-existent-session');
      assert.equal(lastActivity, null);
    });
  });

  describe('getSessionInfo', () => {
    test('should return null for non-existent session', () => {
      const info = sessionStore.getSessionInfo('non-existent-session');
      assert.equal(info, null);
    });

    test('should return session metadata', () => {
      sessionStore.touchSession('test-session-info-1', '123456789');
      sessionStore.setCwd('test-session-info-1', '/home/user');
      sessionStore.setEnvOverride('test-session-info-1', 'NODE_ENV', 'test');
      sessionStore.recordCommand('test-session-info-1', 'ls', 0);

      const info = sessionStore.getSessionInfo('test-session-info-1');
      assert.ok(info);
      assert.equal(info.sessionKey, 'test-session-info-1');
      assert.equal(info.userId, '123456789');
      assert.equal(info.cwd, '/home/user');
      assert.deepEqual(info.envOverrides, { NODE_ENV: 'test' });
      assert.equal(info.commandCount, 1);
      assert.ok(info.createdAt);
      assert.ok(info.lastActivityAt);
    });
  });

  // Task 1.5: Session Metadata Methods
  describe('getAllSessionKeys', () => {
    test('should return empty array when no sessions', () => {
      // This depends on test isolation
      const keys = sessionStore.getAllSessionKeys();
      // Filter out sessions from other tests
      const testKeys = keys.filter((k) => k.startsWith('test-session-metadata'));
      assert.deepEqual(testKeys, []);
    });

    test('should return all active session keys', () => {
      sessionStore.touchSession('test-session-metadata-1', '111');
      sessionStore.touchSession('test-session-metadata-2', '222');
      const keys = sessionStore.getAllSessionKeys();
      assert.ok(keys.includes('test-session-metadata-1'));
      assert.ok(keys.includes('test-session-metadata-2'));
    });
  });

  describe('getSessionAge', () => {
    test('should return null for non-existent session', () => {
      const age = sessionStore.getSessionAge('non-existent-session');
      assert.equal(age, null);
    });

    test('should return age in milliseconds', async () => {
      sessionStore.touchSession('test-session-age-1', '123');
      await new Promise((r) => setTimeout(r, 50));
      const age = sessionStore.getSessionAge('test-session-age-1');
      assert.ok(age >= 50);
    });
  });

  describe('getIdleTime', () => {
    test('should return null for non-existent session', () => {
      const idle = sessionStore.getIdleTime('non-existent-session');
      assert.equal(idle, null);
    });

    test('should return idle time in milliseconds', async () => {
      sessionStore.touchSession('test-session-idle-1', '123');
      await new Promise((r) => setTimeout(r, 50));
      const idle = sessionStore.getIdleTime('test-session-idle-1');
      assert.ok(idle >= 50);
    });
  });

  describe('setUserId / getUserId', () => {
    test('should set and get user ID', () => {
      sessionStore.setUserId('test-session-user-1', '999888777');
      const userId = sessionStore.getUserId('test-session-user-1');
      assert.equal(userId, '999888777');
    });

    test('should return null for session without user ID', () => {
      const userId = sessionStore.getUserId('non-existent-session');
      assert.equal(userId, null);
    });
  });

  describe('clear (extended)', () => {
    test('should clear command history', () => {
      sessionStore.recordCommand('test-session-clear-1', 'ls', 0);
      sessionStore.clear('test-session-clear-1');
      const history = sessionStore.getCommandHistory('test-session-clear-1');
      assert.deepEqual(history, []);
    });

    test('should clear env overrides', () => {
      sessionStore.setEnvOverride('test-session-clear-2', 'NODE_ENV', 'test');
      sessionStore.clear('test-session-clear-2');
      const env = sessionStore.getEnvOverrides('test-session-clear-2');
      assert.deepEqual(env, {});
    });

    test('should clear activity tracking', () => {
      sessionStore.touchSession('test-session-clear-3', '123');
      sessionStore.clear('test-session-clear-3');
      const lastActivity = sessionStore.getLastActivity('test-session-clear-3');
      assert.equal(lastActivity, null);
    });

    test('should clear user ID', () => {
      sessionStore.setUserId('test-session-clear-4', '456');
      sessionStore.clear('test-session-clear-4');
      const userId = sessionStore.getUserId('test-session-clear-4');
      assert.equal(userId, null);
    });

    test('should clear session metadata', () => {
      sessionStore.touchSession('test-session-clear-5', '789');
      sessionStore.clear('test-session-clear-5');
      const info = sessionStore.getSessionInfo('test-session-clear-5');
      assert.equal(info, null);
    });
  });
});
