/**
 * Tests for F-014 /watch Command Handler
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('F-014 /watch Command Handler', () => {
  let watchHandler;
  let fileWatcherService;
  let tempDir;
  let mockReply;
  let replyCalls;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `watch-handler-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Import modules using absolute URLs
    const projectRoot = process.cwd();
    const watchPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/watch.js`);
    const servicePath = new URL(`file://${projectRoot}/src/services/file-watcher-service.js`);

    const handlerModule = await import(watchPath.href);
    watchHandler = handlerModule;

    const serviceModule = await import(servicePath.href);
    fileWatcherService = serviceModule.fileWatcherService;
    fileWatcherService.reset();
    fileWatcherService.initFileWatcherService({
      dataDir: tempDir,
      allowedRoots: [tempDir]
    });

    replyCalls = [];
    mockReply = (msg) => {
      replyCalls.push(msg);
    };
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

  describe('handleWatch', () => {
    test('should show help when no args', async () => {
      await watchHandler.handleWatch({
        reply: mockReply,
        args: [],
        from: { id: '123' },
        chat: { id: '456' }
      });

      assert.ok(replyCalls.length > 0);
      assert.ok(replyCalls[0].includes('文件监听'));
    });

    test('should add watch for valid path', async () => {
      await watchHandler.handleWatch({
        reply: mockReply,
        args: [tempDir],
        from: { id: '123' },
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('监听已添加')));
    });

    test('should list watchers', async () => {
      await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '456',
        userId: '123'
      });

      await watchHandler.handleWatch({
        reply: mockReply,
        args: ['list'],
        from: { id: '123' },
        chat: { id: '456' }
      });

      assert.ok(replyCalls.length > 0);
      assert.ok(replyCalls[0].includes('文件监听列表'));
    });

    test('should remove watcher by path', async () => {
      await fileWatcherService.addWatch({
        path: tempDir,
        chatId: '456',
        userId: '123'
      });

      await watchHandler.handleWatch({
        reply: mockReply,
        args: ['unwatch', tempDir],
        from: { id: '123' },
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('监听已取消')));
    });
  });

  describe('watchMeta', () => {
    test('should have required metadata', () => {
      assert.ok(watchHandler.watchMeta.name);
      assert.ok(watchHandler.watchMeta.description);
      assert.ok(watchHandler.watchMeta.usage);
      assert.ok(watchHandler.watchMeta.requiresAuth);
    });
  });
});
