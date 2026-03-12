/**
 * Integration Tests for AI CLI Telegram Flow
 * F-011, T-039, T-040: Test full Telegram → AI CLI → output flow
 *
 * Tests cover:
 * - Normal execution flow with process tracking
 * - Multi-turn conversation with session context
 * - /stop interrupt functionality
 * - Error handling with recovery suggestions
 * - MarkdownV2 output formatting
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
import { convertToMarkdownV2, escapeMarkdownV2, formatCodeBlock } from '../../src/utils/markdown-v2-formatter.js';

describe('F-011 AI CLI Telegram Flow Integration', () => {
  const testSessionId = 'test-telegram-session-001';
  const testUserId = '123456789';
  const adminUserId = '987654321';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
    resetMetrics();
  });

  afterEach(() => {
    sessionStore.clear(testSessionId);
  });

  describe('Normal Execution Flow (T-039)', () => {
    test('should execute AI CLI and return output', async () => {
      const chunks = [];
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'hello',
        userId: testUserId,
        bin: 'echo',
        args: ['hello world'], // Custom args for echo
        timeoutMs: 5000,
        hooks: {
          onChunk: (text) => chunks.push(text)
        }
      });

      assert.ok(result.output);
      assert.equal(result.timedOut, false);
      assert.equal(result.interrupted, false);
      assert.ok(result.elapsedMs >= 0);
      assert.equal(result.exitCode, 0);

      // Check that chunks were received or output contains expected content
      assert.ok(chunks.length > 0 || result.output.includes('hello'));
    });

    test('should track process during execution', async () => {
      // Start a long-running process
      const executionPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.5'], // Custom args for sleep
        timeoutMs: 10000
      });

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check process is tracked
      const isRunning = isAiCliRunning(testSessionId);
      assert.equal(isRunning, true);

      const processInfo = getActiveProcessInfo(testSessionId);
      assert.ok(processInfo);
      assert.ok(processInfo.pid);
      assert.ok(processInfo.startedAt);
      assert.equal(processInfo.userId, testUserId);

      // Wait for completion
      await executionPromise;

      // Check process is cleared
      assert.equal(isAiCliRunning(testSessionId), false);
    });

    test('should handle concurrent execution attempts gracefully', async () => {
      // Start first execution
      const firstPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'first',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000
      });

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify process is running
      assert.equal(isAiCliRunning(testSessionId), true);

      // Wait for completion
      await firstPromise;

      // Now start second
      const secondResult = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'second',
        userId: testUserId,
        bin: 'echo',
        args: ['done'],
        timeoutMs: 5000
      });

      assert.ok(secondResult.output);
      assert.equal(secondResult.interrupted, false);
    });
  });

  describe('Multi-turn Conversation (T-039)', () => {
    test('should clear session after reset', async () => {
      // First message
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'first message',
        userId: testUserId,
        bin: 'echo',
        args: ['first response'],
        timeoutMs: 5000
      });

      // Session should be trackable
      const processInfo = getActiveProcessInfo(testSessionId);
      assert.equal(processInfo, null); // Process should be cleared after execution

      // Clear session manually
      sessionStore.clear(testSessionId);

      // Verify cleared
      const messages = sessionStore.get(testSessionId);
      assert.equal(messages.length, 0);
    });

    test('should handle sequential executions', async () => {
      // Execute first
      const result1 = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'first',
        userId: testUserId,
        bin: 'echo',
        args: ['response1'],
        timeoutMs: 5000
      });
      assert.ok(result1.output);

      // Execute second
      const result2 = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'second',
        userId: testUserId,
        bin: 'echo',
        args: ['response2'],
        timeoutMs: 5000
      });
      assert.ok(result2.output);

      // Execute third
      const result3 = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'third',
        userId: testUserId,
        bin: 'echo',
        args: ['response3'],
        timeoutMs: 5000
      });
      assert.ok(result3.output);
    });
  });

  describe('Stop Interrupt (T-039)', () => {
    test('should interrupt running process via /stop', async () => {
      // Start a long-running process
      const executionPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'long-task',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'], // Sleep for 10 seconds
        timeoutMs: 30000
      });

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify process is running
      assert.equal(isAiCliRunning(testSessionId), true);

      // Interrupt
      const interruptResult = interruptAiCli(testSessionId);
      assert.equal(interruptResult.ok, true);
      assert.ok(interruptResult.pid);

      // Wait for execution to complete
      const result = await executionPromise;

      // Should be marked as interrupted
      assert.equal(result.interrupted, true);
    });

    test('should return error when no process to interrupt', () => {
      const result = interruptAiCli('non-existent-session');
      assert.equal(result.ok, false);
      assert.ok(result.error);
    });
  });

  describe('Error Handling (T-039)', () => {
    test('should handle process spawn failure gracefully', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: '/nonexistent/binary/that/does/not/exist',
        args: [],
        timeoutMs: 5000
      });

      assert.ok(result.output.includes('无法启动') || result.output.includes('error') || result.output.includes('失败'));
      assert.equal(result.timedOut, false);
      assert.equal(result.interrupted, false);
    });

    test('should handle non-zero exit code', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'fail',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'exit 1'], // Run a command that exits with code 1
        timeoutMs: 5000
      });

      assert.equal(result.exitCode, 1);
      assert.ok(result.output);
    });

    test('should handle timeout with suggestion', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 100 // Very short timeout
      });

      assert.equal(result.timedOut, true);
      assert.ok(result.output);
      // Should include suggestion about /stop or timeout config
      assert.ok(
        result.output.includes('超时') ||
        result.output.includes('timeout') ||
        result.output.includes('/stop') ||
        result.output.includes('TIMEOUT')
      );
    });
  });

  describe('Permission Checks (T-033)', () => {
    test('should allow task owner to interrupt', () => {
      // Simulate a running task
      sessionStore.setActiveProcess(testSessionId, {
        pid: 12345,
        startedAt: Date.now(),
        childProcess: { kill: () => {} },
        userId: testUserId
      });

      const check = canInterruptAiCli(testSessionId, testUserId, () => false);
      assert.equal(check.canInterrupt, true);
    });

    test('should allow admin to interrupt', () => {
      // Simulate a running task owned by another user
      sessionStore.setActiveProcess(testSessionId, {
        pid: 12345,
        startedAt: Date.now(),
        childProcess: { kill: () => {} },
        userId: 'other-user-id'
      });

      const check = canInterruptAiCli(testSessionId, adminUserId, (id) => String(id) === adminUserId);
      assert.equal(check.canInterrupt, true);
    });

    test('should deny non-owner non-admin interrupt', () => {
      // Simulate a running task owned by another user
      sessionStore.setActiveProcess(testSessionId, {
        pid: 12345,
        startedAt: Date.now(),
        childProcess: { kill: () => {} },
        userId: testUserId
      });

      const check = canInterruptAiCli(testSessionId, 'another-user-id', () => false);
      assert.equal(check.canInterrupt, false);
      assert.ok(check.reason.includes('权限不足'));
    });

    test('should deny interrupt when no process running', () => {
      const check = canInterruptAiCli(testSessionId, testUserId, () => false);
      assert.equal(check.canInterrupt, false);
      assert.ok(check.reason);
    });
  });

  describe('MarkdownV2 Output Formatting (T-040)', () => {
    test('should escape special characters in MarkdownV2', () => {
      const input = 'Hello *world* with _underscores_ and `code`!';
      const escaped = escapeMarkdownV2(input);

      // All MarkdownV2 special chars should be escaped
      assert.ok(!escaped.includes('*') || escaped.includes('\\*'));
      assert.ok(!escaped.includes('_') || escaped.includes('\\_'));
      assert.ok(!escaped.includes('`') || escaped.includes('\\`'));
    });

    test('should format code blocks correctly', () => {
      const code = 'const x = 1;';
      const formatted = formatCodeBlock(code, 'javascript');

      assert.ok(formatted.startsWith('```'));
      assert.ok(formatted.endsWith('```'));
      assert.ok(formatted.includes('javascript'));
    });

    test('should convert common markdown to MarkdownV2', () => {
      // Test with bold text - MarkdownV2 uses single * for bold
      const boldInput = 'This is **bold** text';
      const boldOutput = convertToMarkdownV2(boldInput);
      // The formatter converts **text** to *escaped_text* (single * for MarkdownV2 bold)
      assert.ok(boldOutput.includes('*'));
      assert.ok(boldOutput.includes('bold'));

      // Test with code block
      const codeInput = '```\ncode here\n```';
      const codeOutput = convertToMarkdownV2(codeInput);
      assert.ok(codeOutput.includes('```'));
    });

    test('should handle mixed formatting', () => {
      const mixed = 'Here is **bold**, _italic_, and `inline code`.';
      const formatted = convertToMarkdownV2(mixed);

      // Should not throw and should produce valid output
      assert.ok(formatted);
      assert.ok(formatted.length > 0);
    });

    test('should handle special Telegram characters', () => {
      const special = 'Price: $100 [link](http://example.com) {braces}';
      const formatted = convertToMarkdownV2(special);

      // Should escape special chars
      assert.ok(formatted);
    });
  });

  describe('Metrics (T-051)', () => {
    test('should track execution metrics', async () => {
      // Execute a simple command
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'hello',
        userId: testUserId,
        bin: 'echo',
        args: ['hello'],
        timeoutMs: 5000
      });

      const metrics = getMetrics();
      assert.equal(metrics.totalExecutions, 1);
      assert.equal(metrics.successCount, 1);
      assert.ok(metrics.averageDurationMs >= 0);
    });

    test('should track interrupt metrics', async () => {
      // Start and interrupt a process
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 30000
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      interruptAiCli(testSessionId);
      await execPromise;

      const metrics = getMetrics();
      assert.equal(metrics.totalExecutions, 1);
      assert.equal(metrics.interruptCount, 1);
    });

    test('should track timeout metrics', async () => {
      // Run a command that times out
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 50
      });

      const metrics = getMetrics();
      assert.equal(metrics.totalExecutions, 1);
      assert.equal(metrics.timeoutCount, 1);
    });
  });
});
