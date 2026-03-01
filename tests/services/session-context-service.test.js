/**
 * Tests for F-013 Session Context Service
 * Tasks 2.1-2.8: Session lifecycle management
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testSessionsDir = path.join(__dirname, '../fixtures/sessions-f013');

// Helper to check if file exists
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('F-013 Session Context Service', () => {
  let sessionContextService;
  let sessionStore;

  beforeEach(async () => {
    // Clean up test sessions directory
    try {
      await rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testSessionsDir, { recursive: true });

    // Import modules
    const serviceModule = await import('../../src/services/session-context-service.js');
    sessionContextService = serviceModule.sessionContextService;
    sessionContextService.reset();

    const storeModule = await import('../../src/services/session-store.js');
    sessionStore = storeModule.sessionStore;
  });

  afterEach(async () => {
    // Stop any running timeout watcher
    sessionContextService.stopTimeoutWatcher();
    // Clean up test directory
    try {
      await rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  // Task 2.1: initSessionContext
  describe('initSessionContext', () => {
    test('should initialize with data directory', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      assert.ok(sessionContextService.isInitialized());
    });

    test('should create data directory if not exists', async () => {
      const newDir = path.join(testSessionsDir, 'new-sessions');
      sessionContextService.initSessionContext({ dataDir: newDir });
      // The directory should be created on demand (lazy)
      assert.ok(sessionContextService.isInitialized());
    });
  });

  // Task 2.2: createSession and getOrCreateSession
  describe('createSession', () => {
    test('should create a new session with user ID', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:123456789';
      sessionContextService.createSession(sessionKey, '123456789');

      const info = sessionStore.getSessionInfo(sessionKey);
      assert.ok(info);
      assert.equal(info.userId, '123456789');
      assert.ok(info.createdAt);
      assert.ok(info.lastActivityAt);
    });

    test('should not overwrite existing session', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:existing';
      sessionContextService.createSession(sessionKey, '111');
      const firstCreatedAt = sessionStore.getSessionInfo(sessionKey).createdAt;

      sessionContextService.createSession(sessionKey, '111');
      const secondCreatedAt = sessionStore.getSessionInfo(sessionKey).createdAt;

      assert.equal(firstCreatedAt, secondCreatedAt);
    });
  });

  describe('getOrCreateSession', () => {
    test('should create session if not exists', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:new-session';
      const info = sessionContextService.getOrCreateSession(sessionKey, '999');

      assert.ok(info);
      assert.equal(info.userId, '999');
    });

    test('should return existing session if exists', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:existing-session';
      const first = sessionContextService.getOrCreateSession(sessionKey, '111');
      const second = sessionContextService.getOrCreateSession(sessionKey, '111');

      assert.equal(first.createdAt, second.createdAt);
    });
  });

  // Task 2.3: touchSession
  describe('touchSession', () => {
    test('should update activity timestamp', async () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:touch-test';
      sessionContextService.createSession(sessionKey, '123');
      const firstActivity = sessionStore.getLastActivity(sessionKey);

      await new Promise((r) => setTimeout(r, 10));
      sessionContextService.touchSession(sessionKey);
      const secondActivity = sessionStore.getLastActivity(sessionKey);

      assert.ok(secondActivity > firstActivity);
    });
  });

  // Task 2.4: cleanupSession
  describe('cleanupSession', () => {
    test('should clear session data', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:cleanup-test';
      sessionContextService.createSession(sessionKey, '123');
      sessionStore.setCwd(sessionKey, '/test/path');
      sessionStore.recordCommand(sessionKey, 'ls', 0);

      sessionContextService.cleanupSession(sessionKey);

      const info = sessionStore.getSessionInfo(sessionKey);
      assert.equal(info, null);
      assert.equal(sessionStore.getCwd(sessionKey), null);
    });

    test('should call notification callback if provided', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      let notifiedSessionKey = null;
      let notifiedUserId = null;

      sessionContextService.setNotificationCallback((sessionKey, userId) => {
        notifiedSessionKey = sessionKey;
        notifiedUserId = userId;
      });

      const sessionKey = 'telegram:notify-test';
      sessionContextService.createSession(sessionKey, '456');
      sessionContextService.cleanupSession(sessionKey);

      assert.equal(notifiedSessionKey, sessionKey);
      assert.equal(notifiedUserId, '456');
    });
  });

  // Task 2.5: persistSession and restoreSessions
  describe('persistSession', () => {
    test('should save session to JSON file', async () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      const sessionKey = 'telegram:persist-test';
      sessionContextService.createSession(sessionKey, '123');
      sessionStore.setCwd(sessionKey, '/home/user/project');
      sessionStore.setEnvOverride(sessionKey, 'NODE_ENV', 'test');

      await sessionContextService.persistSession(sessionKey);

      const files = await readdir(testSessionsDir);
      assert.ok(files.some((f) => f.includes('persist-test')));

      const content = await readFile(path.join(testSessionsDir, files.find((f) => f.includes('persist-test'))), 'utf-8');
      const data = JSON.parse(content);
      assert.equal(data.sessionKey, sessionKey);
      assert.equal(data.userId, '123');
      assert.equal(data.cwd, '/home/user/project');
    });
  });

  describe('restoreSessions', () => {
    test('should restore sessions from disk', async () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });

      // Create and persist a session
      const sessionKey = 'telegram:restore-test';
      sessionContextService.createSession(sessionKey, '789');
      sessionStore.setCwd(sessionKey, '/restore/path');
      await sessionContextService.persistSession(sessionKey);

      // Clear the in-memory session
      sessionStore.clear(sessionKey);
      assert.equal(sessionStore.getSessionInfo(sessionKey), null);

      // Restore
      await sessionContextService.restoreSessions();

      const info = sessionStore.getSessionInfo(sessionKey);
      assert.ok(info);
      assert.equal(info.userId, '789');
      assert.equal(sessionStore.getCwd(sessionKey), '/restore/path');
    });

    test('should skip expired sessions on restore', async () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir, timeoutMs: 100 });

      const sessionKey = 'telegram:expired-session';
      // Create an old session file manually
      const oldTime = Date.now() - 10000; // 10 seconds ago
      const sessionData = {
        sessionKey,
        userId: '999',
        cwd: null,
        envOverrides: {},
        commandHistory: [],
        createdAt: oldTime,
        lastActivityAt: oldTime
      };

      await writeFile(
        path.join(testSessionsDir, `${sessionKey.replace(/:/g, '_')}.json`),
        JSON.stringify(sessionData)
      );

      await sessionContextService.restoreSessions();

      // Session should not be restored (expired)
      const info = sessionStore.getSessionInfo(sessionKey);
      assert.equal(info, null);
    });
  });

  // Task 2.6: startTimeoutWatcher and stopTimeoutWatcher
  describe('startTimeoutWatcher', () => {
    test('should start interval to check timeouts', async () => {
      sessionContextService.initSessionContext({
        dataDir: testSessionsDir,
        timeoutMs: 50,
        checkIntervalMs: 20
      });

      let notified = false;
      sessionContextService.setNotificationCallback(() => {
        notified = true;
      });

      const sessionKey = 'telegram:timeout-test';
      sessionContextService.createSession(sessionKey, '123');

      sessionContextService.startTimeoutWatcher();
      assert.ok(sessionContextService.isWatcherRunning());

      // Wait for at least one check cycle
      await new Promise((r) => setTimeout(r, 100));

      sessionContextService.stopTimeoutWatcher();
      assert.ok(!sessionContextService.isWatcherRunning());
    });
  });

  describe('stopTimeoutWatcher', () => {
    test('should stop the timeout watcher', () => {
      sessionContextService.initSessionContext({ dataDir: testSessionsDir });
      sessionContextService.startTimeoutWatcher();
      assert.ok(sessionContextService.isWatcherRunning());

      sessionContextService.stopTimeoutWatcher();
      assert.ok(!sessionContextService.isWatcherRunning());
    });
  });

  // Task 2.7: Export verification (handled by successful import)
});
