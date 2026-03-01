/**
 * Message Router Unit Tests
 * Tests for src/services/message-router.js
 *
 * F-018: Web-Telegram Bidirectional Sync
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sessionStore } from '../../src/services/session-store.js';
import { createMessageRouter } from '../../src/services/message-router.js';

// Mock dependencies
const mockSessionStore = {
  append: test.mock.fn(),
  get: test.mock.fn(() => []),
  clear: test.mock.fn(),
  toPrompt: test.mock.fn(() => 'Mock prompt: you are an AI assistant. 用户: hello world\n助手: previous context\n')
};

const mockExecuteAiCli = test.mock.fn(async (options) => {
  return {
    output: `AI response to: ${options.prompt}`,
    timedOut: false,
    interrupted: false,
    elapsedMs: 100,
    exitCode: 0,
    stderr: ''
  };
});

const mockRealtimeHub = {
  publish: test.mock.fn(),
  subscribe: test.mock.fn(() => () => {})
};

/**
 * Helper to create a message router with mocks
 */
function createRouter(options = {}) {
  return createMessageRouter({
    aiCliExecutor: options.aiCliExecutor || mockExecuteAiCli,
    sessionStore: options.sessionStore || mockSessionStore,
    realtimeHub: options.realtimeHub || mockRealtimeHub
  });
}

test('message-router: processMessage uses unified sessionKey when telegramChatId bound', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    telegramChatId: '456',
    message: 'test message',
    userId: 'user-123'
  });

  // Should use telegram:{chatId} as session key
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[0], 'telegram:456');
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[1], 'user');
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[2], 'test message');

  // Should call executeAiCli with telegram session key
  assert.strictEqual(mockExecuteAiCli.mock.calls[0].arguments[0].sessionId, 'telegram:456');
});

test('message-router: processMessage uses web sessionKey when no telegramChatId', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test message',
    userId: 'user-123'
  });

  // Should use web:{sessionId} as session key for isolated session
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[0], 'web:web-session-123');
});

test('message-router: processMessage calls executeAiCli with message', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'hello world',
    userId: 'user-123'
  });

  assert.strictEqual(mockExecuteAiCli.mock.calls.length, 1);
  const callArgs = mockExecuteAiCli.mock.calls[0].arguments[0];
  assert.ok(callArgs.prompt.includes('hello world'));
});

test('message-router: processMessage appends user message to sessionStore', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'telegram',
    sessionId: '456',
    message: 'user question',
    userId: 'user-123'
  });

  assert.strictEqual(mockSessionStore.append.mock.calls.length, 2); // user + assistant
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[0], 'telegram:456');
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[1], 'user');
  assert.strictEqual(mockSessionStore.append.mock.calls[0].arguments[2], 'user question');
});

test('message-router: processMessage appends assistant reply to sessionStore', async () => {
  const router = createRouter();

  const result = await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test',
    userId: 'user-123'
  });

  assert.strictEqual(mockSessionStore.append.mock.calls.length, 2);
  const assistantCall = mockSessionStore.append.mock.calls[1].arguments;
  assert.strictEqual(assistantCall[0], 'web:web-session-123');
  assert.strictEqual(assistantCall[1], 'assistant');
  assert.ok(assistantCall[2].includes('AI response'));
});

test('message-router: processMessage publishes status events', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test',
    userId: 'user-123'
  });

  assert.ok(mockRealtimeHub.publish.mock.calls.length > 0);

  // Find 'accepted' status event
  const acceptedEvent = mockRealtimeHub.publish.mock.calls.find(
    (call) => call.arguments[1]?.type === 'status' &&
              call.arguments[1]?.payload?.stage === 'accepted'
  );
  assert.ok(acceptedEvent, 'Should publish accepted status event');
});

test('message-router: processMessage publishes assistant events', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test',
    userId: 'user-123'
  });

  // Find 'assistant_done' event
  const doneEvent = mockRealtimeHub.publish.mock.calls.find(
    (call) => call.arguments[1]?.type === 'assistant_done'
  );
  assert.ok(doneEvent, 'Should publish assistant_done event');

  assert.ok(doneEvent.arguments[1].payload.reply.includes('AI response'));
  assert.strictEqual(doneEvent.arguments[1].payload.channel, 'web');
});

test('message-router: processMessage passes userId to executeAiCli', async () => {
  const router = createRouter();

  await router.processMessage({
    channel: 'telgram',
    sessionId: '456',
    message: 'test',
    userId: 'test-user-789'
  });

  const callArgs = mockExecuteAiCli.mock.calls[0].arguments[0];
  assert.strictEqual(callArgs.userId, 'test-user-789');
});

test('message-router: processMessage calls onChunk hook', async () => {
  let chunkReceived = false;
  const customMockExecute = test.mock.fn(async (options) => {
    if (options.hooks?.onChunk) {
      options.hooks.onChunk('partial output');
    }
    return {
      output: 'complete output',
      timedOut: false,
      interrupted: false,
      elapsedMs: 10,
      exitCode: 0,
      stderr: ''
    };
  });

  const router = createRouter({ aiCliExecutor: customMockExecute });

  await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test',
    userId: 'user-123',
    hooks: {
      onAssistantChunk: (data) => {
        chunkReceived = true;
        assert.strictEqual(data.text, 'partial output');
      }
    }
  });

  assert.strictEqual(chunkReceived, true);
});

test('message-router: processMessage validates required fields', async () => {
  const router = createRouter();

  await assert.rejects(
    router.processMessage({
      channel: 'web',
      // missing sessionId
      message: 'test',
      userId: 'user-123'
    }),
    { message: /sessionId 不能为空/ }
  );

  await assert.rejects(
    router.processMessage({
      channel: 'web',
      sessionId: 'web-session-123',
      // missing message
      userId: 'user-123'
    }),
    { message: /message 不能为空/ }
  );
});

test('message-router: processMessage returns the AI response', async () => {
  const router = createRouter();

  const result = await router.processMessage({
    channel: 'web',
    sessionId: 'web-session-123',
    message: 'test',
    userId: 'user-123'
  });

  assert.ok(result.reply);
  assert.ok(result.reply.includes('AI response'));
});

test.beforeEach(() => {
  mockSessionStore.append.mock.resetCalls();
  mockExecuteAiCli.mock.resetCalls();
  mockRealtimeHub.publish.mock.resetCalls();
});
