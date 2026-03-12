/**
 * Integration Tests for F-014 File Watchers
 * Phase 7: Integration Tests
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('F-014 File Watchers Integration', () => {
  let fileWatcherService;
  let tempDir;
  let watchersFile;
  let watchDir;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `file-watchers-integration-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    watchersFile = path.join(tempDir, 'file-watchers.json');
    watchDir = path.join(tempDir, 'watched');
    await mkdir(watchDir, { recursive: true });

    const projectRoot = process.cwd();
    const servicePath = new URL(`file://${projectRoot}/src/services/file-watcher-service.js`);
    const serviceModule = await import(servicePath.href);
    fileWatcherService = serviceModule.fileWatcherService;
    fileWatcherService.reset();
  });

  afterEach(async () => {
    fileWatcherService.stopAllWatchers();
    fileWatcherService.reset();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('end-to-end watcher lifecycle', () => {
    test('should create, start, stop, and remove watcher', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir]
      });

      // Create watcher
      const watcher = await fileWatcherService.addWatch({
        path: watchDir,
        chatId: 'test-chat',
        userId: 'test-user'
      });

      assert.ok(watcher.id);
      assert.equal(watcher.enabled, true);

      // Start watching
      const started = fileWatcherService.startWatching(watcher.id);
      assert.equal(started, true);
      assert.equal(fileWatcherService.isWatcherActive(watcher.id), true);

      // Stop watching
      fileWatcherService.stopWatching(watcher.id);
      assert.equal(fileWatcherService.isWatcherActive(watcher.id), false);

      // Remove watcher
      const removed = fileWatcherService.removeWatch(watcher.id);
      assert.equal(removed, true);

      const remaining = fileWatcherService.listWatches();
      assert.equal(remaining.length, 0);
    });

    test('should detect file changes and trigger notification', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir],
        debounceMs: 100
      });

      const notifications = [];
      fileWatcherService.setNotificationCallback(async (chatId, event) => {
        notifications.push({ chatId, event });
      });

      const watcher = await fileWatcherService.addWatch({
        path: watchDir,
        chatId: 'notify-chat',
        userId: 'test-user'
      });

      fileWatcherService.startWatching(watcher.id);

      // Create a file to trigger change event
      const testFile = path.join(watchDir, 'test.txt');
      await writeFile(testFile, 'test content');

      // Wait for debounce + event processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check notification was received
      assert.ok(notifications.length >= 1, 'Should have received at least one notification');
      assert.equal(notifications[0].chatId, 'notify-chat');
      assert.ok(notifications[0].event.filename);
    });
  });

  describe('persistence across restart', () => {
    test('should persist watchers and restore them', async () => {
      // First instance
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        watchersFile: 'file-watchers.json',
        allowedRoots: [watchDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: watchDir,
        chatId: 'persist-chat',
        userId: 'persist-user'
      });

      await fileWatcherService.saveWatches();

      // Verify file exists
      const content = await readFile(watchersFile, 'utf-8');
      const savedWatchers = JSON.parse(content);
      assert.equal(savedWatchers.length, 1);
      assert.equal(savedWatchers[0].chatId, 'persist-chat');

      // Simulate restart
      fileWatcherService.stopAllWatchers();
      fileWatcherService.reset();

      // Second instance
      const servicePath = new URL(`file://${process.cwd()}/src/services/file-watcher-service.js`);
      const serviceModule = await import(servicePath.href);
      const newService = serviceModule.fileWatcherService;

      newService.initFileWatcherService({
        dataDir: tempDir,
        watchersFile: 'file-watchers.json',
        allowedRoots: [watchDir]
      });

      await newService.restoreWatches();

      const restoredWatchers = newService.listWatches();
      assert.equal(restoredWatchers.length, 1);
      assert.equal(restoredWatchers[0].chatId, 'persist-chat');
      assert.equal(restoredWatchers[0].enabled, true);

      newService.stopAllWatchers();
      newService.reset();
    });
  });

  describe('path validation', () => {
    test('should reject paths outside allowed roots', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir]
      });

      await assert.rejects(async () => {
        await fileWatcherService.addWatch({
          path: '/etc/passwd',
          chatId: 'test-chat',
          userId: 'test-user'
        });
      }, /not allowed/i);
    });

    test('should allow paths within allowed roots', async () => {
      const subDir = path.join(watchDir, 'subdir');
      await mkdir(subDir, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: subDir,
        chatId: 'test-chat',
        userId: 'test-user'
      });

      assert.ok(watcher.id);
      assert.ok(watcher.path.startsWith(watchDir));
    });
  });

  describe('multiple watchers', () => {
    test('should manage multiple watchers independently', async () => {
      const dir1 = path.join(watchDir, 'dir1');
      const dir2 = path.join(watchDir, 'dir2');
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir],
        maxWatchers: 10
      });

      const w1 = await fileWatcherService.addWatch({
        path: dir1,
        chatId: 'chat-1',
        userId: 'user-1'
      });

      const w2 = await fileWatcherService.addWatch({
        path: dir2,
        chatId: 'chat-2',
        userId: 'user-2'
      });

      fileWatcherService.startWatching(w1.id);
      fileWatcherService.startWatching(w2.id);

      // Both should be active
      assert.equal(fileWatcherService.isWatcherActive(w1.id), true);
      assert.equal(fileWatcherService.isWatcherActive(w2.id), true);

      // Stop one
      fileWatcherService.stopWatching(w1.id);
      assert.equal(fileWatcherService.isWatcherActive(w1.id), false);
      assert.equal(fileWatcherService.isWatcherActive(w2.id), true);

      // Stop all
      fileWatcherService.stopAllWatchers();
      assert.equal(fileWatcherService.isWatcherActive(w1.id), false);
      assert.equal(fileWatcherService.isWatcherActive(w2.id), false);
    });
  });

  describe('debouncing', () => {
    test('should debounce rapid file changes', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [watchDir],
        debounceMs: 200
      });

      const notifications = [];
      fileWatcherService.setNotificationCallback(async (chatId, event) => {
        notifications.push({ time: Date.now(), event });
      });

      const watcher = await fileWatcherService.addWatch({
        path: watchDir,
        chatId: 'debounce-chat',
        userId: 'test-user'
      });

      fileWatcherService.startWatching(watcher.id);

      // Rapid file changes
      const testFile = path.join(watchDir, 'rapid.txt');
      await writeFile(testFile, 'change 1');
      await writeFile(testFile, 'change 2');
      await writeFile(testFile, 'change 3');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should be debounced to single notification
      assert.ok(notifications.length >= 1, 'Should have at least one notification');
    });
  });
});
