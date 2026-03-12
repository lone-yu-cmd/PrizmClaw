/**
 * Tests for F-014 /jobs Command Handler
 * Phase 6: Unit Tests
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('F-014 /jobs Command Handler', () => {
  let jobsHandler;
  let scheduledTaskService;
  let tempDir;
  let mockReply;
  let replyCalls;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `jobs-handler-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Use absolute paths from project root
    const projectRoot = process.cwd();
    const handlerPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/jobs.js`);
    const servicePath = new URL(`file://${projectRoot}/src/services/scheduled-task-service.js`);

    // Import modules
    const handlerModule = await import(handlerPath.href);
    jobsHandler = handlerModule;

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

  describe('parseJobsSubcommand', () => {
    test('should default to list', () => {
      const result = jobsHandler.parseJobsSubcommand([]);
      assert.equal(result.subcommand, 'list');
    });

    test('should parse pause subcommand', () => {
      const result = jobsHandler.parseJobsSubcommand(['pause', 'abc123']);
      assert.equal(result.subcommand, 'pause');
      assert.equal(result.arg, 'abc123');
    });

    test('should parse delete subcommand', () => {
      const result = jobsHandler.parseJobsSubcommand(['delete', 'xyz789']);
      assert.equal(result.subcommand, 'delete');
      assert.equal(result.arg, 'xyz789');
    });
  });

  describe('handleJobs', () => {
    test('should list empty tasks', async () => {
      await jobsHandler.handleJobs({
        reply: mockReply,
        args: [],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.length > 0);
      assert.ok(replyCalls[0].includes('没有'));
    });

    test('should list tasks', async () => {
      // Create a task first
      scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'echo test',
        chatId: '456',
        userId: '123'
      });

      await jobsHandler.handleJobs({
        reply: mockReply,
        args: ['list'],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.length > 0);
      assert.ok(replyCalls[0].includes('定时任务'));
    });

    test('should pause task', async () => {
      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'echo test',
        chatId: '456',
        userId: '123'
      });

      await jobsHandler.handleJobs({
        reply: mockReply,
        args: ['pause', task.id],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('暂停')));
    });

    test('should resume task', async () => {
      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'echo test',
        chatId: '456',
        userId: '123'
      });

      scheduledTaskService.pauseTask(task.id);

      await jobsHandler.handleJobs({
        reply: mockReply,
        args: ['resume', task.id],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('恢复')));
    });

    test('should delete task', async () => {
      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'echo test',
        chatId: '456',
        userId: '123'
      });

      await jobsHandler.handleJobs({
        reply: mockReply,
        args: ['delete', task.id],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('删除')));
      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks.length, 0);
    });

    test('should report error for non-existent task', async () => {
      await jobsHandler.handleJobs({
        reply: mockReply,
        args: ['pause', 'non-existent'],
        chat: { id: '456' }
      });

      assert.ok(replyCalls.some(call => call.includes('不存在')));
    });
  });

  describe('jobsMeta', () => {
    test('should have required metadata', () => {
      assert.ok(jobsHandler.jobsMeta.name);
      assert.ok(jobsHandler.jobsMeta.description);
      assert.ok(jobsHandler.jobsMeta.usage);
      assert.ok(jobsHandler.jobsMeta.requiresAuth);
    });
  });
});
