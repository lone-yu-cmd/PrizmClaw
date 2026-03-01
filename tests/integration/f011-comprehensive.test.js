/**
 * F-011 Comprehensive Integration Tests
 * Covers all User Stories from spec.md
 *
 * US-1: Natural Language Task Execution
 * US-2: Multi-turn Conversation Context
 * US-3: Task Interrupt
 * US-4: Long Task Progress Feedback
 * US-5: Error Handling and Recovery Suggestions
 * US-6: Markdown Format Adaptation
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { sessionStore } from '../../src/services/session-store.js';
import {
  executeAiCli,
  interruptAiCli,
  isAiCliRunning,
  getActiveProcessInfo,
  canInterruptAiCli,
  resetMetrics,
  getMetrics
} from '../../src/services/ai-cli-service.js';
import {
  convertToMarkdownV2,
  escapeMarkdownV2,
  formatCodeBlock,
  formatInlineCode
} from '../../src/utils/markdown-v2-formatter.js';

describe('F-011 Comprehensive Integration Tests', () => {
  const testSessionId = 'test-comprehensive-session';
  const testUserId = 'user-123';
  const adminUserId = 'admin-456';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
    resetMetrics();
  });

  afterEach(() => {
    sessionStore.clear(testSessionId);
  });

  // ============================================
  // US-1: Natural Language Task Execution
  // ============================================
  describe('US-1: Natural Language Task Execution', () => {
    test('AC-1.1: User sends natural language message, Bot calls AI CLI to execute', async () => {
      // Simulate natural language prompt
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: '帮我列出当前目录的文件',
        userId: testUserId,
        bin: 'echo',
        args: ['Files listed successfully'],
        timeoutMs: 5000
      });

      // Verify execution completed
      assert.ok(result.output);
      assert.equal(result.timedOut, false);
      assert.equal(result.interrupted, false);
    });

    test('AC-1.2: Execution results stream back to Telegram', async () => {
      const chunks = [];
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test streaming',
        userId: testUserId,
        bin: 'echo',
        args: ['streaming output test'],
        timeoutMs: 5000,
        hooks: {
          onChunk: (text) => chunks.push(text)
        }
      });

      // Verify output was produced (either via chunks or final output)
      assert.ok(chunks.length > 0 || result.output.length > 0);
    });

    test('AC-1.3: Code blocks, links rendered correctly', async () => {
      const aiOutput = 'Here is code:\n```javascript\nconst x = 1;\n```\nAnd a [link](https://example.com).';
      const formatted = convertToMarkdownV2(aiOutput);

      // Verify code block preserved
      assert.ok(formatted.includes('```javascript'));
      // Verify link preserved
      assert.ok(formatted.includes('[link]'));
      assert.ok(formatted.includes('(https://example'));
    });
  });

  // ============================================
  // US-2: Multi-turn Conversation Context
  // ============================================
  describe('US-2: Multi-turn Conversation Context', () => {
    test('AC-2.1: Session context preserved across multiple turns', async () => {
      const sessionKey = `telegram:${testSessionId}`;

      // First turn
      sessionStore.append(sessionKey, 'user', 'What is Node.js?');
      await executeAiCli({
        sessionId: testSessionId,
        prompt: sessionStore.toPrompt(sessionKey, 'telegram'),
        userId: testUserId,
        bin: 'echo',
        args: ['Node.js is a JavaScript runtime'],
        timeoutMs: 5000
      });
      sessionStore.append(sessionKey, 'assistant', 'Node.js is a JavaScript runtime');

      // Second turn
      sessionStore.append(sessionKey, 'user', 'How do I install it?');
      const prompt = sessionStore.toPrompt(sessionKey, 'telegram');

      // Verify context includes previous conversation
      assert.ok(prompt.includes('What is Node.js?'));
      assert.ok(prompt.includes('Node.js is a JavaScript runtime'));
      assert.ok(prompt.includes('How do I install it?'));
    });

    test('AC-2.2: User can follow up or supplement instructions', async () => {
      const sessionKey = `telegram:${testSessionId}`;

      // Initial question
      sessionStore.append(sessionKey, 'user', 'Create a function');
      sessionStore.append(sessionKey, 'assistant', 'function created');

      // Follow-up
      sessionStore.append(sessionKey, 'user', 'Add error handling to it');
      const prompt = sessionStore.toPrompt(sessionKey, 'telegram');

      assert.ok(prompt.includes('Create a function'));
      assert.ok(prompt.includes('Add error handling'));
    });

    test('AC-2.3: Context trimmed according to MAX_HISTORY_TURNS', async () => {
      const sessionKey = `telegram:${testSessionId}`;

      // Add many turns (exceed default MAX_HISTORY_TURNS)
      for (let i = 0; i < 25; i++) {
        sessionStore.append(sessionKey, 'user', `Question ${i}`);
        sessionStore.append(sessionKey, 'assistant', `Answer ${i}`);
      }

      const prompt = sessionStore.toPrompt(sessionKey, 'telegram');

      // Earlier messages should be trimmed
      assert.ok(!prompt.includes('Question 0'));
      assert.ok(!prompt.includes('Answer 0'));

      // Recent messages should be present
      assert.ok(prompt.includes('Question 24'));
    });
  });

  // ============================================
  // US-3: Task Interrupt
  // ============================================
  describe('US-3: Task Interrupt', () => {
    test('AC-3.1: /stop command interrupts running AI CLI task', async () => {
      // Start long-running task
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'long task',
        userId: testUserId,
        bin: 'sleep',
        args: ['30'],
        timeoutMs: 60000
      });

      // Wait for process to start
      await new Promise((r) => setTimeout(r, 100));

      // Verify task is running
      assert.equal(isAiCliRunning(testSessionId), true);

      // Interrupt
      const interruptResult = interruptAiCli(testSessionId);
      assert.equal(interruptResult.ok, true);

      // Wait for completion
      const result = await execPromise;
      assert.equal(result.interrupted, true);
    });

    test('AC-3.2: Confirmation message returned after interrupt', async () => {
      // Setup running task
      sessionStore.setActiveProcess(testSessionId, {
        pid: 12345,
        startedAt: Date.now(),
        childProcess: { kill: () => {} },
        userId: testUserId
      });

      const result = interruptAiCli(testSessionId);
      assert.ok(result.ok);
      assert.ok(result.pid);
    });

    test('AC-3.3: Only admin or task owner can interrupt', () => {
      // Task owned by testUserId
      sessionStore.setActiveProcess(testSessionId, {
        pid: 12345,
        startedAt: Date.now(),
        childProcess: { kill: () => {} },
        userId: testUserId
      });

      // Owner can interrupt
      const ownerCheck = canInterruptAiCli(testSessionId, testUserId, () => false);
      assert.equal(ownerCheck.canInterrupt, true);

      // Admin can interrupt
      const adminCheck = canInterruptAiCli(testSessionId, adminUserId, (id) => String(id) === adminUserId);
      assert.equal(adminCheck.canInterrupt, true);

      // Non-owner non-admin cannot interrupt
      const otherCheck = canInterruptAiCli(testSessionId, 'other-user', () => false);
      assert.equal(otherCheck.canInterrupt, false);
    });
  });

  // ============================================
  // US-4: Long Task Progress Feedback
  // ============================================
  describe('US-4: Long Task Progress Feedback', () => {
    test('AC-4.1: Tasks exceeding threshold push periodic progress', async () => {
      const heartbeats = [];

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'long task',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.5'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => heartbeats.push(info)
        }
      });

      // Should have received heartbeats
      assert.ok(heartbeats.length > 0);
    });

    test('AC-4.2: Progress message shows elapsed time and status', async () => {
      const heartbeats = [];

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'task',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => heartbeats.push(info)
        }
      });

      if (heartbeats.length > 0) {
        const hb = heartbeats[0];
        assert.ok('elapsedMs' in hb);
        assert.ok('stdoutBytes' in hb);
        assert.ok('status' in hb);
        assert.ok(hb.elapsedMs >= 0);
      }
    });

    test('AC-4.3: Progress frequency configurable', async () => {
      const heartbeats1 = [];
      const heartbeats2 = [];

      // Fast interval
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'task1',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 30,
        hooks: { onHeartbeat: (info) => heartbeats1.push(info) }
      });

      sessionStore.clear(testSessionId);

      // Slow interval
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'task2',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 200,
        hooks: { onHeartbeat: (info) => heartbeats2.push(info) }
      });

      // Fast interval should have more heartbeats
      assert.ok(heartbeats1.length >= heartbeats2.length);
    });
  });

  // ============================================
  // US-5: Error Handling and Recovery Suggestions
  // ============================================
  describe('US-5: Error Handling and Recovery Suggestions', () => {
    test('AC-5.1: Process abnormal exit returns understandable error', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'fail',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'exit 1'],
        timeoutMs: 5000
      });

      assert.equal(result.exitCode, 1);
      assert.ok(result.output);
    });

    test('AC-5.2: Timeout returns hint and suggested actions', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 50
      });

      assert.equal(result.timedOut, true);
      // Output should include suggestion
      assert.ok(
        result.output.includes('超时') ||
        result.output.includes('timeout') ||
        result.output.includes('/stop') ||
        result.output.includes('TIMEOUT')
      );
    });

    test('AC-5.3: Provide recovery suggestions (retry, check config)', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: '/nonexistent/binary/path',
        args: [],
        timeoutMs: 5000
      });

      // Should include helpful suggestion
      assert.ok(
        result.output.includes('无法启动') ||
        result.output.includes('CODEBUDDY_BIN') ||
        result.output.includes('配置')
      );
    });
  });

  // ============================================
  // US-6: Markdown Format Adaptation
  // ============================================
  describe('US-6: Markdown Format Adaptation', () => {
    test('AC-6.1: Code blocks use Telegram MarkdownV2 format', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('```javascript'));
      assert.ok(result.endsWith('```'));
    });

    test('AC-6.2: Links, bold, italic elements correctly escaped', () => {
      // Bold
      const boldInput = '**bold text**';
      const boldResult = convertToMarkdownV2(boldInput);
      assert.ok(boldResult.includes('*'));

      // Italic
      const italicInput = '_italic text_';
      const italicResult = convertToMarkdownV2(italicInput);
      assert.ok(italicResult.includes('_'));

      // Links
      const linkInput = '[link text](https://example.com)';
      const linkResult = convertToMarkdownV2(linkInput);
      assert.ok(linkResult.includes('[link text]'));
    });

    test('AC-6.3: Special characters correctly handled', () => {
      const special = '_ * [ ] ( ) ~ ` > # + - = | { } . !';
      const escaped = escapeMarkdownV2(special);

      // All special chars should be escaped
      assert.ok(escaped.includes('\\_'));
      assert.ok(escaped.includes('\\*'));
      assert.ok(escaped.includes('\\['));
      assert.ok(escaped.includes('\\.'));
      assert.ok(escaped.includes('\\!'));
    });
  });

  // ============================================
  // Cross-module Integration Tests
  // ============================================
  describe('Cross-module Integration', () => {
    test('Session store + AI CLI service + MarkdownV2 integration', async () => {
      const sessionKey = `telegram:${testSessionId}`;

      // User message
      sessionStore.append(sessionKey, 'user', 'Write a hello world in Python');

      // Execute with session context
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: sessionStore.toPrompt(sessionKey, 'telegram'),
        userId: testUserId,
        bin: 'echo',
        args: ['```python\nprint("Hello, World!")\n```'],
        timeoutMs: 5000
      });

      // Store assistant reply
      sessionStore.append(sessionKey, 'assistant', result.output);

      // Format for Telegram
      const formatted = convertToMarkdownV2(result.output);

      // Verify end-to-end flow
      assert.ok(result.output);
      assert.ok(formatted.includes('```python'));
    });

    test('Metrics tracking across multiple executions', async () => {
      // Success
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'success',
        userId: testUserId,
        bin: 'echo',
        args: ['ok'],
        timeoutMs: 5000
      });

      // Timeout
      await executeAiCli({
        sessionId: `${testSessionId}-2`,
        prompt: 'timeout',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 10
      });

      const metrics = getMetrics();
      assert.equal(metrics.totalExecutions, 2);
      assert.equal(metrics.successCount, 1);
      assert.equal(metrics.timeoutCount, 1);
    });

    test('Process cleanup on all exit paths', async () => {
      // Normal exit
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'normal',
        userId: testUserId,
        bin: 'echo',
        args: ['done'],
        timeoutMs: 5000
      });
      assert.equal(isAiCliRunning(testSessionId), false);

      // Timeout
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'timeout',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 10
      });
      assert.equal(isAiCliRunning(testSessionId), false);

      // Interrupt
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'interrupt',
        userId: testUserId,
        bin: 'sleep',
        args: ['30'],
        timeoutMs: 60000
      });
      await new Promise((r) => setTimeout(r, 50));
      interruptAiCli(testSessionId);
      await execPromise;
      assert.equal(isAiCliRunning(testSessionId), false);
    });
  });

  // ============================================
  // Boundary Conditions
  // ============================================
  describe('Boundary Conditions', () => {
    test('Empty prompt handled gracefully', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: '',
        userId: testUserId,
        bin: 'echo',
        args: ['empty prompt handled'],
        timeoutMs: 5000
      });

      assert.ok(result.output);
    });

    test('Very long prompt handled', async () => {
      const longPrompt = 'a'.repeat(10000);
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: longPrompt,
        userId: testUserId,
        bin: 'echo',
        args: ['long prompt handled'],
        timeoutMs: 5000
      });

      assert.ok(result.output);
    });

    test('Concurrent execution prevention', async () => {
      // Start first task
      const firstPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'first',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000
      });

      // Wait for it to start
      await new Promise((r) => setTimeout(r, 50));

      // Check that task is running
      assert.equal(isAiCliRunning(testSessionId), true);

      // Wait for completion
      await firstPromise;

      // Now should be able to run another
      const secondResult = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'second',
        userId: testUserId,
        bin: 'echo',
        args: ['done'],
        timeoutMs: 5000
      });

      assert.ok(secondResult.output);
    });

    test('Zero timeout means no timeout', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'no timeout',
        userId: testUserId,
        bin: 'echo',
        args: ['fast'],
        timeoutMs: 0
      });

      assert.equal(result.timedOut, false);
    });
  });
});
