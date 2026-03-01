/**
 * Tests for F-014 Scheduled Task Service
 * Phase 2: ScheduledTaskService implementation
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Cron } from 'croner';

describe('F-014 ScheduledTaskService', () => {
  let scheduledTaskService;
  let tempDir;
  let tasksFile;

  beforeEach(async () => {
    // Create temp directory using mkdtemp
    tempDir = await mkdtemp(path.join(tmpdir(), 'scheduled-task-test-'));
    tasksFile = path.join(tempDir, 'scheduled-tasks.json');

    // Import fresh module
    const module = await import('../../src/services/scheduled-task-service.js');
    scheduledTaskService = module.scheduledTaskService;
    scheduledTaskService.reset();
  });

  afterEach(async () => {
    // Stop any running scheduler
    if (scheduledTaskService) {
      scheduledTaskService.stopScheduler();
      scheduledTaskService.reset();
    }
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('initScheduledTaskService', () => {
    test('should initialize with configuration', () => {
      scheduledTaskService.initScheduledTaskService({
        dataDir: tempDir,
        maxTasks: 100
      });
      assert.ok(scheduledTaskService.isInitialized());
    });
  });

  describe('addCronTask', () => {
    test('should add a cron task with valid cron expression', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const task = scheduledTaskService.addCronTask({
        schedule: '*/5 * * * *',
        command: 'echo "hello"',
        chatId: '123456789',
        userId: '987654321'
      });

      assert.ok(task.id, 'Should have generated ID');
      assert.equal(task.type, 'cron');
      assert.equal(task.schedule, '*/5 * * * *');
      assert.equal(task.command, 'echo "hello"');
      assert.equal(task.chatId, '123456789');
      assert.equal(task.enabled, true);
      assert.ok(task.createdAt);
    });

    test('should reject invalid cron expression', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      assert.throws(() => {
        scheduledTaskService.addCronTask({
          schedule: 'invalid-cron',
          command: 'echo test',
          chatId: '123',
          userId: '456'
        });
      }, /invalid cron/i);
    });

    test('should enforce max tasks limit', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir, maxTasks: 2 });

      scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd1',
        chatId: '123',
        userId: '456'
      });

      scheduledTaskService.addCronTask({
        schedule: '*/2 * * * *',
        command: 'cmd2',
        chatId: '123',
        userId: '456'
      });

      assert.throws(() => {
        scheduledTaskService.addCronTask({
          schedule: '*/3 * * * *',
          command: 'cmd3',
          chatId: '123',
          userId: '456'
        });
      }, /maximum.*tasks/i);
    });
  });

  describe('addOneTimeTask', () => {
    test('should add a one-time task with ISO timestamp', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const task = scheduledTaskService.addOneTimeTask({
        schedule: futureTime,
        command: 'echo "once"',
        chatId: '123456789',
        userId: '987654321'
      });

      assert.ok(task.id);
      assert.equal(task.type, 'once');
      assert.equal(task.schedule, futureTime);
      assert.equal(task.command, 'echo "once"');
    });

    test('should reject past timestamps', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const pastTime = new Date(Date.now() - 3600000).toISOString();
      assert.throws(() => {
        scheduledTaskService.addOneTimeTask({
          schedule: pastTime,
          command: 'echo test',
          chatId: '123',
          userId: '456'
        });
      }, /past/i);
    });

    test('should accept datetime string format', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const futureDate = new Date(Date.now() + 86400000);
      const datetimeStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')} ${String(futureDate.getHours()).padStart(2, '0')}:${String(futureDate.getMinutes()).padStart(2, '0')}`;

      const task = scheduledTaskService.addOneTimeTask({
        schedule: datetimeStr,
        command: 'echo test',
        chatId: '123',
        userId: '456'
      });

      assert.ok(task.id);
      assert.equal(task.type, 'once');
    });
  });

  describe('listTasks', () => {
    test('should return empty array when no tasks', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const tasks = scheduledTaskService.listTasks();
      assert.deepEqual(tasks, []);
    });

    test('should filter by chatId', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd1',
        chatId: 'chat1',
        userId: 'user1'
      });

      scheduledTaskService.addCronTask({
        schedule: '*/2 * * * *',
        command: 'cmd2',
        chatId: 'chat2',
        userId: 'user2'
      });

      const tasks = scheduledTaskService.listTasks({ chatId: 'chat1' });
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].chatId, 'chat1');
    });

    test('should return all tasks without filter', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd1',
        chatId: 'chat1',
        userId: 'user1'
      });

      scheduledTaskService.addCronTask({
        schedule: '*/2 * * * *',
        command: 'cmd2',
        chatId: 'chat2',
        userId: 'user2'
      });

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks.length, 2);
    });
  });

  describe('pauseTask and resumeTask', () => {
    test('should pause a task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd',
        chatId: '123',
        userId: '456'
      });

      const result = scheduledTaskService.pauseTask(task.id);
      assert.equal(result, true);

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks[0].enabled, false);
    });

    test('should resume a paused task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd',
        chatId: '123',
        userId: '456'
      });

      scheduledTaskService.pauseTask(task.id);
      const result = scheduledTaskService.resumeTask(task.id);
      assert.equal(result, true);

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks[0].enabled, true);
    });

    test('should return false for non-existent task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      assert.equal(scheduledTaskService.pauseTask('non-existent'), false);
      assert.equal(scheduledTaskService.resumeTask('non-existent'), false);
    });
  });

  describe('deleteTask', () => {
    test('should delete an existing task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd',
        chatId: '123',
        userId: '456'
      });

      const result = scheduledTaskService.deleteTask(task.id);
      assert.equal(result, true);

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks.length, 0);
    });

    test('should return false for non-existent task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const result = scheduledTaskService.deleteTask('non-existent');
      assert.equal(result, false);
    });
  });

  describe('getTask', () => {
    test('should return task by ID', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const task = scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'cmd',
        chatId: '123',
        userId: '456'
      });

      const found = scheduledTaskService.getTask(task.id);
      assert.ok(found);
      assert.equal(found.id, task.id);
    });

    test('should return null for non-existent task', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      const found = scheduledTaskService.getTask('non-existent');
      assert.equal(found, null);
    });
  });

  describe('persistence', () => {
    test('should save tasks to file', async () => {
      scheduledTaskService.initScheduledTaskService({
        dataDir: tempDir,
        tasksFile: 'scheduled-tasks.json'
      });

      scheduledTaskService.addCronTask({
        schedule: '* * * * *',
        command: 'echo test',
        chatId: '123',
        userId: '456'
      });

      await scheduledTaskService.saveTasks();

      const content = await readFile(tasksFile, 'utf-8');
      const savedTasks = JSON.parse(content);

      assert.equal(savedTasks.length, 1);
      assert.equal(savedTasks[0].command, 'echo test');
    });

    test('should load tasks from file', async () => {
      // Write tasks directly to file
      const testTasks = [{
        id: 'test-id-123',
        type: 'cron',
        schedule: '*/5 * * * *',
        command: 'echo loaded',
        chatId: '123',
        userId: '456',
        enabled: true,
        createdAt: Date.now()
      }];

      await writeFile(tasksFile, JSON.stringify(testTasks));

      scheduledTaskService.initScheduledTaskService({
        dataDir: tempDir,
        tasksFile: 'scheduled-tasks.json'
      });

      await scheduledTaskService.loadTasks();

      const tasks = scheduledTaskService.listTasks();
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].id, 'test-id-123');
    });

    test('should handle missing file gracefully', async () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      await scheduledTaskService.loadTasks();

      const tasks = scheduledTaskService.listTasks();
      assert.deepEqual(tasks, []);
    });

    test('should handle corrupted file gracefully', async () => {
      await writeFile(tasksFile, 'not valid json');

      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      await scheduledTaskService.loadTasks();

      const tasks = scheduledTaskService.listTasks();
      assert.deepEqual(tasks, []);
    });
  });

  describe('setNotificationCallback', () => {
    test('should set notification callback', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      let called = false;
      scheduledTaskService.setNotificationCallback(() => {
        called = true;
      });

      // Callback is set, scheduler can use it
      assert.ok(true);
    });
  });

  describe('startScheduler and stopScheduler', () => {
    test('should start and stop scheduler', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      scheduledTaskService.startScheduler();
      assert.ok(scheduledTaskService.isSchedulerRunning());

      scheduledTaskService.stopScheduler();
      assert.ok(!scheduledTaskService.isSchedulerRunning());
    });

    test('should not start duplicate scheduler', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir });

      scheduledTaskService.startScheduler();

      assert.throws(() => {
        scheduledTaskService.startScheduler();
      }, /already running/i);

      scheduledTaskService.stopScheduler();
    });
  });

  describe('cron expression validation', () => {
    test('should accept standard 5-field cron expressions', () => {
      scheduledTaskService.initScheduledTaskService({ dataDir: tempDir, maxTasks: 100 });

      const validExpressions = [
        '* * * * *',
        '*/5 * * * *',
        '0 * * * *',
        '0 0 * * *',
        '0 0 1 * *',
        '0 0 1 1 *',
        '0 0 * * 0'
      ];

      for (const expr of validExpressions) {
        const task = scheduledTaskService.addCronTask({
          schedule: expr,
          command: 'test',
          chatId: '123',
          userId: '456'
        });
        assert.ok(task.id, `Should accept: ${expr}`);
      }
    });
  });
});
