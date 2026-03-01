/**
 * Tests for F-014 /cron Command Handler
 * Phase 6: Unit Tests
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('F-014 /cron Command Handler', () => {
  let cronHandler;
  let scheduledTaskService;
  let tempDir;
  let mockReply;
  let replyCalls;

  beforeEach(async () => {
    tempDir = await mkdir(path.join(tmpdir(), 'cron-handler-test-'), { recursive: true });

    // Use absolute paths from project root
    const projectRoot = process.cwd();
    const handlerPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/cron.js`);
    const servicePath = new URL(`file://${projectRoot}/src/services/scheduled-task-service.js`);

    // Import modules
    const handlerModule = await import(handlerPath.href);
    cronHandler = handlerModule;

    const serviceModule = await import(servicePath.href);
    scheduledTaskService = serviceModule.scheduledTaskService;
    scheduledTaskService.reset();
    scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

    replyCalls = [];
    mockReply = (msg) => {
      replyCalls.push(msg);
    };
  });

  afterEach(async () => {
    scheduledTaskService.stopScheduler();
    scheduledTaskService.reset();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('parseCronAddCommand', () => {
    test('should parse cron add command', () => {
      const result = cronHandler.parseCronAddCommand(['add', '*/5 * * * *', 'echo', 'hello']);
      assert.deepEqual(result, {
        type: 'cron',
        schedule: '*/5 * * * *',
        command: 'echo hello'
      });
    });

    test('should parse --once add command', () => {
      const result = cronHandler.parseCronAddCommand(['add', '--once', '2026-03-15 10:00', 'npm', 'test']);
      assert.deepEqual(result, {
        type: 'once',
        schedule: '2026-03-15 10:00',
        command: 'npm test'
      });
    });

    test('should return null for invalid format', () => {
      const result = cronHandler.parseCronAddCommand([]);
      assert.equal(result, null);
    });

    test('should return null for missing command', () => {
      const result = cronHandler.parseCronAddCommand(['add', '*/5 * * * *']);
      assert.equal(result, null);
    });
  });

  describe('handleCron', () => {
    test('should show help when no args', async () => {
      await cronHandler.handleCron({
        reply: mockReply,
        args: [],
        from: { id: '123' },
        chat: { id: '456' },
        sessionId: 'test-session'
      });

      assert.ok(replyCalls.length > 0);
      assert.ok(replyCalls[0].includes('定时任务'));
    });

    test('should create cron task', async () => {
      await cronHandler.handleCron({
        reply: mockReply,
        args: ['add', '* * * * *', 'echo', 'test'],
        from: { id: '123' },
        chat: { id: '456' },
        sessionId: 'test-session'
      });

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].type, 'cron');
      assert.equal(tasks[0].command, 'echo test');
    });

    test('should report error for invalid cron expression', async () => {
      await cronHandler.handleCron({
        reply: mockReply,
        args: ['add', 'invalid-cron', 'echo', 'test'],
        from: { id: '123' },
        chat: { id: '456' },
        sessionId: 'test-session'
      });

      assert.ok(replyCalls.some(call => call.includes('失败') || call.includes('错误')));
    });
  });

  describe('cronMeta', () => {
    test('should have required metadata', () => {
      assert.ok(cronHandler.cronMeta.name);
      assert.ok(cronHandler.cronMeta.description);
      assert.ok(cronHandler.cronMeta.usage);
      assert.ok(cronHandler.cronMeta.requiresAuth);
    });
  });
});
