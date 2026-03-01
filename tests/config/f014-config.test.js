/**
 * Tests for F-014 Configuration
 * Phase 6: Unit Tests
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-014 Configuration', () => {
  let config;

  beforeEach(async () => {
    // Clear module cache and reimport
    const module = await import('../../src/config.js');
    config = module.config;
  });

  test('should have scheduledTasksPath config', () => {
    assert.ok(config.scheduledTasksPath, 'scheduledTasksPath should be defined');
    assert.equal(typeof config.scheduledTasksPath, 'string');
  });

  test('should have fileWatchersPath config', () => {
    assert.ok(config.fileWatchersPath, 'fileWatchersPath should be defined');
    assert.equal(typeof config.fileWatchersPath, 'string');
  });

  test('should have maxScheduledTasks config', () => {
    assert.ok(config.maxScheduledTasks, 'maxScheduledTasks should be defined');
    assert.equal(typeof config.maxScheduledTasks, 'number');
    assert.ok(config.maxScheduledTasks > 0, 'maxScheduledTasks should be positive');
  });

  test('should have maxFileWatchers config', () => {
    assert.ok(config.maxFileWatchers, 'maxFileWatchers should be defined');
    assert.equal(typeof config.maxFileWatchers, 'number');
    assert.ok(config.maxFileWatchers > 0, 'maxFileWatchers should be positive');
  });

  test('should have taskDebounceMs config', () => {
    assert.ok(config.taskDebounceMs, 'taskDebounceMs should be defined');
    assert.equal(typeof config.taskDebounceMs, 'number');
    assert.ok(config.taskDebounceMs > 0, 'taskDebounceMs should be positive');
  });

  test('should have default values', () => {
    // Default values from config.js
    assert.ok(config.scheduledTasksPath.includes('scheduled-tasks.json'));
    assert.ok(config.fileWatchersPath.includes('file-watchers.json'));
    assert.equal(config.maxScheduledTasks, 100);
    assert.equal(config.maxFileWatchers, 50);
    assert.equal(config.taskDebounceMs, 500);
  });
});
