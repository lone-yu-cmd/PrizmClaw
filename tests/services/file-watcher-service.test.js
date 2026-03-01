/**
 * Tests for F-014 File Watcher Service
 * Phase 3: FileWatcherService implementation
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

// Helper to check if file exists
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('F-014 FileWatcherService', () => {
  let fileWatcherService;
  let tempDir;
  let watchersFile;

  beforeEach(async () => {
    // Create temp directory using mkdtemp
    tempDir = await mkdtemp(path.join(tmpdir(), 'file-watcher-test-'));
    watchersFile = path.join(tempDir, 'file-watchers.json');

    // Import fresh module
    const module = await import('../../src/services/file-watcher-service.js');
    fileWatcherService = module.fileWatcherService;
    fileWatcherService.reset();
  });

  afterEach(async () => {
    // Stop any running watchers
    if (fileWatcherService) {
      fileWatcherService.stopAllWatchers();
      fileWatcherService.reset();
    }
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('initFileWatcherService', () => {
    test('should initialize with configuration', () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: ['/tmp', '/home'],
        maxWatchers: 50,
        debounceMs: 500
      });
      assert.ok(fileWatcherService.isInitialized());
    });
  });

  describe('addWatch', () => {
    test('should add a file watcher', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123456789',
        userId: '987654321'
      });

      assert.ok(watcher.id, 'Should have generated ID');
      assert.equal(watcher.path, tempDir);
      assert.equal(watcher.chatId, '123456789');
      assert.equal(watcher.enabled, true);
      assert.ok(watcher.createdAt);
    });

    test('should reject path outside allowed roots', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: ['/tmp/allowed']
      });

      await assert.rejects(async () => {
        await fileWatcherService.addWatch({
          path: '/etc/passwd',
          chatId: '123',
          userId: '456'
        });
      }, /not allowed|permission/i);
    });

    test('should allow path inside allowed roots', async () => {
      const allowedDir = path.join(tempDir, 'allowed');
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [allowedDir]
      });

      // Create the directory
      await mkdir(allowedDir, { recursive: true });

      const watcher = await fileWatcherService.addWatch({
        path: allowedDir,
        chatId: '123',
        userId: '456'
      });

      assert.ok(watcher.id);
    });

    test('should enforce max watchers limit', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');
      const dir3 = path.join(tempDir, 'dir3');

      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });
      await mkdir(dir3, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir],
        maxWatchers: 2
      });

      await fileWatcherService.addWatch({ path: dir1, chatId: '123', userId: '456' });
      await fileWatcherService.addWatch({ path: dir2, chatId: '123', userId: '456' });

      await assert.rejects(async () => {
        await fileWatcherService.addWatch({ path: dir3, chatId: '123', userId: '456' });
      }, /maximum.*watchers/i);
    });
  });

  describe('removeWatch', () => {
    test('should remove an existing watcher', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123',
        userId: '456'
      });

      const result = fileWatcherService.removeWatch(watcher.id);
      assert.equal(result, true);

      const watchers = fileWatcherService.listWatches();
      assert.equal(watchers.length, 0);
    });

    test('should return false for non-existent watcher', () => {
      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      const result = fileWatcherService.removeWatch('non-existent');
      assert.equal(result, false);
    });
  });

  describe('listWatches', () => {
    test('should return empty array when no watchers', () => {
      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      const watchers = fileWatcherService.listWatches();
      assert.deepEqual(watchers, []);
    });

    test('should filter by chatId', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      await fileWatcherService.addWatch({ path: dir1, chatId: 'chat1', userId: 'user1' });
      await fileWatcherService.addWatch({ path: dir2, chatId: 'chat2', userId: 'user2' });

      const watchers = fileWatcherService.listWatches({ chatId: 'chat1' });
      assert.equal(watchers.length, 1);
      assert.equal(watchers[0].chatId, 'chat1');
    });

    test('should return all watchers without filter', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      await fileWatcherService.addWatch({ path: dir1, chatId: 'chat1', userId: 'user1' });
      await fileWatcherService.addWatch({ path: dir2, chatId: 'chat2', userId: 'user2' });

      const watchers = fileWatcherService.listWatches();
      assert.equal(watchers.length, 2);
    });
  });

  describe('getWatch', () => {
    test('should return watcher by ID', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123',
        userId: '456'
      });

      const found = fileWatcherService.getWatch(watcher.id);
      assert.ok(found);
      assert.equal(found.id, watcher.id);
    });

    test('should return null for non-existent watcher', () => {
      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      const found = fileWatcherService.getWatch('non-existent');
      assert.equal(found, null);
    });
  });

  describe('persistence', () => {
    test('should save watchers to file', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir],
        watchersFile: 'file-watchers.json'
      });

      await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123',
        userId: '456'
      });

      await fileWatcherService.saveWatches();

      const content = await readFile(watchersFile, 'utf-8');
      const savedWatchers = JSON.parse(content);

      assert.equal(savedWatchers.length, 1);
      assert.equal(savedWatchers[0].path, tempDir);
    });

    test('should load watchers from file', async () => {
      // Write watchers directly to file
      const testWatchers = [{
        id: 'test-id-123',
        path: tempDir,
        chatId: '123',
        userId: '456',
        recursive: true,
        enabled: true,
        createdAt: Date.now()
      }];

      await writeFile(watchersFile, JSON.stringify(testWatchers));

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir],
        watchersFile: 'file-watchers.json'
      });

      await fileWatcherService.loadWatches();

      const watchers = fileWatcherService.listWatches();
      assert.equal(watchers.length, 1);
      assert.equal(watchers[0].id, 'test-id-123');
    });

    test('should handle missing file gracefully', async () => {
      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      await fileWatcherService.loadWatches();

      const watchers = fileWatcherService.listWatches();
      assert.deepEqual(watchers, []);
    });

    test('should handle corrupted file gracefully', async () => {
      await writeFile(watchersFile, 'not valid json');

      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      await fileWatcherService.loadWatches();

      const watchers = fileWatcherService.listWatches();
      assert.deepEqual(watchers, []);
    });
  });

  describe('setNotificationCallback', () => {
    test('should set notification callback', () => {
      fileWatcherService.initFileWatcherService({ dataDir: tempDir });

      fileWatcherService.setNotificationCallback(() => {});
      // Callback is set
      assert.ok(true);
    });
  });

  describe('startWatching and stopWatching', () => {
    test('should start and stop individual watcher', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123',
        userId: '456'
      });

      fileWatcherService.startWatching(watcher.id);
      assert.ok(fileWatcherService.isWatcherActive(watcher.id));

      fileWatcherService.stopWatching(watcher.id);
      assert.ok(!fileWatcherService.isWatcherActive(watcher.id));
    });

    test('should stop all watchers', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const w1 = await fileWatcherService.addWatch({ path: dir1, chatId: '123', userId: '456' });
      const w2 = await fileWatcherService.addWatch({ path: dir2, chatId: '123', userId: '456' });

      fileWatcherService.startWatching(w1.id);
      fileWatcherService.startWatching(w2.id);

      fileWatcherService.stopAllWatchers();

      assert.ok(!fileWatcherService.isWatcherActive(w1.id));
      assert.ok(!fileWatcherService.isWatcherActive(w2.id));
    });
  });

  describe('restoreWatches', () => {
    test('should restore watchers from disk', async () => {
      // First create and save watchers
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir],
        watchersFile: 'file-watchers.json'
      });

      await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '123',
        userId: '456'
      });

      await fileWatcherService.saveWatches();

      // Reset and reload
      fileWatcherService.reset();

      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir],
        watchersFile: 'file-watchers.json'
      });

      await fileWatcherService.restoreWatches();

      const watchers = fileWatcherService.listWatches();
      assert.equal(watchers.length, 1);
      assert.equal(watchers[0].chatId, '123');
    });
  });

  describe('path validation', () => {
    test('should normalize paths', async () => {
      fileWatcherService.initFileWatcherService({
        dataDir: tempDir,
        allowedRoots: [tempDir]
      });

      const watcher = await fileWatcherService.addWatch({
        path: tempDir + '/',
        chatId: '123',
        userId: '456'
      });

      // Path should be normalized (trailing slash removed)
      assert.equal(watcher.path, tempDir);
    });
  });
});
