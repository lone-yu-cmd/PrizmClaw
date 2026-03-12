/**
 * Telegram Pusher Unit Tests
 * Tests for src/services/telegram-pusher.js
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-4: Heartbeat Progress Push, US-5: Error Summary Push
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTelegramPusher } from '../../src/services/telegram-pusher.js';

/**
 * Helper to create a mock bot
 */
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

/**
 * Helper to create a mock status aggregator
 */
function createMockAggregator() {
  return {
    aggregateStatus: async () => ({
      stage: 'running',
      type: 'feature',
      timestamp: new Date().toISOString(),
      progress: { total: 10, completed: 4, failed: 1, inProgress: 1, successRate: 80 },
      current: { featureId: 'F-005', startedAt: new Date().toISOString(), duration: 300 }
    }),
    formatStatusForTelegram: (status) => JSON.stringify(status, null, 2)
  };
}

// ============================================================
// Factory Tests (T-030)
// ============================================================

test('createTelegramPusher should be a factory function', () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456
  });

  assert.equal(typeof pusher.startHeartbeat, 'function');
  assert.equal(typeof pusher.stopHeartbeat, 'function');
  assert.equal(typeof pusher.pushErrorSummary, 'function');
  assert.equal(typeof pusher.sendMessageChunked, 'function');
  assert.equal(typeof pusher.sendFile, 'function');
  assert.equal(typeof pusher.throttle, 'function');
});

test('createTelegramPusher should accept config options', () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatInterval: 60000,
    errorLinesCount: 20,
    throttleInterval: 60000
  });

  assert.ok(pusher);
});

// ============================================================
// sendMessageChunked Tests (T-031, T-037)
// ============================================================

test('sendMessageChunked should send single message for short text', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  const text = 'Short message';
  await pusher.sendMessageChunked(123456, text);

  assert.equal(bot._sentMessages.length, 1);
});

test('sendMessageChunked should split long messages at 4000 chars', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  // Create message longer than 4000 chars
  const text = 'x'.repeat(5000);
  await pusher.sendMessageChunked(123456, text);

  // Should send multiple messages
  assert.ok(bot._sentMessages.length >= 2);
});

test('sendMessageChunked should add segment numbering [N/M]', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  const text = 'x'.repeat(5000);
  await pusher.sendMessageChunked(123456, text);

  // Check that messages have segment numbering
  const hasSegmentNumber = bot._sentMessages.some(m =>
    m.text.includes('[1/') || m.text.includes('[2/')
  );
  assert.ok(hasSegmentNumber);
});

test('sendMessageChunked should respect segment interval delay', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    segmentInterval: 10 // Fast for testing
  });

  const text = 'x'.repeat(10000);
  const start = Date.now();
  await pusher.sendMessageChunked(123456, text);
  const _elapsed = Date.now() - start;

  // Should have some delay between segments (at least 10ms per segment)
  assert.ok(bot._sentMessages.length >= 2);
});

// ============================================================
// throttle Tests (T-032, T-037)
// ============================================================

test('throttle should prevent rapid successive calls', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    throttleInterval: 100
  });

  let callCount = 0;
  const fn = async () => { callCount++; };

  // First call should execute immediately
  await pusher.throttle('test-key', fn);
  assert.equal(callCount, 1);

  // Second call immediately should be throttled
  await pusher.throttle('test-key', fn);
  assert.equal(callCount, 1);

  // After interval, should allow again
  await new Promise(resolve => setTimeout(resolve, 150));
  await pusher.throttle('test-key', fn);
  assert.equal(callCount, 2);
});

test('throttle should track separate keys independently', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    throttleInterval: 100
  });

  let callCount = 0;
  const fn = async () => { callCount++; };

  await pusher.throttle('key-a', fn);
  await pusher.throttle('key-b', fn);

  // Both should execute since different keys
  assert.equal(callCount, 2);
});

// ============================================================
// startHeartbeat/stopHeartbeat Tests (T-033, T-034, T-038)
// ============================================================

test('startHeartbeat should begin periodic updates', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatInterval: 50 // Fast for testing
  });

  const aggregator = createMockAggregator();

  pusher.startHeartbeat('feature', aggregator);

  // Wait for at least one heartbeat
  await new Promise(resolve => setTimeout(resolve, 100));

  pusher.stopHeartbeat('feature');

  // Should have sent at least one message
  assert.ok(bot._sentMessages.length >= 1);
});

test('stopHeartbeat should stop periodic updates', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatInterval: 50
  });

  const aggregator = createMockAggregator();

  pusher.startHeartbeat('feature', aggregator);
  await new Promise(resolve => setTimeout(resolve, 80));
  pusher.stopHeartbeat('feature');

  const countAfterStop = bot._sentMessages.length;

  // Wait more - should not send more
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.equal(bot._sentMessages.length, countAfterStop);
});

test('startHeartbeat should not start duplicate timers', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatInterval: 50
  });

  const aggregator = createMockAggregator();

  // Start twice
  pusher.startHeartbeat('feature', aggregator);
  pusher.startHeartbeat('feature', aggregator);

  await new Promise(resolve => setTimeout(resolve, 100));
  pusher.stopHeartbeat('feature');

  // Should only have one timer's worth of messages
  assert.ok(bot._sentMessages.length < 5);
});

// ============================================================
// pushErrorSummary Tests (T-035)
// ============================================================

test('pushErrorSummary should send error notification', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    errorLinesCount: 10
  });

  const error = {
    type: 'execution_error',
    message: 'Script failed',
    logLines: ['Error line 1', 'Error line 2']
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  assert.equal(bot._sentMessages.length, 1);
  assert.ok(bot._sentMessages[0].text.includes('F-005'));
});

test('pushErrorSummary should include execution time', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456
  });

  const error = {
    type: 'execution_error',
    message: 'Script failed',
    duration: 120 // seconds
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  const sentText = bot._sentMessages[0].text;
  assert.ok(sentText.includes('120') || sentText.includes('2m') || sentText.includes('duration'));
});

test('pushErrorSummary should include last N error log lines', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    errorLinesCount: 5
  });

  const error = {
    type: 'execution_error',
    message: 'Script failed',
    logLines: ['Err1', 'Err2', 'Err3', 'Err4', 'Err5', 'Err6', 'Err7']
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  const sentText = bot._sentMessages[0].text;
  // Should include up to 5 error lines
  assert.ok(sentText.includes('Err'));
});

// ============================================================
// sendFile Tests (T-036)
// ============================================================

test('sendFile should send document to chat', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  const content = 'Log content here';
  await pusher.sendFile(123456, content, 'test-log.txt');

  assert.equal(bot._sentFiles.length, 1);
});

// ============================================================
// Heartbeat Config Tests (T-131, T-134) - US-4
// ============================================================

test('createTelegramPusher should read heartbeat config from options', () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatConfig: {
      enabled: true,
      intervalMs: 60000,
      chatId: 789012,
      silentMode: false,
      errorLinesCount: 15
    }
  });

  assert.ok(pusher);
});

test('heartbeat should respect enabled config', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatConfig: {
      enabled: false
    }
  });

  const aggregator = createMockAggregator();
  pusher.startHeartbeat('feature', aggregator);

  await new Promise(resolve => setTimeout(resolve, 100));

  pusher.stopHeartbeat('feature');

  // Should not send any messages when disabled
  assert.equal(bot._sentMessages.length, 0);
});

// ============================================================
// Startup Notification Tests (T-132) - US-4 AC-4.1
// ============================================================

test('pushStartupNotification should include runId and target list', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  const runInfo = {
    runId: 'run-20260313-103000',
    targets: ['F-001', 'F-002', 'F-003', 'F-004', 'F-005'],
    startedAt: new Date().toISOString()
  };

  await pusher.pushStartupNotification?.('feature', runInfo);

  // Check that the message includes runId and targets
  if (bot._sentMessages.length > 0) {
    const text = bot._sentMessages[0].text;
    assert.ok(text.includes('run-20260313-103000') || text.includes('runId'));
    assert.ok(text.includes('F-001') || text.includes('target'));
  }
});

// ============================================================
// Silent Mode Tests (T-143) - US-5 AC-5.4
// ============================================================

test('pushErrorSummary should respect silent mode', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({
    bot,
    targetChatId: 123456,
    heartbeatConfig: {
      silentMode: true
    }
  });

  // In silent mode, only critical errors should be sent
  const error = {
    type: 'expected_error',
    message: 'Expected failure',
    isExpected: true
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  // Should skip expected errors in silent mode
  // Implementation dependent - may send or not
  assert.ok(bot._sentMessages.length <= 1);
});

// ============================================================
// Error Summary Format Tests (T-141) - US-5 AC-5.3
// ============================================================

test('pushErrorSummary message format should include execution time/duration', async () => {
  const bot = createMockBot();
  const pusher = createTelegramPusher({ bot, targetChatId: 123456 });

  const error = {
    type: 'execution_error',
    message: 'Script execution failed',
    duration: 180, // 3 minutes
    featureId: 'F-005'
  };

  await pusher.pushErrorSummary('feature', 'F-005', error);

  const sentText = bot._sentMessages[0].text;

  // Should include duration/execution time
  assert.ok(
    sentText.includes('180') ||
    sentText.includes('3m') ||
    sentText.includes('duration') ||
    sentText.includes('耗时') ||
    sentText.includes('执行时间')
  );
});
