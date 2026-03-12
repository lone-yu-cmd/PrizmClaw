/**
 * Tests for F-011 session-store extensions
 * T-003: Extend session-store with process tracking
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// We need to access the sessionStore instance
// Since it's a singleton, we'll test it directly
describe('F-011 Session Store Process Tracking', () => {
  const testSessionKey = 'test-f011-session';

  beforeEach(async () => {
    // Clear the session before each test
    const { sessionStore } = await import('../../src/services/session-store.js');
    sessionStore.clear(testSessionKey);
  });

  afterEach(async () => {
    const { sessionStore } = await import('../../src/services/session-store.js');
    sessionStore.clear(testSessionKey);
  });

  describe('getActiveProcess', () => {
    test('should return null when no active process', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const result = sessionStore.getActiveProcess(testSessionKey);
      assert.equal(result, null);
    });

    test('should return process info when set', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const mockProcess = { pid: 12345 };
      const info = { pid: 12345, startedAt: Date.now(), childProcess: mockProcess };

      sessionStore.setActiveProcess(testSessionKey, info);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.ok(result);
      assert.equal(result.pid, 12345);
      assert.ok(result.startedAt);
      assert.ok(result.childProcess);
    });
  });

  describe('setActiveProcess', () => {
    test('should store process info', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const mockProcess = { pid: 54321 };
      const info = { pid: 54321, startedAt: Date.now(), childProcess: mockProcess };

      sessionStore.setActiveProcess(testSessionKey, info);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.equal(result.pid, 54321);
      assert.equal(result.startedAt, info.startedAt);
    });

    test('should overwrite existing process info', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const info1 = { pid: 11111, startedAt: Date.now(), childProcess: {} };
      const info2 = { pid: 22222, startedAt: Date.now(), childProcess: {} };

      sessionStore.setActiveProcess(testSessionKey, info1);
      sessionStore.setActiveProcess(testSessionKey, info2);

      const result = sessionStore.getActiveProcess(testSessionKey);
      assert.equal(result.pid, 22222);
    });
  });

  describe('updateProcessBytes', () => {
    test('should update stdout bytes for active process', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const info = { pid: 12345, startedAt: Date.now(), childProcess: {}, stdoutBytes: 0 };
      sessionStore.setActiveProcess(testSessionKey, info);

      sessionStore.updateProcessBytes(testSessionKey, 1000);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.equal(result.stdoutBytes, 1000);
    });

    test('should accumulate bytes on multiple updates', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const info = { pid: 12345, startedAt: Date.now(), childProcess: {}, stdoutBytes: 0 };
      sessionStore.setActiveProcess(testSessionKey, info);

      sessionStore.updateProcessBytes(testSessionKey, 500);
      sessionStore.updateProcessBytes(testSessionKey, 300);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.equal(result.stdoutBytes, 800);
    });

    test('should do nothing when no active process', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      // Should not throw
      sessionStore.updateProcessBytes(testSessionKey, 100);
      const result = sessionStore.getActiveProcess(testSessionKey);
      assert.equal(result, null);
    });
  });

  describe('clearActiveProcess', () => {
    test('should remove active process entry', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const info = { pid: 12345, startedAt: Date.now(), childProcess: {} };
      sessionStore.setActiveProcess(testSessionKey, info);

      sessionStore.clearActiveProcess(testSessionKey);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.equal(result, null);
    });

    test('should be safe to call when no active process', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      // Should not throw
      sessionStore.clearActiveProcess(testSessionKey);
      assert.ok(true);
    });
  });

  describe('clear integration', () => {
    test('should clear active process when session is cleared', async () => {
      const { sessionStore } = await import('../../src/services/session-store.js');
      const info = { pid: 12345, startedAt: Date.now(), childProcess: {} };
      sessionStore.setActiveProcess(testSessionKey, info);

      sessionStore.clear(testSessionKey);
      const result = sessionStore.getActiveProcess(testSessionKey);

      assert.equal(result, null);
    });
  });
});
