/**
 * Scheduled Task Service
 * F-014: Notification and Scheduled Tasks
 *
 * Manages scheduled tasks with cron expressions and one-time execution.
 * Integrates with executeCommand for task execution and Telegram for notifications.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Cron } from 'croner';

class ScheduledTaskServiceClass {
  #dataDir = null;
  #tasksFile = 'scheduled-tasks.json';
  #maxTasks = 100;
  #tasks = new Map();
  #cronJobs = new Map();
  #notificationCallback = null;
  #executeCallback = null;
  #isInitialized = false;
  #schedulerRunning = false;

  reset() {
    this.#dataDir = null;
    this.#tasks.clear();
    this.#cronJobs.clear();
    this.#notificationCallback = null;
    this.#executeCallback = null;
    this.#isInitialized = false;
    this.#schedulerRunning = false;
  }

  isInitialized() {
    return this.#isInitialized;
  }

  initScheduledTaskService({ dataDir, tasksFile, maxTasks }) {
    this.#dataDir = dataDir;
    if (tasksFile) this.#tasksFile = tasksFile;
    if (maxTasks !== undefined) this.#maxTasks = maxTasks;
    this.#isInitialized = true;
  }

  #checkInitialized() {
    if (!this.#isInitialized) {
      throw new Error('ScheduledTaskService not initialized. Call initScheduledTaskService first.');
    }
  }

  async #ensureDataDir() {
    if (this.#dataDir) {
      await mkdir(this.#dataDir, { recursive: true });
    }
  }

  setNotificationCallback(callback) {
    this.#notificationCallback = callback;
  }

  setExecuteCallback(callback) {
    this.#executeCallback = callback;
  }

  /**
   * Validate cron expression using croner
   * @param {string} expression - Cron expression
   * @returns {boolean} - True if valid
   */
  #validateCronExpression(expression) {
    try {
      const cron = new Cron(expression);
      cron.stop();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse datetime string to Date object
   * @param {string} datetime - ISO timestamp or 'YYYY-MM-DD HH:mm' format
   * @returns {Date|null} - Parsed date or null if invalid
   */
  #parseDatetime(datetime) {
    // Try ISO format first
    const isoDate = new Date(datetime);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try 'YYYY-MM-DD HH:mm' format
    const match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }

    return null;
  }

  /**
   * Add a cron-based recurring task
   */
  addCronTask({ schedule, command, chatId, userId, cwd }) {
    this.#checkInitialized();

    // Validate cron expression
    if (!this.#validateCronExpression(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    // Check max tasks limit
    if (this.#tasks.size >= this.#maxTasks) {
      throw new Error(`Maximum number of tasks (${this.#maxTasks}) reached`);
    }

    const id = randomUUID();
    const task = {
      id,
      type: 'cron',
      schedule,
      command,
      chatId,
      userId,
      cwd: cwd || null,
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastResult: null,
      nextRunAt: this.#getNextRunTime(schedule)
    };

    this.#tasks.set(id, task);

    // If scheduler is running, schedule this task
    if (this.#schedulerRunning) {
      this.#scheduleCronTask(task);
    }

    return { ...task };
  }

  /**
   * Add a one-time task
   */
  addOneTimeTask({ schedule, command, chatId, userId, cwd }) {
    this.#checkInitialized();

    // Parse datetime
    const scheduledDate = this.#parseDatetime(schedule);
    if (!scheduledDate) {
      throw new Error(`Invalid datetime format: ${schedule}`);
    }

    // Check if in the past
    if (scheduledDate.getTime() <= Date.now()) {
      throw new Error('Cannot schedule task in the past');
    }

    // Check max tasks limit
    if (this.#tasks.size >= this.#maxTasks) {
      throw new Error(`Maximum number of tasks (${this.#maxTasks}) reached`);
    }

    const id = randomUUID();
    const task = {
      id,
      type: 'once',
      schedule: scheduledDate.toISOString(),
      command,
      chatId,
      userId,
      cwd: cwd || null,
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastResult: null,
      nextRunAt: scheduledDate.getTime()
    };

    this.#tasks.set(id, task);

    // If scheduler is running, schedule this task
    if (this.#schedulerRunning) {
      this.#scheduleOneTimeTask(task);
    }

    return { ...task };
  }

  /**
   * Get next run time for cron expression
   */
  #getNextRunTime(schedule) {
    try {
      const cron = new Cron(schedule);
      const next = cron.nextRun();
      cron.stop();
      return next ? next.getTime() : null;
    } catch {
      return null;
    }
  }

  /**
   * List tasks, optionally filtered by chatId
   */
  listTasks({ chatId } = {}) {
    const tasks = Array.from(this.#tasks.values());
    if (chatId) {
      return tasks.filter(t => t.chatId === chatId).map(t => ({ ...t }));
    }
    return tasks.map(t => ({ ...t }));
  }

  /**
   * Get a single task by ID
   */
  getTask(taskId) {
    const task = this.#tasks.get(taskId);
    return task ? { ...task } : null;
  }

  /**
   * Pause a task
   */
  pauseTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) return false;

    task.enabled = false;

    // Stop any running cron job
    const cronJob = this.#cronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.#cronJobs.delete(taskId);
    }

    return true;
  }

  /**
   * Resume a paused task
   */
  resumeTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) return false;

    task.enabled = true;

    // Re-schedule if scheduler is running
    if (this.#schedulerRunning) {
      if (task.type === 'cron') {
        this.#scheduleCronTask(task);
      } else {
        this.#scheduleOneTimeTask(task);
      }
    }

    return true;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) return false;

    // Stop any running cron job
    const cronJob = this.#cronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.#cronJobs.delete(taskId);
    }

    this.#tasks.delete(taskId);
    return true;
  }

  /**
   * Execute a task
   */
  async executeTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const executedAt = Date.now();
    let result;

    try {
      if (this.#executeCallback) {
        result = await this.#executeCallback({
          command: task.command,
          cwd: task.cwd,
          sessionId: `scheduled:${taskId}`,
          userId: task.userId
        });
      } else {
        // Fallback: just record execution without actual command
        result = {
          stdout: '',
          stderr: 'No execute callback configured',
          exitCode: 1,
          timedOut: false
        };
      }
    } catch (error) {
      result = {
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        timedOut: false
      };
    }

    // Update task
    task.lastRunAt = executedAt;
    task.lastResult = {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode,
      timedOut: result.timedOut || false,
      executedAt
    };

    // Update next run time for cron tasks
    if (task.type === 'cron') {
      task.nextRunAt = this.#getNextRunTime(task.schedule);
    }

    // Notify via callback
    if (this.#notificationCallback) {
      await this.#notificationCallback(task.chatId, task);
    }

    return task.lastResult;
  }

  /**
   * Schedule a cron task
   */
  #scheduleCronTask(task) {
    if (!task.enabled) return;

    try {
      const cronJob = new Cron(task.schedule, async () => {
        await this.executeTask(task.id);
      });

      this.#cronJobs.set(task.id, cronJob);
    } catch (error) {
      console.error(`Failed to schedule cron task ${task.id}:`, error.message);
    }
  }

  /**
   * Schedule a one-time task
   */
  #scheduleOneTimeTask(task) {
    if (!task.enabled) return;

    const delay = new Date(task.schedule).getTime() - Date.now();
    if (delay <= 0) return;

    const timeoutId = setTimeout(async () => {
      await this.executeTask(task.id);
      // One-time tasks delete themselves after execution
      this.deleteTask(task.id);
    }, delay);

    // Store as a pseudo-cron job for tracking
    this.#cronJobs.set(task.id, { stop: () => clearTimeout(timeoutId) });
  }

  /**
   * Start the scheduler
   */
  startScheduler() {
    if (this.#schedulerRunning) {
      throw new Error('Scheduler is already running');
    }

    this.#checkInitialized();
    this.#schedulerRunning = true;

    // Schedule all enabled tasks
    for (const task of this.#tasks.values()) {
      if (task.enabled) {
        if (task.type === 'cron') {
          this.#scheduleCronTask(task);
        } else {
          this.#scheduleOneTimeTask(task);
        }
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stopScheduler() {
    for (const cronJob of this.#cronJobs.values()) {
      cronJob.stop();
    }
    this.#cronJobs.clear();
    this.#schedulerRunning = false;
  }

  isSchedulerRunning() {
    return this.#schedulerRunning;
  }

  /**
   * Save tasks to disk
   */
  async saveTasks() {
    this.#checkInitialized();
    await this.#ensureDataDir();

    const filePath = join(this.#dataDir, this.#tasksFile);
    const tasks = Array.from(this.#tasks.values());
    await writeFile(filePath, JSON.stringify(tasks, null, 2), 'utf-8');
  }

  /**
   * Load tasks from disk
   */
  async loadTasks() {
    this.#checkInitialized();

    try {
      const filePath = join(this.#dataDir, this.#tasksFile);
      const content = await readFile(filePath, 'utf-8');
      const tasks = JSON.parse(content);

      this.#tasks.clear();
      for (const task of tasks) {
        if (task.id && task.type && task.command) {
          // Skip one-time tasks that are in the past
          if (task.type === 'once') {
            const scheduledDate = new Date(task.schedule);
            if (scheduledDate.getTime() <= Date.now()) {
              continue;
            }
          }
          this.#tasks.set(task.id, task);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load tasks:', error.message);
      }
      this.#tasks.clear();
    }
  }
}

export const scheduledTaskService = new ScheduledTaskServiceClass();
export default ScheduledTaskServiceClass;
