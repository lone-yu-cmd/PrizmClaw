/**
 * Log Pager Unit Tests
 * Tests for src/services/log-pager.js
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-2: Paginated Logs Query, US-3: Message Length Compliance
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createLogPager } from '../../src/services/log-pager.js';

/**
 * Helper to create temp directory for test state
 */
function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-pager-test-'));
  const stateDir = path.join(tempDir, 'dev-pipeline', 'state');
  const bugfixStateDir = path.join(tempDir, 'dev-pipeline', 'bugfix-state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(bugfixStateDir, { recursive: true });
  return {
    tempDir,
    stateDir,
    bugfixStateDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Helper to create a mock config
 */
function createMockConfig(stateDir, bugfixStateDir) {
  const projectRoot = path.dirname(path.dirname(stateDir));
  return {
    projectRoot,
    stateDir,
    bugfixStateDir
  };
}

/**
 * Helper to generate sample log content
 */
function generateLogLines(count) {
  const lines = [];
  for (let i = 1; i <= count; i++) {
    lines.push(`[${new Date().toISOString()}] [INFO] Log line ${i}: Some log content here`);
  }
  return lines.join('\n');
}

/**
 * Helper to generate log with errors
 */
function generateLogWithErrors() {
  return `[
${new Date().toISOString()}] [INFO] Starting pipeline
[${new Date().toISOString()}] [INFO] Processing F-001
[${new Date().toISOString()}] [ERROR] Failed to process F-001: Script failed
[${new Date().toISOString()}] [INFO] Processing F-002
[${new Date().toISOString()}] [ERROR] Exception: ENOENT: no such file
[${new Date().toISOString()}] [ERROR] Stack trace line 1
[${new Date().toISOString()}] [ERROR] Stack trace line 2
[${new Date().toISOString()}] [INFO] Completed`;
}

// ============================================================
// Factory Tests
// ============================================================

test('createLogPager should be a factory function', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    assert.equal(typeof pager.readLogPage, 'function');
    assert.equal(typeof pager.formatLogsForTelegram, 'function');
    assert.equal(typeof pager.extractErrorLines, 'function');
    assert.equal(typeof pager.shouldSendAsFile, 'function');
    assert.equal(typeof pager.buildLogMetadata, 'function');
  } finally {
    cleanup();
  }
});

// ============================================================
// readLogPage Tests (T-020, T-026)
// ============================================================

test('readLogPage should return last N lines by default', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write log file with 200 lines
    fs.writeFileSync(
      path.join(stateDir, 'pipeline-daemon.log'),
      generateLogLines(200)
    );

    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 50 });

    assert.equal(result.ok, true);
    assert.ok(result.logs);
    assert.ok(result.metadata);
    assert.equal(result.metadata.requestedLines, 50);
    assert.ok(result.metadata.actualLines <= 50);
  } finally {
    cleanup();
  }
});

test('readLogPage should support offset parameter', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write log file
    fs.writeFileSync(
      path.join(stateDir, 'pipeline-daemon.log'),
      generateLogLines(100)
    );

    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 20, offset: 10 });

    assert.equal(result.ok, true);
    assert.ok(result.metadata.pageStart > 0);
  } finally {
    cleanup();
  }
});

test('readLogPage should cap lines at max 500', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    fs.writeFileSync(
      path.join(stateDir, 'pipeline-daemon.log'),
      generateLogLines(1000)
    );

    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 1000 });

    // Should cap at 500
    assert.ok(result.metadata.actualLines <= 500);
  } finally {
    cleanup();
  }
});

test('readLogPage should return friendly message for missing log file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const result = await pager.readLogPage('feature', { lines: 50 });

    assert.equal(result.ok, true);
    assert.ok(result.logs === '' || result.message);
    assert.ok(result.metadata);
  } finally {
    cleanup();
  }
});

test('readLogPage should work for bugfix type', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    fs.writeFileSync(
      path.join(bugfixStateDir, 'pipeline-daemon.log'),
      generateLogLines(50)
    );

    const pager = createLogPager({ config });
    const result = await pager.readLogPage('bugfix', { lines: 20 });

    assert.equal(result.ok, true);
    assert.ok(result.logs);
  } finally {
    cleanup();
  }
});

// ============================================================
// extractErrorLines Tests (T-022, T-027)
// ============================================================

test('extractErrorLines should extract lines containing ERROR', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const logs = generateLogWithErrors();
    const errorLines = pager.extractErrorLines(logs, 10);

    assert.ok(Array.isArray(errorLines));
    assert.ok(errorLines.length > 0);
    assert.ok(errorLines.every(line => line.includes('ERROR')));
  } finally {
    cleanup();
  }
});

test('extractErrorLines should limit to N lines', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const logs = generateLogWithErrors();
    const errorLines = pager.extractErrorLines(logs, 2);

    assert.ok(errorLines.length <= 2);
  } finally {
    cleanup();
  }
});

test('extractErrorLines should return empty array for no errors', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const logs = generateLogLines(50);
    const errorLines = pager.extractErrorLines(logs, 10);

    assert.deepEqual(errorLines, []);
  } finally {
    cleanup();
  }
});

// ============================================================
// shouldSendAsFile Tests (T-023, T-027)
// ============================================================

test('shouldSendAsFile should return true for large logs', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    // Create log larger than 4000 chars
    const largeLog = 'x'.repeat(5000);
    const result = pager.shouldSendAsFile(largeLog);

    assert.equal(result, true);
  } finally {
    cleanup();
  }
});

test('shouldSendAsFile should return false for small logs', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const smallLog = 'x'.repeat(1000);
    const result = pager.shouldSendAsFile(smallLog);

    assert.equal(result, false);
  } finally {
    cleanup();
  }
});

test('shouldSendAsFile should use custom threshold', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const log = 'x'.repeat(2000);
    const result = pager.shouldSendAsFile(log, 1500);

    assert.equal(result, true);
  } finally {
    cleanup();
  }
});

// ============================================================
// formatLogsForTelegram Tests (T-024)
// ============================================================

test('formatLogsForTelegram should add metadata header', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const logs = generateLogLines(20);
    const metadata = {
      logPath: '/path/to/log',
      totalLines: 100,
      pageStart: 80,
      pageEnd: 100,
      requestedLines: 20,
      actualLines: 20
    };

    const formatted = pager.formatLogsForTelegram(logs, metadata);

    assert.ok(formatted.includes('100')); // total lines
    assert.ok(formatted.includes('80')); // page start
    assert.ok(logs.split('\n')[0]); // log content
  } finally {
    cleanup();
  }
});

test('formatLogsForTelegram should handle empty logs', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const formatted = pager.formatLogsForTelegram('', { totalLines: 0 });

    assert.ok(formatted);
  } finally {
    cleanup();
  }
});

// ============================================================
// buildLogMetadata Tests (T-025)
// ============================================================

test('buildLogMetadata should create metadata object', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const metadata = pager.buildLogMetadata('/path/to/log', 100, 80, 100, 20, 20);

    assert.equal(metadata.logPath, '/path/to/log');
    assert.equal(metadata.totalLines, 100);
    assert.equal(metadata.pageStart, 80);
    assert.equal(metadata.pageEnd, 100);
    assert.equal(metadata.requestedLines, 20);
    assert.equal(metadata.actualLines, 20);
  } finally {
    cleanup();
  }
});

// ============================================================
// Message Segment Numbering Tests (T-121) - US-3
// ============================================================

test('formatLogsForTelegram should add segment numbering for chunked output', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const logs = generateLogLines(100);
    const metadata = {
      logPath: '/path/to/log',
      totalLines: 100,
      pageStart: 0,
      pageEnd: 100,
      requestedLines: 100,
      actualLines: 100,
      segmentIndex: 0,
      totalSegments: 3
    };

    const formatted = pager.formatLogsForTelegram(logs, metadata);

    // Should include segment numbering like [1/3]
    assert.ok(formatted.includes('[1/3]') || !metadata.totalSegments);
  } finally {
    cleanup();
  }
});

// ============================================================
// Diagnostic Error Tests (T-152) - US-6
// ============================================================

test('readLogPage should return diagnostic message for missing log file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const result = await pager.readLogPage('feature', { lines: 50 });

    assert.equal(result.ok, true);
    // Should have a friendly message
    assert.ok(result.message || result.logs === '');
    assert.ok(result.metadata.logPath);
  } finally {
    cleanup();
  }
});
