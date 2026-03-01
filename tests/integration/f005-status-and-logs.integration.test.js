/**
 * Integration Tests for F-005: Pipeline Status Aggregation and Log Streaming
 *
 * Tests for US-1 through US-6:
 * - US-1: Aggregated Status Query
 * - US-2: Paginated Logs Query
 * - US-3: Message Length Compliance
 * - US-4: Heartbeat Progress Push
 * - US-5: Error Summary Push
 * - US-6: Diagnostic Error Messages
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createStatusAggregator } from '../../src/services/status-aggregator.js';
import { createLogPager } from '../../src/services/log-pager.js';
import { createTelegramPusher } from '../../src/services/telegram-pusher.js';

// ============================================================
// Test Helpers
// ============================================================

function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f005-integration-test-'));
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

function createMockConfig(stateDir, bugfixStateDir) {
  const projectRoot = path.dirname(path.dirname(stateDir));
  return {
    projectRoot,
    stateDir,
    bugfixStateDir
  };
}

function createMockBot() {
  const sentMessages = [];
  const sentFiles = [];

  return {
    telegram: {
      sendMessage: async (chatId, text, options = {}) => {
        sentMessages.push({ chatId, text, options });
        return { message_id: Date.now() };
      },
      sendDocument: async (chatId, document, options = {}) => {
        sentFiles.push({ chatId, document, options });
        return { message_id: Date.now() };
      }
    },
    _sentMessages: sentMessages,
    _sentFiles: sentFiles
  };
}

// ============================================================
// US-1: Aggregated Status Query Integration Tests (T-104)
// ============================================================

test('[US-1] Full status flow should aggregate running state correctly', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write state files
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({
        pid: process.pid,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        feature_list: '/path/to/feature-list.json'
      })
    );

    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({
        run_id: 'run-001',
        status: 'running',
        total_features: 10,
        completed_features: 4,
        failed_features: 1,
        in_progress_features: 1
      })
    );

    fs.writeFileSync(
      path.join(stateDir, 'current-session.json'),
      JSON.stringify({
        feature_id: 'F-005',
        started_at: new Date().toISOString()
      })
    );

    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');

    assert.equal(status.stage, 'running');
    assert.equal(status.type, 'feature');
    assert.ok(status.current);
    assert.equal(status.current.featureId, 'F-005');
    assert.ok(status.progress);
    assert.equal(status.progress.total, 10);
    assert.equal(status.progress.completed, 4);

    // Test formatting
    const formatted = aggregator.formatStatusForTelegram(status);
    assert.ok(formatted.includes('运行中') || formatted.includes('running'));
    assert.ok(formatted.includes('F-005'));
  } finally {
    cleanup();
  }
});

test('[US-1] Status should handle idle state with last result', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    fs.writeFileSync(
      path.join(stateDir, '.last-result.json'),
      JSON.stringify({
        runId: 'run-previous',
        completedAt: new Date().toISOString(),
        status: 'success',
        featuresTotal: 5,
        featuresCompleted: 5
      })
    );

    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');

    assert.equal(status.stage, 'idle');
    assert.ok(status.lastResult);
    assert.equal(status.lastResult.status, 'success');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-2: Paginated Logs Query Integration Tests (T-115)
// ============================================================

test('[US-2] Logs should paginate correctly', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Generate log file
    const lines = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`[${new Date().toISOString()}] [INFO] Log line ${i}`);
    }
    fs.writeFileSync(
      path.join(stateDir, 'pipeline-daemon.log'),
      lines.join('\n')
    );

    const pager = createLogPager({ config });

    // Test first page
    const page1 = await pager.readLogPage('feature', { lines: 20, offset: 0 });
    assert.ok(page1.ok);
    assert.ok(page1.logs);
    assert.equal(page1.metadata.requestedLines, 20);

    // Test second page
    const page2 = await pager.readLogPage('feature', { lines: 20, offset: 20 });
    assert.ok(page2.ok);
  } finally {
    cleanup();
  }
});

test('[US-2] Logs should return friendly message when missing', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const result = await pager.readLogPage('feature', { lines: 50 });

    assert.ok(result.ok);
    assert.ok(result.message || result.logs === '');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-3: Message Length Compliance Integration Tests (T-124)
// ============================================================

test('[US-3] Long messages should be chunked with segment numbering', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    segmentInterval: 10 // Fast for testing
  });

  // Create a message longer than 4000 chars
  const longMessage = 'x'.repeat(10000);
  await pusher.sendMessageChunked(123456, longMessage);

  // Should have sent multiple messages
  assert.ok(bot._sentMessages.length >= 2);

  // Check segment numbering
  const hasSegmentNumber = bot._sentMessages.some(m =>
    m.text.includes('[1/') || m.text.includes('[2/')
  );
  assert.ok(hasSegmentNumber);
});

test('[US-3] Should send as file when threshold exceeded', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    // Create large log content
    const largeLog = 'x'.repeat(5000);
    const shouldSendAsFile = pager.shouldSendAsFile(largeLog);

    assert.equal(shouldSendAsFile, true);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-4: Heartbeat Progress Push Integration Tests (T-136)
// ============================================================

test('[US-4] Heartbeat should push with throttle', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString()
      })
    );

    const bot = createMockBot();
    const aggregator = createStatusAggregator({ config });
    const pusher = createTelegramPusher({
      bot,
      targetChatId: 123456,
      heartbeatInterval: 50, // Fast for testing
      throttleInterval: 10
    });

    pusher.startHeartbeat('feature', aggregator);

    // Wait for heartbeat
    await new Promise(resolve => setTimeout(resolve, 100));

    pusher.stopHeartbeat('feature');

    // Should have sent at least one message
    assert.ok(bot._sentMessages.length >= 1);
  } finally {
    cleanup();
  }
});

// ============================================================
// US-5: Error Summary Push Integration Tests (T-144)
// ============================================================

test('[US-5] Error summary should include all required info', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    errorLinesCount: 5
  });

  const error = {
    type: 'execution_error',
    message: 'Script execution failed',
    duration: 180,
    logLines: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5']
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  assert.equal(bot._sentMessages.length, 1);
  const text = bot._sentMessages[0].text;

  // Should include feature ID
  assert.ok(text.includes('F-005'));

  // Should include error type
  assert.ok(text.includes('execution_error') || text.includes('类型'));

  // Should include duration
  assert.ok(text.includes('180') || text.includes('3m') || text.includes('执行时间'));

  // Should include log lines
  assert.ok(text.includes('Error'));
});

// ============================================================
// US-6: Diagnostic Error Messages Integration Tests (T-155)
// ============================================================

test('[US-6] Should provide diagnostic for missing state files', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });

    const status = await aggregator.aggregateStatus('feature');

    // Should return idle state, not throw
    assert.equal(status.stage, 'idle');
  } finally {
    cleanup();
  }
});

test('[US-6] Should handle corrupted JSON gracefully', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);

    // Write corrupted JSON
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      'not valid json {{{'
    );

    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');

    // Should not throw, return idle
    assert.equal(status.stage, 'idle');
  } finally {
    cleanup();
  }
});

test('[US-6] Should provide diagnostic for missing log files', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });

    const result = await pager.readLogPage('feature', { lines: 50 });

    assert.ok(result.ok);
    assert.ok(result.message || result.logs === '');
    assert.ok(result.metadata.logPath);
  } finally {
    cleanup();
  }
});
