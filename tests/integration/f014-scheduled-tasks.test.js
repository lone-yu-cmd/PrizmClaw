/**
 * Integration Tests for F-014 Scheduled Tasks
 * Phase 7: Integration Tests
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('F-014 Scheduled Tasks Integration', () => {
  let scheduledTaskService;
  let tempDir;
  let tasksFile;
  let notificationCalls;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `f014-scheduled-tasks-integration-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    tasksFile = path.join(tempDir, 'scheduled-tasks.json');

    // Import fresh module
    const module = await import('../../src/services/scheduled-task-service.js');
    scheduledTaskService = module.scheduledTaskService;
    scheduledTaskService.reset();

    notificationCalls = [];
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

  test('should complete full task lifecycle', async () => {
    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json',
      maxTasks: 10
    });

    // Add task
    const task = scheduledTaskService.addCronTask({
      schedule: '*/5 * * * *',
      command: 'echo hello',
      chatId: 'chat-123',
      userId: 'user-456'
    });

    assert.ok(task.id);
    assert.equal(task.enabled, true);

    // List tasks
    let tasks = scheduledTaskService.listTasks();
    assert.equal(tasks.length, 1);

    // Pause task
    const paused = scheduledTaskService.pauseTask(task.id);
    assert.equal(paused, true);

    tasks = scheduledTaskService.listTasks();
    assert.equal(tasks[0].enabled, false);

    // Resume task
    const resumed = scheduledTaskService.resumeTask(task.id);
    assert.equal(resumed, true);

    tasks = scheduledTaskService.listTasks();
    assert.equal(tasks[0].enabled, true);

    // Delete task
    const deleted = scheduledTaskService.deleteTask(task.id);
    assert.equal(deleted, true);

    tasks = scheduledTaskService.listTasks();
    assert.equal(tasks.length, 0);
  });

  test('should persist tasks across restart', async () => {
    // First session: create and save
    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json'
    });

    scheduledTaskService.addCronTask({
      schedule: '0 * * * *',
      command: 'hourly task',
      chatId: 'chat-789',
      userId: 'user-789'
    });

    await scheduledTaskService.saveTasks();

    // Verify file was created
    const content = await readFile(tasksFile, 'utf-8');
    const saved = JSON.parse(content);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].command, 'hourly task');

    // Simulate restart
    scheduledTaskService.reset();

    // Second session: load and verify
    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json'
    });

    await scheduledTaskService.loadTasks();

    const tasks = scheduledTaskService.listTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].command, 'hourly task');
  });

  test('should handle notification callback', async () => {
    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json'
    });

    // Set up notification callback
    scheduledTaskService.setNotificationCallback((chatId, task) => {
      notificationCalls.push({ chatId, taskId: task.id, result: task.lastResult });
    });

    // Add and execute a task manually
    const task = scheduledTaskService.addCronTask({
      schedule: '* * * * *',
      command: 'echo test',
      chatId: 'chat-notify-test',
      userId: 'user-notify'
    });

    // Set execute callback to simulate execution
    scheduledTaskService.setExecuteCallback(async () => ({
      stdout: 'test output',
      stderr: '',
      exitCode: 0,
      timedOut: false
    }));

    // Execute task
    await scheduledTaskService.executeTask(task.id);

    // Verify notification was called
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].chatId, 'chat-notify-test');
    assert.equal(notificationCalls[0].result.exitCode, 0);
  });

  test('should skip expired one-time tasks on load', async () => {
    // Create file with expired one-time task
    const pastTime = Date.now() - 3600000; // 1 hour ago
    const expiredTask = {
      id: 'expired-task-id',
      type: 'once',
      schedule: new Date(pastTime).toISOString(),
      command: 'expired command',
      chatId: 'chat-expired',
      userId: 'user-expired',
      enabled: true,
      createdAt: pastTime
    };

    await writeFile(tasksFile, JSON.stringify([expiredTask]));

    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json'
    });

    await scheduledTaskService.loadTasks();

    // Expired task should not be loaded
    const tasks = scheduledTaskService.listTasks();
    assert.equal(tasks.length, 0);
  });

  test('should enforce max tasks limit', async () => {
    scheduledTaskService.initScheduledTaskService({
      dataDir: tempDir,
      tasksFile: 'scheduled-tasks.json',
      maxTasks: 3
    });

    // Add tasks up to limit
    for (let i = 0; i < 3; i++) {
      scheduledTaskService.addCronTask({
        schedule: `*/${i + 1} * * * *`,
        command: `task-${i}`,
        chatId: 'chat-limit',
        userId: 'user-limit'
      });
    }

    // Fourth task should fail
    assert.throws(() => {
      scheduledTaskService.addCronTask({
        schedule: '*/10 * * * *',
        command: 'task-overflow',
        chatId: 'chat-limit',
        userId: 'user-limit'
      });
    }, /maximum.*tasks/i);

    // Delete one and add again should work
    const tasks = scheduledTaskService.listTasks();
    scheduledTaskService.deleteTask(tasks[0].id);

    const newTask = scheduledTaskService.addCronTask({
      schedule: '*/10 * * * *',
      command: 'task-new',
      chatId: 'chat-limit',
      userId: 'user-limit'
    });

    assert.ok(newTask.id);
  });
});
