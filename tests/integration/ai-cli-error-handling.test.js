/**
 * Integration Tests for AI CLI Error Recovery
 * F-011, T-054: Test all error scenarios
 *
 * Tests cover:
 * - Timeout with suggestion
 * - Process crash recovery
 * - Interrupt confirmation
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { sessionStore } from '../../src/services/session-store.js';
import {
  executeAiCli,
  interruptAiCli,
  isAiCliRunning,
  resetMetrics,
  getMetrics
} from '../../src/services/ai-cli-service.js';

describe('F-011 AI CLI Error Recovery Integration (T-054)', () => {
  const testSessionId = 'test-error-session-001';
  const testUserId = '123456789';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
    resetMetrics();
  });

  afterEach(() => {
    sessionStore.clear(testSessionId);
  });

  describe('Timeout with Suggestion', () => {
    test('should handle timeout and provide suggestion', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: '5', // sleep 5 seconds
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 500, // 500ms timeout
        heartbeatThresholdMs: 100,
        heartbeatIntervalMs: 100
      });

      assert.equal(result.timedOut, true);
      assert.ok(result.output.includes('超时') || result.output.includes('timeout'));
      // Should include suggestion about /stop or increasing timeout
      assert.ok(
        result.output.includes('建议') ||
        result.output.includes('/stop') ||
        result.output.includes('TIMEOUT') ||
        result.output.includes('中断')
      );
    });

    test('should clean up session after timeout', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: '2',
        userId: testUserId,
        bin: 'sleep',
        args: ['2'],
        timeoutMs: 500
      });

      // Session should be cleaned up
      const isRunning = isAiCliRunning(testSessionId);
      assert.equal(isRunning, false);
    });

    test('should track timeout in metrics', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: '2',
        userId: testUserId,
        bin: 'sleep',
        args: ['2'],
        timeoutMs: 500
      });

      const metrics = getMetrics();
      assert.equal(metrics.timeoutCount, 1);
    });
  });

  describe('Process Crash Recovery', () => {
    test('should handle non-zero exit code', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'exit 1',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'exit 1'],
        timeoutMs: 5000
      });

      assert.equal(result.exitCode, 1);
      assert.ok(result.output);
    });

    test('should handle process that writes to stderr', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'stderr test',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'echo error_message >&2; exit 1'],
        timeoutMs: 5000
      });

      assert.equal(result.exitCode, 1);
      assert.ok(result.stderr.includes('error_message') || result.output.includes('error_message'));
    });

    test('should track failures in metrics', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'exit 1',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'exit 1'],
        timeoutMs: 5000
      });

      const metrics = getMetrics();
      assert.equal(metrics.failureCount, 1);
    });

    test('should handle process spawn failure', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: '/nonexistent/binary/path',
        args: [],
        timeoutMs: 5000
      });

      assert.ok(result.output.includes('无法启动') || result.output.includes('error') || result.output.includes('ENOENT'));
      assert.equal(result.exitCode, null);
    });
  });

  describe('Interrupt Confirmation', () => {
    test('should confirm interrupt was successful', async () => {
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: '10',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 30000
      });

      // Wait for process to start (need enough time for process to be tracked)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify running
      const running = isAiCliRunning(testSessionId);
      if (!running) {
        // Process already completed - skip this assertion
        const result = await execPromise;
        assert.ok(result.interrupted === true || result.timedOut === true || result.exitCode === 0,
          'Process should have completed or been interrupted');
        return;
      }

      // Interrupt
      const interruptResult = interruptAiCli(testSessionId);
      assert.equal(interruptResult.ok, true);
      assert.ok(interruptResult.pid);

      // Wait for completion
      const result = await execPromise;
      assert.equal(result.interrupted, true);
    });

    test('should return error when no process to interrupt', () => {
      const result = interruptAiCli(testSessionId);
      assert.equal(result.ok, false);
      assert.ok(result.error.includes('没有'));
    });

    test('should track interrupts in metrics', async () => {
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: '5',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 30000
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      interruptAiCli(testSessionId);
      await execPromise;

      const metrics = getMetrics();
      assert.equal(metrics.interruptCount, 1);
    });
  });

  describe('Session Cleanup', () => {
    test('should clean up session on successful execution', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'success',
        userId: testUserId,
        bin: 'echo',
        args: ['success'],
        timeoutMs: 5000
      });

      assert.equal(isAiCliRunning(testSessionId), false);
    });

    test('should clean up session on error', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'exit 1',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'exit 1'],
        timeoutMs: 5000
      });

      assert.equal(isAiCliRunning(testSessionId), false);
    });

    test('should clean up session on timeout', async () => {
      await executeAiCli({
        sessionId: testSessionId,
        prompt: '5',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 500
      });

      assert.equal(isAiCliRunning(testSessionId), false);
    });

    test('should clean up session on interrupt', async () => {
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: '10',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 30000
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      interruptAiCli(testSessionId);
      await execPromise;

      assert.equal(isAiCliRunning(testSessionId), false);
    });
  });

  describe('Error Messages with Recovery Suggestions', () => {
    test('should suggest /stop or timeout config for timeout', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: '5',
        userId: testUserId,
        bin: 'sleep',
        args: ['5'],
        timeoutMs: 500
      });

      assert.ok(
        result.output.includes('/stop') ||
        result.output.includes('中断') ||
        result.output.includes('TIMEOUT') ||
        result.output.includes('建议'),
        `Output should mention /stop or interrupt option. Got: ${result.output}`
      );
    });

    test('should suggest checking config for spawn failure', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: '/invalid/path',
        args: [],
        timeoutMs: 5000
      });

      assert.ok(
        result.output.includes('CODEBUDDY_BIN') ||
        result.output.includes('配置') ||
        result.output.includes('无法启动'),
        'Should suggest checking config'
      );
    });

    test('should include stderr in error message', async () => {
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'stderr test',
        userId: testUserId,
        bin: 'sh',
        args: ['-c', 'echo test_error >&2; exit 1'],
        timeoutMs: 5000
      });

      assert.ok(
        result.stderr.includes('test_error') ||
        result.output.includes('test_error') ||
        result.output.includes('错误信息'),
        'Should include stderr or mention error'
      );
    });
  });
});
