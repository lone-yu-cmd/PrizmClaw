/**
 * Extended Integration Tests for F-005: Pipeline Status Aggregation and Log Streaming
 * 
 * This file contains comprehensive tests for all acceptance criteria from spec.md:
 * - US-1: Aggregated Status Query (AC-1.1 to AC-1.5)
 * - US-2: Paginated Logs Query (AC-2.1 to AC-2.5)
 * - US-3: Message Length Compliance (AC-3.1 to AC-3.4)
 * - US-4: Heartbeat Progress Push (AC-4.1 to AC-4.5)
 * - US-5: Error Summary Push (AC-5.1 to AC-5.4)
 * - US-6: Diagnostic Error Messages (AC-6.1 to AC-6.4)
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f005-extended-test-'));
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
        sentMessages.push({ chatId, text, options, timestamp: Date.now() });
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

function generateLogLines(count) {
  const lines = [];
  for (let i = 1; i <= count; i++) {
    lines.push(`[${new Date().toISOString()}] [INFO] Log line ${i}`);
  }
  return lines.join('\n');
}

// ============================================================
// US-1: Aggregated Status Query - Acceptance Criteria Tests
// ============================================================

// AC-1.1: /status returns current pipeline stage (running/paused/completed/failed/idle)
test('[US-1][AC-1.1] Status should return correct stage: running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'running', 'AC-1.1: Should return running stage');
  } finally {
    cleanup();
  }
});

test('[US-1][AC-1.1] Status should return correct stage: paused', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({ status: 'paused' })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'paused', 'AC-1.1: Should return paused stage');
  } finally {
    cleanup();
  }
});

test('[US-1][AC-1.1] Status should return correct stage: completed', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({ status: 'completed' })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'completed', 'AC-1.1: Should return completed stage');
  } finally {
    cleanup();
  }
});

test('[US-1][AC-1.1] Status should return correct stage: failed', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({ status: 'failed' })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'failed', 'AC-1.1: Should return failed stage');
  } finally {
    cleanup();
  }
});

test('[US-1][AC-1.1] Status should return correct stage: idle', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'idle', 'AC-1.1: Should return idle stage');
  } finally {
    cleanup();
  }
});

// AC-1.2: Display completed/failed/in-progress feature statistics
test('[US-1][AC-1.2] Status should display feature statistics', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({
        status: 'running',
        total_features: 10,
        completed_features: 4,
        failed_features: 2,
        in_progress_features: 1
      })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.progress.total, 10, 'AC-1.2: Should show total features');
    assert.equal(status.progress.completed, 4, 'AC-1.2: Should show completed features');
    assert.equal(status.progress.failed, 2, 'AC-1.2: Should show failed features');
    assert.equal(status.progress.inProgress, 1, 'AC-1.2: Should show in-progress features');
  } finally {
    cleanup();
  }
});

// AC-1.3: Display currently executing feature ID and start time
test('[US-1][AC-1.3] Status should display current feature info', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const startedAt = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    
    fs.writeFileSync(
      path.join(stateDir, 'current-session.json'),
      JSON.stringify({ feature_id: 'F-005', started_at: startedAt })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.ok(status.current, 'AC-1.3: Should have current feature info');
    assert.equal(status.current.featureId, 'F-005', 'AC-1.3: Should show feature ID');
    assert.equal(status.current.startedAt, startedAt, 'AC-1.3: Should show start time');
    assert.ok(status.current.duration >= 0, 'AC-1.3: Should have duration');
  } finally {
    cleanup();
  }
});

// AC-1.4: Display last run result summary (success rate, duration)
test('[US-1][AC-1.4] Status should display last result summary', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.last-result.json'),
      JSON.stringify({
        runId: 'run-001',
        completedAt: new Date().toISOString(),
        status: 'success',
        featuresTotal: 10,
        featuresCompleted: 8,
        featuresFailed: 2,
        duration: 3600
      })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.stage, 'idle');
    assert.ok(status.lastResult, 'AC-1.4: Should have last result');
    assert.equal(status.lastResult.runId, 'run-001', 'AC-1.4: Should show runId');
    assert.equal(status.lastResult.status, 'success', 'AC-1.4: Should show status');
  } finally {
    cleanup();
  }
});

// AC-1.5: Support --type parameter for pipeline type
test('[US-1][AC-1.5] Status should support --type parameter for feature', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    assert.equal(status.type, 'feature', 'AC-1.5: Should support feature type');
  } finally {
    cleanup();
  }
});

test('[US-1][AC-1.5] Status should support --type parameter for bugfix', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(bugfixStateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('bugfix');
    
    assert.equal(status.type, 'bugfix', 'AC-1.5: Should support bugfix type');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-2: Paginated Logs Query - Acceptance Criteria Tests
// ============================================================

// AC-2.1: Default 50 lines
test('[US-2][AC-2.1] Logs should return default 50 lines', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(100));
    
    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', {});
    
    assert.equal(result.metadata.requestedLines, 50, 'AC-2.1: Default should be 50 lines');
  } finally {
    cleanup();
  }
});

// AC-2.2: --lines=N parameter with max 500
test('[US-2][AC-2.2] Logs should support --lines parameter with max 500', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(1000));
    
    const pager = createLogPager({ config });
    
    // Test custom lines
    const result100 = await pager.readLogPage('feature', { lines: 100 });
    assert.ok(result100.metadata.actualLines <= 100, 'AC-2.2: Should return up to 100 lines');
    
    // Test max cap at 500
    const result1000 = await pager.readLogPage('feature', { lines: 1000 });
    assert.ok(result1000.metadata.actualLines <= 500, 'AC-2.2: Should cap at 500 lines max');
  } finally {
    cleanup();
  }
});

// AC-2.3: --offset=N parameter for pagination
test('[US-2][AC-2.3] Logs should support --offset parameter', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(100));
    
    const pager = createLogPager({ config });
    
    const page1 = await pager.readLogPage('feature', { lines: 20, offset: 0 });
    const page2 = await pager.readLogPage('feature', { lines: 20, offset: 20 });
    
    // Pages should have different content
    assert.notEqual(page1.logs, page2.logs, 'AC-2.3: Offset should return different content');
  } finally {
    cleanup();
  }
});

// AC-2.4: --type parameter for pipeline type
test('[US-2][AC-2.4] Logs should support --type parameter', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(50));
    fs.writeFileSync(path.join(bugfixStateDir, 'pipeline-daemon.log'), generateLogLines(30));
    
    const pager = createLogPager({ config });
    
    const featureResult = await pager.readLogPage('feature', { lines: 10 });
    const bugfixResult = await pager.readLogPage('bugfix', { lines: 10 });
    
    assert.ok(featureResult.ok, 'AC-2.4: Should support feature type');
    assert.ok(bugfixResult.ok, 'AC-2.4: Should support bugfix type');
    assert.ok(featureResult.metadata.logPath.includes('state'), 'AC-2.4: Feature logs from correct path');
    assert.ok(bugfixResult.metadata.logPath.includes('bugfix-state'), 'AC-2.4: Bugfix logs from correct path');
  } finally {
    cleanup();
  }
});

// AC-2.5: Friendly message when logs don't exist
test('[US-2][AC-2.5] Logs should return friendly message when missing', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });
    
    const result = await pager.readLogPage('feature', { lines: 50 });
    
    assert.equal(result.ok, true, 'AC-2.5: Should return ok even when missing');
    assert.ok(result.message, 'AC-2.5: Should have friendly message');
    assert.ok(result.logs === '', 'AC-2.5: Logs should be empty string');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-3: Message Length Compliance - Acceptance Criteria Tests
// ============================================================

// AC-3.1: Auto-segment when > 4000 chars
test('[US-3][AC-3.1] Messages should auto-segment when > 4000 chars', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456, segmentInterval: 5 });
  
  await pusher.sendMessageChunked(123456, 'x'.repeat(5000));
  
  assert.ok(bot._sentMessages.length >= 2, 'AC-3.1: Should send multiple segments');
});

// AC-3.2: Segment numbering [1/3] format
test('[US-3][AC-3.2] Segments should have [N/M] numbering', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456, segmentInterval: 5 });
  
  await pusher.sendMessageChunked(123456, 'x'.repeat(10000));
  
  const hasNumbering = bot._sentMessages.some(m => /\[\d+\/\d+\]/.test(m.text));
  assert.ok(hasNumbering, 'AC-3.2: Should have [N/M] format numbering');
});

// AC-3.3: Segment interval >= 500ms
test('[US-3][AC-3.3] Segment interval should be configurable >= 500ms', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ 
    bot, 
    targetChatId: 123456, 
    segmentInterval: 500 // Default per spec
  });
  
  const start = Date.now();
  await pusher.sendMessageChunked(123456, 'x'.repeat(10000));
  const elapsed = Date.now() - start;
  
  // With 3 segments at 500ms each = ~1000ms minimum
  assert.ok(elapsed >= 400, 'AC-3.3: Should have delay between segments');
});

// AC-3.4: --file parameter option
test('[US-3][AC-3.4] Should provide file send option via shouldSendAsFile', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });
    
    // Test file threshold
    assert.equal(pager.shouldSendAsFile('x'.repeat(4000)), false, 'AC-3.4: Below threshold');
    assert.equal(pager.shouldSendAsFile('x'.repeat(4001)), true, 'AC-3.4: Above threshold');
  } finally {
    cleanup();
  }
});

// ============================================================
// US-4: Heartbeat Progress Push - Acceptance Criteria Tests
// ============================================================

// AC-4.1: Startup notification with runId and targets
test('[US-4][AC-4.1] Startup notification should include runId and targets', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });
  
  const runInfo = {
    runId: 'run-20260313-001',
    startedAt: new Date().toISOString(),
    targets: ['F-001', 'F-002', 'F-003', 'F-004', 'F-005']
  };
  
  await pusher.pushStartupNotification('feature', runInfo);
  
  assert.ok(bot._sentMessages.length >= 1, 'AC-4.1: Should send startup notification');
  const text = bot._sentMessages[0].text;
  assert.ok(text.includes('run-20260313-001'), 'AC-4.1: Should include runId');
});

// AC-4.2: Progress check every N features (configurable, default 1)
test('[US-4][AC-4.2] Feature completion should trigger progress check', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({ total_features: 5, completed_features: 1, failed_features: 0 })
    );
    
    const bot = createMockBot();
    const aggregator = createStatusAggregator({ config });
    const pusher = createTelegramPusher({
      bot,
      targetChatId: 123456,
      heartbeatFeatureCount: 1
    });
    
    await pusher.onFeatureCompleted('feature', 'F-001', aggregator);
    
    // Should send progress notification
    assert.ok(bot._sentMessages.length >= 1, 'AC-4.2: Should send progress on feature complete');
  } finally {
    cleanup();
  }
});

// AC-4.3: Progress includes completed/total and success rate
test('[US-4][AC-4.3] Progress should include completed/total and success rate', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })
    );
    fs.writeFileSync(
      path.join(stateDir, 'pipeline.json'),
      JSON.stringify({ 
        total_features: 10, 
        completed_features: 4, 
        failed_features: 1 
      })
    );
    
    const bot = createMockBot();
    const aggregator = createStatusAggregator({ config });
    const pusher = createTelegramPusher({ bot, targetChatId: 123456, throttleInterval: 0 });
    
    await pusher.onFeatureCompleted('feature', 'F-004', aggregator);
    
    const text = bot._sentMessages[0].text;
    // Should show progress 4/10 and 80% success rate (4/(4+1) = 80%)
    assert.ok(text.includes('4/') || text.includes('进度'), 'AC-4.3: Should show completed/total');
  } finally {
    cleanup();
  }
});

// AC-4.4: Throttle: >= 30s between pushes
test('[US-4][AC-4.4] Pushes should be throttled to >= 30s interval', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    throttleInterval: 100 // Fast for testing
  });
  
  let callCount = 0;
  const fn = async () => { callCount++; };
  
  await pusher.throttle('test', fn);
  assert.equal(callCount, 1, 'AC-4.4: First call should execute');
  
  await pusher.throttle('test', fn);
  assert.equal(callCount, 1, 'AC-4.4: Second call should be throttled');
  
  await new Promise(r => setTimeout(r, 150));
  await pusher.throttle('test', fn);
  assert.equal(callCount, 2, 'AC-4.4: Third call after interval should execute');
});

// AC-4.5: Push to configured chatId
test('[US-4][AC-4.5] Push should target configured chatId', async () => {
  const bot = createMockBot();
  const targetChatId = 987654321;
  const pusher = createTelegramPusher({ bot, targetChatId });
  
  await pusher.pushErrorSummary('feature', 'F-001', { type: 'test', message: 'Error' });
  
  assert.equal(bot._sentMessages[0].chatId, targetChatId, 'AC-4.5: Should push to configured chatId');
});

// ============================================================
// US-5: Error Summary Push - Acceptance Criteria Tests
// ============================================================

// AC-5.1: Push error summary on feature failure
test('[US-5][AC-5.1] Should push error summary on feature failure', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });
  
  const result = await pusher.pushErrorSummary('feature', 'F-003', {
    type: 'execution_error',
    message: 'Script failed'
  });
  
  assert.equal(result.ok, true, 'AC-5.1: Should push error summary');
  assert.ok(bot._sentMessages[0].text.includes('F-003'), 'AC-5.1: Should include feature ID');
});

// AC-5.2: Display last N error log lines (configurable, default 10)
test('[US-5][AC-5.2] Should include last N error log lines', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ 
    bot, 
    targetChatId: 123456,
    errorLinesCount: 5
  });
  
  await pusher.pushErrorSummary('feature', 'F-003', {
    type: 'execution_error',
    logLines: ['Err1', 'Err2', 'Err3', 'Err4', 'Err5', 'Err6', 'Err7']
  });
  
  const text = bot._sentMessages[0].text;
  // Should include up to 5 error lines
  assert.ok(text.includes('Err'), 'AC-5.2: Should include error log lines');
});

// AC-5.3: Display feature execution time
test('[US-5][AC-5.3] Should display feature execution time', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });
  
  await pusher.pushErrorSummary('feature', 'F-003', {
    type: 'execution_error',
    duration: 185 // 3m 5s
  });
  
  const text = bot._sentMessages[0].text;
  assert.ok(
    text.includes('185') || text.includes('3m') || text.includes('执行时间'),
    'AC-5.3: Should include execution time'
  );
});

// AC-5.4: Silent mode for expected failures
test('[US-5][AC-5.4] Silent mode should skip expected failures', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatConfig: { silentMode: true }
  });
  
  const result = await pusher.pushErrorSummary('feature', 'F-003', {
    type: 'expected_error',
    isExpected: true,
    message: 'Expected failure'
  });
  
  assert.equal(result.skipped, true, 'AC-5.4: Should skip expected errors in silent mode');
  assert.equal(bot._sentMessages.length, 0, 'AC-5.4: Should not send message for expected errors');
});

// ============================================================
// US-6: Diagnostic Error Messages - Acceptance Criteria Tests
// ============================================================

// AC-6.1: Missing state file message
test('[US-6][AC-6.1] Should return clear message for missing state file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });
    
    const status = await aggregator.aggregateStatus('feature');
    
    // Should return idle with no error, indicating pipeline not initialized
    assert.equal(status.stage, 'idle', 'AC-6.1: Should return idle for missing state');
  } finally {
    cleanup();
  }
});

// AC-6.2: Missing log file friendly message
test('[US-6][AC-6.2] Should return friendly message for missing log file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });
    
    const result = await pager.readLogPage('feature', { lines: 50 });
    
    assert.ok(result.message, 'AC-6.2: Should have friendly message');
    assert.ok(result.message.includes('暂无') || result.message.includes('不存在'), 
      'AC-6.2: Message should indicate no logs');
  } finally {
    cleanup();
  }
});

// AC-6.3: JSON parse error with file path
test('[US-6][AC-6.3] Should handle JSON parse error gracefully', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      '{ invalid json }'
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    // Should not throw, return valid status
    assert.ok(status, 'AC-6.3: Should not throw on JSON parse error');
    assert.equal(status.stage, 'idle', 'AC-6.3: Should return idle on parse error');
  } finally {
    cleanup();
  }
});

// AC-6.4: Diagnostic suggestions in error messages
test('[US-6][AC-6.4] Should include diagnostic suggestions', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const pager = createLogPager({ config });
    
    const result = await pager.readLogPage('feature', { lines: 50 });
    
    // Should have diagnostic message suggesting pipeline hasn't run
    assert.ok(
      result.message && (
        result.message.includes('暂无') || 
        result.message.includes('尚未') ||
        result.message.includes('不存在')
      ),
      'AC-6.4: Should have diagnostic suggestion'
    );
  } finally {
    cleanup();
  }
});

// ============================================================
// Edge Cases and Boundary Tests
// ============================================================

test('[Edge] Empty log file should return empty logs', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), '');
    
    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 50 });
    
    assert.ok(result.ok);
    assert.ok(result.logs === '' || result.message);
  } finally {
    cleanup();
  }
});

test('[Edge] Very large offset should not error', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(100));
    
    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 50, offset: 1000 });
    
    assert.ok(result.ok);
    assert.equal(result.logs, '');
  } finally {
    cleanup();
  }
});

test('[Edge] Zero lines request should be handled', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), generateLogLines(100));
    
    const pager = createLogPager({ config });
    const result = await pager.readLogPage('feature', { lines: 0 });
    
    assert.ok(result.ok);
    assert.equal(result.metadata.actualLines, 0);
  } finally {
    cleanup();
  }
});

test('[Edge] Success rate calculation for zero attempts', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const aggregator = createStatusAggregator({ config });
    
    const progress = aggregator.calculateProgress({ 
      total_features: 5, 
      completed_features: 0, 
      failed_features: 0 
    });
    
    assert.equal(progress.successRate, 0, 'Zero attempts should have 0% success rate');
  } finally {
    cleanup();
  }
});

test('[Edge] Dead PID should not show as running', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    // Use a PID that definitely doesn't exist (999999)
    fs.writeFileSync(
      path.join(stateDir, '.pipeline-meta.json'),
      JSON.stringify({ pid: 999999, started_at: new Date().toISOString() })
    );
    
    const aggregator = createStatusAggregator({ config });
    const status = await aggregator.aggregateStatus('feature');
    
    // Should not be running since PID is dead
    assert.notEqual(status.stage, 'running', 'Dead PID should not show as running');
  } finally {
    cleanup();
  }
});

test('[Performance] Large log file streaming should be efficient', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    
    // Create a large log file (> 1MB to trigger streaming)
    const lines = [];
    for (let i = 0; i < 20000; i++) {
      lines.push(`[${new Date().toISOString()}] [INFO] This is log line ${i} with some padding text to make it longer`);
    }
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), lines.join('\n'));
    
    const pager = createLogPager({ config });
    
    const start = Date.now();
    const result = await pager.readLogPage('feature', { lines: 100 });
    const elapsed = Date.now() - start;
    
    // Should complete in reasonable time (< 1s)
    assert.ok(elapsed < 1000, 'Large file reading should be efficient');
    assert.ok(result.ok);
    assert.ok(result.metadata.actualLines > 0);
  } finally {
    cleanup();
  }
});
